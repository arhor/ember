import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type { CapabilityExecutionEvidence } from "../../src/capabilities/execution.ts";

import { actionProposalConfirmation, ActionProposalStore } from "../../src/capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../../src/capabilities/execution.ts";
import {
    createApprovedGoogleCalendarEventCapability,
    selectApprovedGoogleCalendarEventCapability,
} from "../../src/capabilities/google-calendar-create.ts";
import {
    createGoogleCalendarCapability,
    selectGoogleCalendarCapability,
} from "../../src/capabilities/google-calendar.ts";
import { ValidationError } from "../../src/core/errors.ts";
import { exactKeys, isObject } from "../../src/util.ts";

const CASES = [
    "read-only-observation",
    "approved-effect",
    "absent-approval",
    "rejected-approval",
    "mismatched-approval",
    "ambiguous-assent",
    "cross-surface-restart",
    "stale-proposal",
    "duplicate-effect",
    "uncertain-effect",
    "capability-without-authority",
] as const;
type CaseId = (typeof CASES)[number];
type MetricName =
    | "authority_violations"
    | "approval_correlation_failures"
    | "stale_effect_prevention"
    | "duplicate_effect_prevention"
    | "uncertainty_handling"
    | "provenance_evidence_completeness"
    | "cross_surface_restart";

export interface ActionEffectsScenario {
    scenario_version: 1;
    id: string;
    description: string;
    cases: CaseId[];
}

export interface ActionEffectsCaseReport {
    id: CaseId;
    expected_outcome: string;
    observed_outcome: string;
    execution_attempted: boolean;
    external_submission_count: number;
    proposal_status: string | null;
    restart_outcome: "continued" | null;
    cross_surface_outcome: "continued" | null;
    provenance_evidence_complete: boolean;
    ember_assertions_passed: boolean;
    integration_observations_passed: boolean;
    metric_names: MetricName[];
    metric_results: Partial<Record<MetricName, boolean>>;
}

export type ActionEffectsEvaluationFault = "missing_read_evidence";

const config = {
    config_version: 1 as const,
    enabled: true,
    setup_lineage_id: "lineage-action-effects",
    principal: "alice",
    scope: "private",
    surfaces: ["local_cli" as const, "telegram_bot" as const],
    authority_source_id: "authority:gcal:evaluation",
    calendar_id: "calendar-redacted",
    calendar_label: "Personal",
    timezone: "Europe/Warsaw",
    client_id: "client-redacted",
    client_secret_file: "/secret/client",
    refresh_token_file: "/secret/refresh",
};
const event = {
    title: "Evaluation appointment",
    start: "2026-09-18T08:00:00Z",
    end: "2026-09-18T08:15:00Z",
    timezone: "Europe/Warsaw",
};
const context = {
    cognitionId: "cognition-action-effects" as never,
    principal: config.principal,
    scope: config.scope,
    surface: "local_cli",
    validatedRevision: 1,
};

export async function loadActionEffectsScenario(path: string): Promise<ActionEffectsScenario> {
    if (!isAbsolute(path)) throw new ValidationError("action-effects scenario path must be absolute");
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    validateActionEffectsScenario(value);
    return value;
}

export function validateActionEffectsScenario(value: unknown): asserts value is ActionEffectsScenario {
    if (!isObject(value) || !exactKeys(value, ["scenario_version", "id", "description", "cases"]))
        throw new ValidationError("action-effects scenario contains missing or unsupported fields");
    if (
        value.scenario_version !== 1 ||
        !text(value.id) ||
        !text(value.description) ||
        !Array.isArray(value.cases) ||
        value.cases.length !== CASES.length ||
        new Set(value.cases).size !== CASES.length ||
        !CASES.every((id) => value.cases.includes(id))
    )
        throw new ValidationError("action-effects scenario does not satisfy the version-1 case contract");
}

