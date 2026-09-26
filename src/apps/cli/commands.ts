import type { Writable } from "node:stream";

import type { SurfaceRepositories } from "../../core/app/surface-repositories.ts";
import type { EmberState, MeaningId, RuntimeId } from "../../core/model.ts";
import type { CliSurfaceConfig } from "./surface.ts";

import { actionProposalConfirmation } from "../../capabilities/action-proposal.ts";
import { EmberError, ValidationError } from "../../core/errors.ts";
import { nowUtc } from "../../core/model.ts";
import { startRuntime, stopRuntime } from "../../core/runtime-episode.ts";
import {
    attachDetail,
    rememberEpisode,
    rememberFact,
    rememberPreference,
    rememberRelationship,
    supersede,
    undertake,
    withholdDetail,
} from "../../core/semantics.ts";
import { cloneState } from "../../core/util.ts";

type CliStateRepository = SurfaceRepositories["state"];

export async function runCliCommand(
    line: string,
    config: CliSurfaceConfig,
    io: { output: Writable; error: Writable },
    repositories: SurfaceRepositories,
) {
    const store = repositories.state;
    await withCliLease(store, config, async (state, runtimeId) => {
        try {
            if (line.startsWith(":")) {
                if (line === ":new-conversation") {
                    const conversationId = await repositories.conversation.startFreshConversation(
                        config.principal,
                        config.scope,
                    );
                    io.output.write(`${conversationId}\n`);
                } else if (line.startsWith(":show-action ")) {
                    const [command, proposalId, ...extra] = splitCommand(line);
                    if (!proposalId || extra.length) throw new ValidationError(`${command} requires PROPOSAL_ID`);
                    const proposal = await repositories.actions.present({
                        proposalId,
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
                } else if (line.startsWith(":approve-action ") || line.startsWith(":reject-action ")) {
                    const [command, proposalId, payloadDigest, materialConfirmation, ...extra] = splitCommand(line);
                    if (!proposalId || !payloadDigest || !materialConfirmation || extra.length)
                        throw new ValidationError(
                            `${command} requires PROPOSAL_ID PAYLOAD_DIGEST QUOTED_MATERIAL_CONFIRMATION`,
                        );
                    const actions = repositories.actions;
                    const pending = await actions.get(proposalId);
                    const presentation = pending?.presentations
                        .filter(
                            (candidate) =>
                                candidate.principal === config.principal &&
                                candidate.scope === config.scope &&
                                candidate.surface === "local_cli",
                        )
                        .at(-1);
                    if (!presentation)
                        throw new ValidationError("action approval requires :show-action in this scope first");
                    const proposal = await actions.decide({
                        proposalId,
                        decision: command === ":approve-action" ? "approved" : "rejected",
                        principal: config.principal,
                        payloadDigest,
                        scope: config.scope,
                        surface: "local_cli",
                        presentationId: presentation.presentation_id,
                        decidedAt: nowUtc(),
                        authoritySourceId: `local_cli:${config.principal}`,
                        materialConfirmation,
                    });
                    io.output.write(`${JSON.stringify({ proposalId, status: proposal.status })}\n`);
                } else if (line.startsWith(":withdraw-action ") || line.startsWith(":supersede-action ")) {
                    const [command, proposalId, ...reason] = splitCommand(line);
                    if (!proposalId || !reason.length)
                        throw new ValidationError(`${command} requires PROPOSAL_ID REASON`);
                    const proposal = await repositories.actions.invalidate({
                        proposalId,
                        kind: command === ":withdraw-action" ? "withdrawn" : "superseded",
                        principal: config.principal,
                        occurredAt: nowUtc(),
                        authoritySourceId: `local_cli:${config.principal}`,
                        reason: reason.join(" "),
                    });
                    io.output.write(`${JSON.stringify({ proposalId, status: proposal.status })}\n`);
                } else {
                    const result = await semanticCommand(store, state, runtimeId, config.principal, config.scope, line);
                    io.output.write(`${result.id}\n`);
                }
            }
        } catch (error) {
            if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
            else throw error;
        }
    });
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

async function semanticCommand(
    store: CliStateRepository,
    state: EmberState,
    runtimeId: RuntimeId,
    principal: string,
    scope: string,
    line: string,
) {
    const parts = splitCommand(line);
    const candidate = cloneState(state);
    let id: MeaningId | string;
    if (parts[0] === ":remember" && parts[1] === "relationship" && parts.length >= 5)
        id = rememberRelationship(candidate, principal, parts[2]!, parts[3]!, parts.slice(4).join(" "));
    else if (parts[0] === ":remember" && parts[1] === "fact" && parts.length >= 6)
        id = rememberFact(candidate, principal, parts[2]!, parts[3]!, parts[4]!, parts.slice(5).join(" "));
    else if (parts[0] === ":prefer" && parts.length >= 5)
        id = rememberPreference(candidate, principal, parts[1]!, parts[2]!, parts[3]!, parts.slice(4).join(" "));
    else if (parts[0] === ":supersede" && parts.length >= 3)
        id = supersede(candidate, principal, parts[1]!, parts.slice(2).join(" "));
    else if (parts[0] === ":undertake" && parts.length >= 4)
        id = undertake(candidate, principal, parts[1]!, parts[2]!, parts.slice(3).join(" "));
    else if (parts[0] === ":remember" && parts[1] === "episode" && parts.length >= 6)
        id = rememberEpisode(candidate, principal, parts[2]!, parts[3]!, parts[4]!, parts.slice(5).join(" "));
    else if (parts[0] === ":attach-detail" && parts.length >= 3)
        id = attachDetail(candidate, principal, parts[1]!, parts.slice(2).join(" "));
    else if (parts[0] === ":fixture-withhold" && parts.length === 2) {
        if (process.env.EMBER_ENABLE_FIXTURE_FAULTS !== "1")
            throw new ValidationError("fixture fault command is available only to deterministic test harness");
        id = withholdDetail(candidate, principal, parts[1]!);
    } else throw new ValidationError("unsupported or malformed semantic command");
    const runtime = candidate.operations.runtimeEpisodes.find((r) => r.runtimeId === runtimeId);
    if (!runtime) throw new ValidationError(`runtime does not exist: ${runtimeId}`);
    if (runtime.cleanStopAt === null) runtime.lastDurableObservationAt = nowUtc();
    return { state: await store.commit(state.revision, candidate), id };
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
