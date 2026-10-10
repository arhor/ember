import type { SurfaceRepositories } from "@ember/core/app/surface-repositories.ts";
import type { EmberState, MeaningId, RuntimeId } from "@ember/core/model.ts";
import type { Writable } from "node:stream";

import { actionProposalConfirmation } from "@ember/core/capabilities/action-proposal.ts";
import { EmberError, ValidationError } from "@ember/core/errors.ts";
import { nowUtc } from "@ember/core/model.ts";
import { startRuntime, stopRuntime } from "@ember/core/runtime-episode.ts";
import {
    attachDetail,
    rememberEpisode,
    rememberFact,
    rememberPreference,
    rememberRelationship,
    supersede,
    undertake,
    withholdDetail,
} from "@ember/core/semantics.ts";
import { cloneState } from "@ember/core/util.ts";
import { CommanderError } from "commander";

import type { SessionCommand } from "./session-program.ts";
import type { CliSurfaceConfig } from "./surface.ts";

type CliStateRepository = SurfaceRepositories["state"];
type OperatorCommand = Exclude<SessionCommand, { kind: "ask" | "quit" }>;

export async function runLeasedOperator(
    config: CliSurfaceConfig,
    io: { output: Writable; error: Writable },
    repositories: SurfaceRepositories,
    work: (state: EmberState, runtimeId: RuntimeId) => Promise<void>,
) {
    await withCliLease(repositories.state, config, async (state, runtimeId) => {
        try {
            await work(state, runtimeId);
        } catch (error) {
            if (error instanceof CommanderError) {
                if (error.exitCode !== 0) io.error.write(`command rejected: ${error.message}\n`);
                return;
            }
            if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
            else throw error;
        }
    });
}

export async function executeOperatorCommand(
    command: OperatorCommand,
    state: EmberState,
    runtimeId: RuntimeId,
    config: CliSurfaceConfig,
    io: { output: Writable; error: Writable },
    repositories: SurfaceRepositories,
) {
    const store = repositories.state;
    switch (command.kind) {
        case "new-conversation": {
            const conversationId = await repositories.conversation.startFreshConversation(
                config.principal,
                config.scope,
            );
            io.output.write(`${conversationId}\n`);
            return;
        }
        case "show-action": {
            const proposal = await repositories.actions.present({
                proposalId: command.proposalId,
                principal: config.principal,
                scope: config.scope,
                surface: "local_cli",
                presentedAt: nowUtc(),
            });
            const presentation = proposal.presentations.at(-1)!;
            io.output.write(
                `${JSON.stringify({
                    proposalId: proposal.proposal_id,
                    payloadDigest: proposal.payload_digest,
                    target: proposal.target.label,
                    event: proposal.payload,
                    purpose: proposal.purpose,
                    consequence: proposal.consequence,
                    expiresAt: proposal.expires_at,
                    presentationId: presentation.presentation_id,
                    approvalConfirmation: actionProposalConfirmation(proposal),
                })}\n`,
            );
            return;
        }
        case "approve-action":
        case "reject-action": {
            const actions = repositories.actions;
            const pending = await actions.get(command.proposalId);
            const presentation = pending?.presentations
                .filter(
                    (candidate) =>
                        candidate.principal === config.principal &&
                        candidate.scope === config.scope &&
                        candidate.surface === "local_cli",
                )
                .at(-1);
            if (!presentation) throw new ValidationError("action approval requires :show-action in this scope first");
            const proposal = await actions.decide({
                proposalId: command.proposalId,
                decision: command.kind === "approve-action" ? "approved" : "rejected",
                principal: config.principal,
                payloadDigest: command.payloadDigest,
                scope: config.scope,
                surface: "local_cli",
                presentationId: presentation.presentation_id,
                decidedAt: nowUtc(),
                authoritySourceId: `local_cli:${config.principal}`,
                materialConfirmation: command.materialConfirmation,
            });
            io.output.write(`${JSON.stringify({ proposalId: command.proposalId, status: proposal.status })}\n`);
            return;
        }
        case "withdraw-action":
        case "supersede-action": {
            const proposal = await repositories.actions.invalidate({
                proposalId: command.proposalId,
                kind: command.kind === "withdraw-action" ? "withdrawn" : "superseded",
                principal: config.principal,
                occurredAt: nowUtc(),
                authoritySourceId: `local_cli:${config.principal}`,
                reason: command.reason,
            });
            io.output.write(`${JSON.stringify({ proposalId: command.proposalId, status: proposal.status })}\n`);
            return;
        }
        case "remember-relationship":
        case "remember-fact":
        case "remember-episode":
        case "prefer":
        case "supersede":
        case "undertake":
        case "attach-detail":
        case "fixture-withhold":
            await commitSemanticCommand(store, state, runtimeId, config.principal, command, io);
            return;
    }
}