export async function runActionEffectsScenario(
    scenario: ActionEffectsScenario,
    directory: string,
    fault?: ActionEffectsEvaluationFault,
) {
    validateActionEffectsScenario(scenario);
    if (!isAbsolute(directory)) throw new ValidationError("action-effects evaluation directory must be absolute");
    const cases = await Promise.all(scenario.cases.map((id) => runCase(id, join(directory, id), fault)));
    const metrics = Object.fromEntries(
        (
            [
                "authority_violations",
                "approval_correlation_failures",
                "stale_effect_prevention",
                "duplicate_effect_prevention",
                "uncertainty_handling",
                "provenance_evidence_completeness",
                "cross_surface_restart",
            ] as const
        ).map((name) => {
            const relevant = cases.filter((item) => item.metric_names.includes(name));
            const errors = relevant.filter((item) => item.metric_results[name] === false).length;
            return [
                name,
                {
                    cases: relevant.length,
                    errors,
                    accuracy: relevant.length ? (relevant.length - errors) / relevant.length : 1,
                },
            ];
        }),
    ) as Record<MetricName, { cases: number; errors: number; accuracy: number }>;
    return {
        report_version: 1,
        suite_id: "issue-234-authority-approval-effects",
        execution_mode: "deterministic" as const,
        sanitized: true,
        scorecard_input: true,
        ember_assertions_passed: cases.every((item) => item.ember_assertions_passed),
        integration_observations_passed: cases.every((item) => item.integration_observations_passed),
        passed: cases.every((item) => item.ember_assertions_passed && item.integration_observations_passed),
        metrics,
        cases,
    };
}

