import type { Readable, Writable } from "node:stream";

import { createInterface } from "node:readline";

import type { AiExecutor } from "../../ai/contract.ts";
import type { EmberApplication } from "../../app/contract.ts";
import type { EmberApplicationDependencies } from "../../composition/ember.ts";
import type { EmberState, MeaningId, RuntimeId } from "../../core/model.ts";
import type { MemoryProposalGenerator } from "../../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import type { TelegramSetupResult } from "../telegram/setup.ts";

import { createEmberApplication } from "../../app/application.ts";
import { actionProposalConfirmation } from "../../capabilities/action-proposal.ts";
import { composeEmberApplication } from "../../composition/ember.ts";
import { EmberError, ValidationError } from "../../core/errors.ts";
import { nowUtc } from "../../core/model.ts";
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
import { StateStore } from "../../persistence/state-store.ts";
import { runSurfaceInteraction } from "../../runtime/interaction-boundary.ts";
import { startRuntime, stopRuntime } from "../../runtime/runtime.ts";
import { cloneState } from "../../util.ts";

export interface CliSurfaceConfig {
    statePath: string;
    principal: string;
    scope: string;
    providerKind: "process" | "codex" | "cursor" | "claude-code";
    providerModel?: string;
    expectedContinuityBinding?: { lineageId: string; establishedAt: string };
    providerCommand: string;
    providerArgs: string[];
    providerTimeoutSeconds: number;
    memoryProposalGenerator?: MemoryProposalGenerator;
    memoryProposalProviderLabel?: string;
    onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    configuredSetupHandoff?: () => Promise<TelegramSetupResult>;
    googleCalendarConfigPath?: string;
    claudeProviderFactory?: (options: { model?: string }) => AiExecutor;
}

