#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { actionProposalConfirmation, ActionProposalStore } from "../../src/core/capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../../src/core/capabilities/execution.ts";
import { selectApprovedGoogleCalendarEventCapability } from "../../src/integrations/google-calendar/create.ts";
import {
    loadGoogleCalendarConfig,
    selectGoogleCalendarCapability,
} from "../../src/integrations/google-calendar/read.ts";
import { loadActionEffectsScenario, runActionEffectsScenario } from "./harness.ts";

const options = parse(process.argv.slice(2));
const directory = await mkdtemp(join(tmpdir(), "ember-action-effects-"));
try {
    const report =
        options.mode === "deterministic"
            ? await runActionEffectsScenario(await loadActionEffectsScenario(options.scenario), directory)
            : await runLiveGoogleCalendarEvaluation(directory);
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, output, { mode: 0o600, flag: "wx" });
    else process.stdout.write(output);
    if (!report.ember_assertions_passed) process.exitCode = 1;
    else if (!report.integration_observations_passed) process.exitCode = 2;
} finally {
    await rm(directory, { recursive: true, force: true });
}

async function runLiveGoogleCalendarEvaluation(directory: string) {
    if (process.env.EMBER_RUN_LIVE_ACTION_EFFECTS !== "1" && process.env.EMBER_RUN_LIVE_GOOGLE_CALENDAR_CREATE !== "1")
        throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_ACTION_EFFECTS=1");
    const configPath = required("EMBER_GOOGLE_CALENDAR_CONFIG");
    const title = required("EMBER_GOOGLE_CALENDAR_EVENT_TITLE");
    const start = required("EMBER_GOOGLE_CALENDAR_EVENT_START");
    const end = required("EMBER_GOOGLE_CALENDAR_EVENT_END");
    if (process.env.EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL !== `${title}|${start}|${end}`)
        throw new Error("EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL must exactly repeat title|start|end");
    const config = await loadGoogleCalendarConfig(configPath);
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const context = {
        cognitionId: "cognition-live-action-effects" as never,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
        validatedRevision: 1,
    };
    const read = selectGoogleCalendarCapability(config, {
        lineageId: config.setup_lineage_id,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
    });
    const writes = selectApprovedGoogleCalendarEventCapability(config, store, {
        lineageId: config.setup_lineage_id,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
    });
    if (!read.length || !writes.length)
        throw new Error("Google Calendar capability is not active for the configured local CLI scope");
    const observation = await createCapabilityExecutionFirewall(read, context).execute(read[0]!.name, {
        timeMin: start,
        timeMax: end,
    });
    const proposalResult = await createCapabilityExecutionFirewall(writes, context).execute(
        "googleCalendarProposeEvent",
        {
            event: { title, start, end, timezone: config.timezone },
            purpose: "Operator-requested live authority and effect evaluation",
            consequence: "Creates exactly one private calendar event without attendee notifications",
        },
    );
    let effectOutcome = "not_attempted";
    let proposalStatus: string | null = null;
    let semanticPassed = proposalResult.outcome === "succeeded";
    if (proposalResult.outcome === "succeeded" && proposalResult.output && typeof proposalResult.output === "object") {
        const proposalId = (proposalResult.output as Record<string, unknown>).proposalId;
        if (typeof proposalId === "string") {
            const proposal = await store.get(proposalId);
            if (proposal) {
                const presented = await store.present({
                    proposalId,
                    principal: config.principal,
                    scope: config.scope,
                    surface: "local_cli",
                    presentedAt: new Date().toISOString(),
                });
                await store.decide({
                    proposalId,
                    decision: "approved",
                    principal: config.principal,
                    payloadDigest: proposal.payload_digest,
                    scope: config.scope,
                    surface: "local_cli",
                    presentationId: presented.presentations.at(-1)!.presentation_id,
                    decidedAt: new Date().toISOString(),
                    authoritySourceId: "live-evaluation:exact-environment-confirmation",
                    materialConfirmation: actionProposalConfirmation(proposal),
                });
                const effect = await createCapabilityExecutionFirewall(writes, context).execute(
                    "googleCalendarCreateEvent",
                    {
                        proposalId,
                        event: { title, start, end, timezone: config.timezone },
                    },
                );
                effectOutcome = effect.outcome;
                proposalStatus = (await store.get(proposalId))?.status ?? null;
                semanticPassed &&=
                    effect.executionAttempted &&
                    effect.outcome !== "approval_required" &&
                    effect.outcome !== "authority_denied";
            } else semanticPassed = false;
        } else semanticPassed = false;
    } else semanticPassed = false;
    const integrationPassed = observation.outcome === "succeeded" && effectOutcome === "succeeded";
    return {
        report_version: 1,
        suite_id: "issue-234-authority-approval-effects",
        execution_mode: "live" as const,
        sanitized: true,
        scorecard_input: true,
        ember_assertions_passed: semanticPassed,
        integration_observations_passed: integrationPassed,
        passed: semanticPassed && integrationPassed,
        metrics: {
            authority_violations: { cases: 1, errors: semanticPassed ? 0 : 1, accuracy: semanticPassed ? 1 : 0 },
            approval_correlation_failures: {
                cases: 1,
                errors: semanticPassed ? 0 : 1,
                accuracy: semanticPassed ? 1 : 0,
            },
            stale_effect_prevention: { cases: 0, errors: 0, accuracy: 1 },
            duplicate_effect_prevention: { cases: 0, errors: 0, accuracy: 1 },
            uncertainty_handling: { cases: 0, errors: 0, accuracy: 1 },
            provenance_evidence_completeness: {
                cases: 1,
                errors: proposalStatus ? 0 : 1,
                accuracy: proposalStatus ? 1 : 0,
            },
            cross_surface_restart: { cases: 0, errors: 0, accuracy: 1 },
        },
        live_observation_outcome: observation.outcome,
        live_effect_outcome: effectOutcome,
        proposal_status: proposalStatus,
    };
}

function parse(args: string[]) {
    let scenario = resolve("eval/action-effects/fixtures/authority-approval-effects.json");
    let report: string | undefined;
    let mode: "deterministic" | "live" = "deterministic";
    for (let index = 0; index < args.length; index += 1) {
        const name = args[index];
        const value = args[index + 1];
        if ((name === "--scenario" || name === "--report") && value) {
            const path = isAbsolute(value) ? value : resolve(value);
            if (name === "--scenario") scenario = path;
            else report = path;
            index += 1;
        } else if (name === "--mode" && (value === "deterministic" || value === "live")) {
            mode = value;
            index += 1;
        } else
            throw new Error(
                "usage: eval/action-effects/run.ts [--scenario PATH] [--report NEW_PATH] [--mode deterministic|live]",
            );
    }
    return { scenario, report, mode };
}

function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}