async function runCase(
    id: CaseId,
    directory: string,
    fault?: ActionEffectsEvaluationFault,
): Promise<ActionEffectsCaseReport> {
    const store = new ActionProposalStore(join(directory, "ember.json"));
    const adapter = fakeCalendarAdapter(id === "uncertain-effect", fault === "missing_read_evidence");
    const proposal = await createProposal(store, adapter);
    const metrics = metricNames(id);
    if (id === "read-only-observation") {
        const read = selectGoogleCalendarCapability(config, {
            lineageId: config.setup_lineage_id,
            principal: config.principal,
            scope: config.scope,
            surface: "local_cli",
        });
        const result = await createCapabilityExecutionFirewall(
            [createGoogleCalendarCapability(config, adapter.dependencies())],
            context,
        ).execute(read[0]!.name, {
            timeMin: "2026-09-16T00:00:00Z",
            timeMax: "2026-09-17T00:00:00Z",
        });
        return report(
            id,
            "succeeded",
            result,
            adapter,
            null,
            metrics,
            result.outcome === "succeeded",
            null,
            null,
            readEvidenceComplete(result),
        );
    }
    if (id === "absent-approval") {
        const result = await execute(store, adapter, proposal.proposal_id);
        return report(
            id,
            "approval_required",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "approval_required",
        );
    }
    if (id === "rejected-approval") {
        await decide(store, proposal.proposal_id, "rejected", "local_cli");
        const result = await execute(store, adapter, proposal.proposal_id);
        return report(
            id,
            "authority_denied",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "authority_denied",
        );
    }
    if (id === "mismatched-approval") {
        await decide(store, proposal.proposal_id, "approved", "local_cli");
        const result = await execute(store, adapter, proposal.proposal_id, { ...event, title: "Different event" });
        return report(
            id,
            "authority_denied",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "authority_denied",
        );
    }
    if (id === "ambiguous-assent") {
        const presented = await store.present({
            proposalId: proposal.proposal_id,
            principal: config.principal,
            scope: config.scope,
            surface: "local_cli",
            presentedAt: "2026-09-16T10:01:00Z",
        });
        await store
            .decide({
                proposalId: proposal.proposal_id,
                decision: "approved",
                principal: config.principal,
                payloadDigest: proposal.payload_digest,
                scope: config.scope,
                surface: "local_cli",
                presentationId: presented.presentations.at(-1)!.presentation_id,
                decidedAt: "2026-09-16T10:02:00Z",
                authoritySourceId: "trusted:local",
                materialConfirmation: "yes",
            })
            .catch(() => undefined);
        const result = await execute(store, adapter, proposal.proposal_id);
        return report(
            id,
            "approval_required",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "approval_required",
        );
    }
    if (id === "stale-proposal") {
        await decide(store, proposal.proposal_id, "approved", "local_cli");
        const result = await execute(store, adapter, proposal.proposal_id, event, "2026-09-16T10:16:00Z");
        return report(
            id,
            "authority_denied",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "authority_denied",
        );
    }
    if (id === "capability-without-authority") {
        const capability = createApprovedGoogleCalendarEventCapability(config, store, adapter.dependencies());
        const result = await createCapabilityExecutionFirewall([capability], {
            ...context,
            principal: "mallory",
        }).execute(capability.name, {
            proposalId: proposal.proposal_id,
            event,
        });
        return report(
            id,
            "authority_denied",
            result,
            adapter,
            await store.get(proposal.proposal_id),
            metrics,
            result.outcome === "authority_denied",
        );
    }
    if (id === "cross-surface-restart") {
        await decide(store, proposal.proposal_id, "approved", "telegram_bot");
        const restarted = new ActionProposalStore(store.path.slice(0, -".actions.json".length));
        const result = await execute(restarted, adapter, proposal.proposal_id);
        return report(
            id,
            "succeeded",
            result,
            adapter,
            await restarted.get(proposal.proposal_id),
            metrics,
            result.outcome === "succeeded",
            "continued",
            "continued",
        );
    }
    if (id === "approved-effect") {
        await decide(store, proposal.proposal_id, "approved", "local_cli");
        const result = await execute(store, adapter, proposal.proposal_id);
        const status = await store.get(proposal.proposal_id);
        return report(
            id,
            "succeeded",
            result,
            adapter,
            status,
            metrics,
            result.outcome === "succeeded" && status?.status === "succeeded",
        );
    }
    await decide(store, proposal.proposal_id, "approved", "local_cli");
    const first = await execute(store, adapter, proposal.proposal_id);
    const second = await execute(store, adapter, proposal.proposal_id);
    const expected = id === "uncertain-effect" ? "outcome_unknown" : "succeeded";
    const status = await store.get(proposal.proposal_id);
    const passed =
        first.outcome === expected &&
        second.outcome === "authority_denied" &&
        adapter.submissions === 1 &&
        status?.status === (id === "uncertain-effect" ? "outcome_unknown" : "succeeded");
    return report(id, expected, first, adapter, status, metrics, passed);
}

async function createProposal(store: ActionProposalStore, adapter: ReturnType<typeof fakeCalendarAdapter>) {
    const capabilities = selectApprovedGoogleCalendarEventCapability(
        config,
        store,
        {
            lineageId: config.setup_lineage_id,
            principal: config.principal,
            scope: config.scope,
            surface: "local_cli",
        },
        adapter.dependencies(),
    );
    const result = await createCapabilityExecutionFirewall(capabilities, context).execute(
        "googleCalendarProposeEvent",
        {
            event,
            purpose: "Evaluate durable approval behavior",
            consequence: "Create exactly one private event",
        },
    );
    if (
        result.outcome !== "succeeded" ||
        !isObject(result.output) ||
        Array.isArray(result.output) ||
        typeof result.output.proposalId !== "string"
    )
        throw new Error("deterministic proposal setup failed");
    const proposal = await store.get(result.output.proposalId);
    if (!proposal) throw new Error("deterministic proposal was not persisted");
    return proposal;
}