interface CliSurfaceIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export async function runCliSurface(config: CliSurfaceConfig, io: CliSurfaceIo): Promise<number> {
    const dependencies = dependenciesForCli(config);
    const application = createEmberApplication(dependencies);
    const store = dependencies.repositories.state;
    const initialLease = await store.acquireWriteLease();
    try {
        await loadConfiguredState(store, config);
    } finally {
        await store.releaseWriteLease(initialLease);
    }
    const lines = createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    for await (const line of lines) {
        if (!line.trim()) continue;
        if (line === ":quit") return 0;
        if (line === ":setup telegram" && config.configuredSetupHandoff !== undefined) {
            try {
                const setup = await config.configuredSetupHandoff();
                io.output.write(`Telegram setup: ${setup.status}. Resuming conversation.\n`);
            } catch {
                io.error.write("Telegram setup failed at the trusted-host boundary. Resuming conversation.\n");
            }
            continue;
        }
        if (!line.startsWith(":")) {
            try {
                await runOrdinaryCliInteraction(config, application, line, io);
            } catch (error) {
                if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
            continue;
        }
        await withCliLease(store, config, async (state, runtimeId) => {
            try {
                if (line.startsWith(":")) {
                    if (line === ":new-conversation") {
                        const conversationId = await dependencies.repositories.conversation.startFreshConversation(
                            config.principal,
                            config.scope,
                        );
                        io.output.write(`${conversationId}\n`);
                    } else if (line.startsWith(":ask ")) {
                        const result = await withSigintCancellation((signal) =>
                            ask(config, dependencies, store, state, runtimeId, line, io.output, signal),
                        );
                        if (result.providerFailure) io.error.write(`provider: ${result.providerFailure}\n`);
                    } else if (line.startsWith(":show-action ")) {
                        const [command, proposalId, ...extra] = splitCommand(line);
                        if (!proposalId || extra.length) throw new ValidationError(`${command} requires PROPOSAL_ID`);
                        const proposal = await dependencies.repositories.actions.present({
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
                        const actions = dependencies.repositories.actions;
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
                        const proposal = await dependencies.repositories.actions.invalidate({
                            proposalId,
                            kind: command === ":withdraw-action" ? "withdrawn" : "superseded",
                            principal: config.principal,
                            occurredAt: nowUtc(),
                            authoritySourceId: `local_cli:${config.principal}`,
                            reason: reason.join(" "),
                        });
                        io.output.write(`${JSON.stringify({ proposalId, status: proposal.status })}\n`);
                    } else {
                        const result = await semanticCommand(
                            store,
                            state,
                            runtimeId,
                            config.principal,
                            config.scope,
                            line,
                        );
                        io.output.write(`${result.id}\n`);
                    }
                }
            } catch (error) {
                if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
        });
    }
    return 0;
}

async function withCliLease(
    store: StateStore,
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

async function runOrdinaryCliInteraction(
    config: CliSurfaceConfig,
    application: EmberApplication,
    line: string,
    io: CliSurfaceIo,
) {
    const result = await withSigintCancellation((signal) =>
        application.interact(
            {
                kind: "message",
                principal: config.principal,
                scope: config.scope,
                text: line,
                surfaceId: "local_cli",
                principalProvenance: "explicit_local_argument",
            },
            async ({ text }) => {
                await writeCliOutput(io.output, text);
                return { outcome: "confirmed", externalMessageId: null };
            },
            { signal },
        ),
    );
    if (result.diagnostics.providerFailure) io.error.write(`provider: ${result.diagnostics.providerFailure}\n`);
    if (result.diagnostics.memoryProposalFailure)
        io.error.write(`memory proposal: ${result.diagnostics.memoryProposalFailure}\n`);
    if (result.diagnostics.onboardingProgressFailure)
        io.error.write(`onboarding progress: ${result.diagnostics.onboardingProgressFailure}\n`);
}

async function writeCliOutput(output: Writable, text: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error | null) => {
            if (settled) return;
            settled = true;
            output.off("error", onError);
            if (error) reject(error);
            else resolve();
        };
        const onError = (error: Error) => finish(error);
        output.once("error", onError);
        try {
            output.write(text, (error) => finish(error));
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

async function loadConfiguredState(store: StateStore, config: CliSurfaceConfig) {
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
    store: StateStore,
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

async function ask(
    config: CliSurfaceConfig,
    dependencies: EmberApplicationDependencies,
    store: StateStore,
    state: EmberState,
    runtimeId: RuntimeId,
    line: string,
    output: Writable,
    signal: AbortSignal,
) {
    const parts = splitCommand(line);
    if (parts.length < 4 || parts[0] !== ":ask" || parts[1] !== "--explain")
        throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");
    const ids = parts[2]!.split(",").filter(Boolean);
    if (!ids.length) throw new ValidationError("at least one explanation ID is required");
    return runSurfaceInteraction(dependencies.repositories, state, {
        runtimeId,
        principal: config.principal,
        scope: config.scope,
        text: parts.slice(3).join(" "),
        executor: dependencies.cognition.executor,
        providerLabel: dependencies.cognition.providerLabel,
        timeoutSeconds: dependencies.cognition.timeoutSeconds,
        signal,
        purpose: "explain",
        explainIds: ids,
        surfaceId: "local_cli",
        principalProvenance: "explicit_local_argument",
        deliver: output,
    });
}

function dependenciesForCli(config: CliSurfaceConfig) {
    return composeEmberApplication(
        {
            statePath: config.statePath,
            ...(config.expectedContinuityBinding === undefined
                ? {}
                : { expectedContinuityBinding: config.expectedContinuityBinding }),
            provider: {
                kind: config.providerKind,
                command: config.providerCommand,
                arguments: config.providerArgs,
                timeoutSeconds: config.providerTimeoutSeconds,
                ...(config.providerModel === undefined ? {} : { model: config.providerModel }),
            },
            ...(config.googleCalendarConfigPath === undefined
                ? {}
                : { googleCalendarConfigPath: config.googleCalendarConfigPath }),
        },
        {
            ...(config.memoryProposalGenerator === undefined
                ? {}
                : { memoryProposalGenerator: config.memoryProposalGenerator }),
            ...(config.memoryProposalProviderLabel === undefined
                ? {}
                : { memoryProposalProviderLabel: config.memoryProposalProviderLabel }),
            ...(config.onboardingProgressEvaluator === undefined
                ? {}
                : { onboardingProgressEvaluator: config.onboardingProgressEvaluator }),
            ...(config.claudeProviderFactory === undefined
                ? {}
                : { claudeProviderFactory: config.claudeProviderFactory }),
        },
    );
}

async function loadForPrincipal(store: StateStore, principal: string) {
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

async function withSigintCancellation<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    try {
        return await operation(controller.signal);
    } finally {
        process.off("SIGINT", cancel);
    }
}