async function withCliLease(
    store: CliStateRepository,
    config: CliSurfaceConfig,
    work: (state: EmberState, runtimeId: RuntimeId) => Promise<void>,
) {
    const lease = await store.acquireWriteLease();
    let runtimeId: RuntimeId | null = null;
    let stopReason = "cli_interaction_complete";
    try {
        let state = await loadConfiguredState(store, config);
        const started = startRuntime(state, config.principal, config.scope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);
        await work(state, runtimeId);
    } catch (error) {
        stopReason = "cli_failure";
        throw error;
    } finally {
        if (runtimeId !== null) {
            const current = await store.load();
            const episode = current.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
            if (episode?.cleanStopAt === null)
                await store.commit(current.revision, stopRuntime(current, runtimeId, { reason: stopReason }));
        }
        await store.releaseWriteLease(lease);
    }
}

export async function loadConfiguredState(store: CliStateRepository, config: CliSurfaceConfig) {
    const state = await loadForPrincipal(store, config.principal);
    if (
        config.expectedContinuityBinding !== undefined &&
        (state.lineage.lineageId !== config.expectedContinuityBinding.lineageId ||
            state.lineage.establishedAt !== config.expectedContinuityBinding.establishedAt)
    )
        throw new ValidationError("continuity no longer matches setup binding");
    return state;
}

async function commitSemanticCommand(
    store: CliStateRepository,
    state: EmberState,
    runtimeId: RuntimeId,
    principal: string,
    command: Extract<
        OperatorCommand,
        {
            kind:
                | "remember-relationship"
                | "remember-fact"
                | "remember-episode"
                | "prefer"
                | "supersede"
                | "undertake"
                | "attach-detail"
                | "fixture-withhold";
        }
    >,
    io: { output: Writable },
) {
    const candidate = cloneState(state);
    let id: MeaningId | string;
    switch (command.kind) {
        case "remember-relationship":
            id = rememberRelationship(candidate, principal, command.owner, command.scope, command.text);
            break;
        case "remember-fact":
            id = rememberFact(candidate, principal, command.owner, command.slot, command.scope, command.text);
            break;
        case "prefer":
            id = rememberPreference(candidate, principal, command.owner, command.slot, command.scope, command.text);
            break;
        case "supersede":
            id = supersede(candidate, principal, command.id, command.text);
            break;
        case "undertake":
            id = undertake(candidate, principal, command.slot, command.scope, command.text);
            break;
        case "remember-episode":
            id = rememberEpisode(candidate, principal, command.slot, command.owner, command.scope, command.summary);
            break;
        case "attach-detail":
            id = attachDetail(candidate, principal, command.episodeId, command.detail);
            break;
        case "fixture-withhold":
            if (process.env.EMBER_ENABLE_FIXTURE_FAULTS !== "1")
                throw new ValidationError("fixture fault command is available only to deterministic test harness");
            id = withholdDetail(candidate, principal, command.id);
            break;
    }
    const runtime = candidate.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
    if (!runtime) throw new ValidationError(`runtime does not exist: ${runtimeId}`);
    if (runtime.cleanStopAt === null) runtime.lastDurableObservationAt = nowUtc();
    await store.commit(state.revision, candidate);
    io.output.write(`${id}\n`);
}

async function loadForPrincipal(store: CliStateRepository, principal: string) {
    const state = await store.load();
    if (principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
    return state;
}

export function splitCommand(line: string) {
    const result: string[] = [];
    let token = "";
    let quote: "'" | '"' | null = null;
    let escaping = false;
    let started = false;
    for (const char of line) {
        if (escaping) {
            token += char;
            escaping = false;
            started = true;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            escaping = true;
            started = true;
            continue;
        }
        if (quote) {
            if (char === quote) {
                quote = null;
                started = true;
            } else token += char;
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            started = true;
            continue;
        }
        if (/\s/.test(char)) {
            if (started) {
                result.push(token);
                token = "";
                started = false;
            }
            continue;
        }
        token += char;
        started = true;
    }
    if (escaping) throw new ValidationError("malformed quoted command: dangling escape");
    if (quote) throw new ValidationError("malformed quoted command: unterminated quote");
    if (started) result.push(token);
    return result;
}