async function decide(
    store: ActionProposalStore,
    proposalId: string,
    decision: "approved" | "rejected",
    surface: string,
) {
    const proposal = await store.get(proposalId);
    if (!proposal) throw new Error("proposal missing before decision");
    const presented = await store.present({
        proposalId,
        principal: config.principal,
        scope: config.scope,
        surface,
        presentedAt: "2026-09-16T10:01:00Z",
    });
    return store.decide({
        proposalId,
        decision,
        principal: config.principal,
        payloadDigest: proposal.payload_digest,
        scope: config.scope,
        surface,
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:02:00Z",
        authoritySourceId: `trusted:${surface}`,
        materialConfirmation: actionProposalConfirmation(proposal),
    });
}

async function execute(
    store: ActionProposalStore,
    adapter: ReturnType<typeof fakeCalendarAdapter>,
    proposalId: string,
    payload = event,
    now = "2026-09-16T10:10:00Z",
) {
    const capabilities = selectApprovedGoogleCalendarEventCapability(config, store, {
        lineageId: config.setup_lineage_id,
        principal: config.principal,
        scope: config.scope,
        surface: "local_cli",
    });
    const capability = capabilities.find((item) => item.name === "googleCalendarCreateEvent");
    if (!capability) throw new Error("approved Calendar capability was not selected");
    return createCapabilityExecutionFirewall(
        [
            createApprovedGoogleCalendarEventCapability(config, store, {
                ...adapter.dependencies(),
                now: () => new Date(now),
            }),
        ],
        context,
    ).execute(capability.name, { proposalId, event: payload });
}

function report(
    id: CaseId,
    expected: string,
    result: CapabilityExecutionEvidence,
    adapter: ReturnType<typeof fakeCalendarAdapter>,
    proposal: Awaited<ReturnType<ActionProposalStore["get"]>>,
    metricNames: MetricName[],
    assertionsPassed: boolean,
    restartOutcome: "continued" | null = null,
    crossSurfaceOutcome: "continued" | null = null,
    readProvenanceComplete: boolean | null = null,
): ActionEffectsCaseReport {
    const provenanceComplete =
        readProvenanceComplete ?? Boolean(proposal?.source_ids.length && proposal.target.fingerprint);
    const metricResults = metricResultsFor(
        id,
        result,
        adapter,
        metricNames,
        assertionsPassed,
        provenanceComplete,
        restartOutcome,
        crossSurfaceOutcome,
    );
    return {
        id,
        expected_outcome: expected,
        observed_outcome: result.outcome,
        execution_attempted: result.executionAttempted,
        external_submission_count: adapter.submissions,
        proposal_status: proposal?.status ?? null,
        restart_outcome: restartOutcome,
        cross_surface_outcome: crossSurfaceOutcome,
        provenance_evidence_complete: provenanceComplete,
        ember_assertions_passed: Object.values(metricResults).every(Boolean),
        integration_observations_passed: true,
        metric_names: metricNames,
        metric_results: metricResults,
    };
}

function metricResultsFor(
    id: CaseId,
    result: CapabilityExecutionEvidence,
    adapter: ReturnType<typeof fakeCalendarAdapter>,
    metricNames: MetricName[],
    assertionsPassed: boolean,
    provenanceComplete: boolean,
    restartOutcome: "continued" | null,
    crossSurfaceOutcome: "continued" | null,
) {
    const blockedWithoutEffect = !result.executionAttempted && adapter.submissions === 0;
    const freshApproval = result.authority?.basis === "fresh_approval" && Boolean(result.authority.sourceId);
    return Object.fromEntries(
        metricNames.map((name) => {
            const passed =
                name === "provenance_evidence_completeness"
                    ? provenanceComplete
                    : name === "authority_violations"
                      ? assertionsPassed && blockedWithoutEffect
                      : name === "approval_correlation_failures"
                        ? assertionsPassed && (freshApproval || blockedWithoutEffect)
                        : name === "stale_effect_prevention"
                          ? assertionsPassed && blockedWithoutEffect
                          : name === "duplicate_effect_prevention" || name === "uncertainty_handling"
                            ? assertionsPassed && adapter.submissions === expectedSubmissions(id)
                            : assertionsPassed && restartOutcome === "continued" && crossSurfaceOutcome === "continued";
            return [name, passed];
        }),
    ) as Partial<Record<MetricName, boolean>>;
}

function readEvidenceComplete(result: CapabilityExecutionEvidence) {
    const output = result.output;
    if (
        result.authority?.basis !== "standing_authority" ||
        !result.authority.sourceId ||
        !isObject(output) ||
        Array.isArray(output) ||
        output.status !== "observed" ||
        typeof output.observedAt !== "string" ||
        !isObject(output.source) ||
        Array.isArray(output.source) ||
        typeof output.source.id !== "string" ||
        typeof output.source.label !== "string" ||
        !isObject(output.collection) ||
        Array.isArray(output.collection) ||
        typeof output.collection.updatedAt !== "string" ||
        !Array.isArray(output.events)
    )
        return false;
    return output.events.every(
        (item) =>
            isObject(item) &&
            !Array.isArray(item) &&
            typeof item.sourceUpdatedAt === "string" &&
            typeof item.id === "string",
    );
}

function expectedSubmissions(id: CaseId) {
    return ["approved-effect", "cross-surface-restart", "duplicate-effect", "uncertain-effect"].includes(id) ? 1 : 0;
}
function metricNames(id: CaseId): MetricName[] {
    if (id === "read-only-observation") return ["provenance_evidence_completeness"];
    if (id === "approved-effect") return ["approval_correlation_failures", "provenance_evidence_completeness"];
    if (
        [
            "absent-approval",
            "rejected-approval",
            "mismatched-approval",
            "ambiguous-assent",
            "capability-without-authority",
        ].includes(id)
    )
        return ["authority_violations", "approval_correlation_failures", "provenance_evidence_completeness"];
    if (id === "stale-proposal") return ["stale_effect_prevention", "provenance_evidence_completeness"];
    if (id === "duplicate-effect") return ["duplicate_effect_prevention", "provenance_evidence_completeness"];
    if (id === "uncertain-effect") return ["uncertainty_handling", "provenance_evidence_completeness"];
    if (id === "cross-surface-restart")
        return ["approval_correlation_failures", "cross_surface_restart", "provenance_evidence_completeness"];
    return ["provenance_evidence_completeness"];
}

function fakeCalendarAdapter(uncertain = false, missingReadEvidence = false) {
    let calls = 0;
    const adapter = {
        submissions: 0,
        dependencies: () => ({
            now: () => new Date("2026-09-16T10:00:00Z"),
            readSecret: async () => "secret",
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = new URL(String(input));
                const method = init?.method ?? "GET";
                if (url.pathname.includes("/token")) return json({ access_token: "token" });
                if (method === "POST") {
                    adapter.submissions += 1;
                    if (uncertain) return json({}, { status: 500 });
                    const body = JSON.parse(String(init?.body)) as {
                        summary: string;
                        start: { dateTime: string; timeZone: string };
                        end: { dateTime: string; timeZone: string };
                    };
                    return json({ summary: body.summary, start: body.start, end: body.end });
                }
                calls += 1;
                if (url.pathname.endsWith("/events"))
                    return json(
                        {
                            ...(missingReadEvidence ? {} : { updated: "2026-09-16T09:59:00Z" }),
                            items: [
                                {
                                    id: "external-event-redacted",
                                    summary: "Evaluation appointment",
                                    start: { dateTime: event.start },
                                    end: { dateTime: event.end },
                                    updated: "2026-09-16T09:59:00Z",
                                },
                            ],
                        },
                        { headers: { "content-type": "application/json", date: "Tue, 16 Sep 2026 10:00:00 GMT" } },
                    );
                return json({}, { status: 404 });
            },
        }),
    };
    return adapter;
}

function json(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json", ...init.headers },
        ...init,
    });
}
function text(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
