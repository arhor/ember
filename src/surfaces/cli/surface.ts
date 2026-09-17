import type { Readable, Writable } from "node:stream";

import { createInterface } from "node:readline";

import type { CapabilityBinding } from "../../capabilities/execution.ts";
import type { EmberState, MeaningId, RuntimeId } from "../../core/model.ts";
import type { MemoryProposalGenerator } from "../../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import type { ProviderInvoker } from "../../providers/contract.ts";
import type { ProviderRequest } from "../../providers/contract.ts";
import type { TelegramSetupResult } from "../telegram/setup.ts";

import { actionProposalConfirmation, ActionProposalStore } from "../../capabilities/action-proposal.ts";
import { selectApprovedGoogleCalendarEventCapability } from "../../capabilities/google-calendar-create.ts";
import { loadGoogleCalendarConfig, selectGoogleCalendarCapability } from "../../capabilities/google-calendar.ts";
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
import { createProviderMemoryProposalGenerator } from "../../memory/provider-memory-proposal-generator.ts";
import { DurableObjectiveStore } from "../../objectives/durable-objective.ts";
import { ObjectiveActionCoordinator } from "../../objectives/objective-action.ts";
import { createProviderOnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import { ConversationContextStore } from "../../persistence/conversation-context-store.ts";
import { OnboardingWorkStore } from "../../persistence/onboarding-work-store.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { createCodexProvider } from "../../providers/codex.ts";
import { createCursorProvider } from "../../providers/cursor.ts";
import { createProcessProvider, providerLabel } from "../../providers/process.ts";
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
    claudeProviderFactory?: (options: {
        model?: string;
        selectCapabilities?: (request: ProviderRequest) => readonly CapabilityBinding[];
    }) => ProviderInvoker;
}

interface CliSurfaceIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export async function runCliSurface(config: CliSurfaceConfig, io: CliSurfaceIo): Promise<number> {
    const store = new StateStore(config.statePath);
    const initialLease = await store.acquireWriteLease();
    try {
        await loadConfiguredState(store, config);
    } finally {
        await store.releaseWriteLease(initialLease);
    }
    const onboardingProvider = configuredCognitionProvider(config).provider;
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
        await withCliLease(store, config, async (state, runtimeId) => {
            try {
                if (line.startsWith(":")) {
                    if (line === ":new-conversation") {
                        const conversationId = await new ConversationContextStore(
                            config.statePath,
                        ).startFreshConversation(config.principal, config.scope);
                        io.output.write(`${conversationId}\n`);
                    } else if (line.startsWith(":ask ")) {
                        const result = await withSigintCancellation((signal) =>
                            ask(config, store, state, runtimeId, line, io.output, signal),
                        );
                        if (result.providerFailure) io.error.write(`provider: ${result.providerFailure}\n`);
                    } else if (line.startsWith(":show-action ")) {
                        const [command, proposalId, ...extra] = splitCommand(line);
                        if (!proposalId || extra.length) throw new ValidationError(`${command} requires PROPOSAL_ID`);
                        const proposal = await new ActionProposalStore(config.statePath).present({
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
                        const actions = new ActionProposalStore(config.statePath);
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
                        const proposal = await new ActionProposalStore(config.statePath).invalidate({
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
                } else await runOrdinaryCliInteraction(config, store, state, runtimeId, onboardingProvider, line, io);
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
    store: StateStore,
    state: EmberState,
    runtimeId: RuntimeId,
    onboardingProvider: ProviderInvoker,
    line: string,
    io: CliSurfaceIo,
) {
    const onboardingWork = await new OnboardingWorkStore(config.statePath).load();
    const onboardingIsActive = onboardingWork?.status === "active" && onboardingWork.scope === config.scope;
    const onboardingProgressEvaluator =
        config.onboardingProgressEvaluator ??
        (onboardingIsActive
            ? createProviderOnboardingProgressEvaluator(onboardingProvider, config.providerTimeoutSeconds)
            : undefined);
    const memoryProposalGenerator =
        config.memoryProposalGenerator ??
        (onboardingIsActive
            ? createProviderMemoryProposalGenerator(onboardingProvider, config.providerTimeoutSeconds)
            : undefined);
    const result = await withSigintCancellation((signal) =>
        runSurfaceInteraction(store, state, {
            runtimeId,
            principal: config.principal,
            scope: config.scope,
            text: line,
            ...configuredCognitionProvider(config),
            timeoutSeconds: config.providerTimeoutSeconds,
            ...(memoryProposalGenerator === undefined
                ? {}
                : { memoryProposalGenerator, memoryProposalProviderLabel: config.memoryProposalProviderLabel }),
            ...(onboardingProgressEvaluator === undefined ? {} : { onboardingProgressEvaluator }),
            signal,
            surfaceId: "local_cli",
            principalProvenance: "explicit_local_argument",
            deliver: io.output,
        }),
    );
    if (result.providerFailure) io.error.write(`provider: ${result.providerFailure}\n`);
    if (result.memoryProposalFailure) io.error.write(`memory proposal: ${result.memoryProposalFailure}\n`);
    if (result.onboardingProgressFailure) io.error.write(`onboarding progress: ${result.onboardingProgressFailure}\n`);
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
    return runSurfaceInteraction(store, state, {
        runtimeId,
        principal: config.principal,
        scope: config.scope,
        text: parts.slice(3).join(" "),
        ...configuredCognitionProvider(config),
        timeoutSeconds: config.providerTimeoutSeconds,
        signal,
        purpose: "explain",
        explainIds: ids,
        surfaceId: "local_cli",
        principalProvenance: "explicit_local_argument",
        deliver: output,
    });
}

function configuredCognitionProvider(config: CliSurfaceConfig) {
    const adapter = { command: config.providerCommand, arguments_: config.providerArgs };
    const claude: ProviderInvoker = async (request, options) => {
        const { createClaudeCodeProvider } = await import("../../providers/claude-code.ts");
        const googleCalendarConfig = config.googleCalendarConfigPath
            ? await loadGoogleCalendarConfig(config.googleCalendarConfigPath)
            : undefined;
        return await (config.claudeProviderFactory ?? createClaudeCodeProvider)({
            ...(config.providerModel ? { model: config.providerModel } : {}),
            ...(googleCalendarConfig
                ? {
                      selectCapabilities: (selectedRequest) => {
                          const actions = new ActionProposalStore(config.statePath);
                          const objectiveActions = new ObjectiveActionCoordinator(
                              new DurableObjectiveStore(config.statePath),
                              actions,
                          );
                          return [
                              ...selectGoogleCalendarCapability(googleCalendarConfig, {
                                  principal: selectedRequest.projection.principal,
                                  lineageId: selectedRequest.projection.lineage.lineageId,
                                  scope: selectedRequest.projection.activeScope,
                                  surface: selectedRequest.projection.surface,
                              }),
                              ...selectApprovedGoogleCalendarEventCapability(
                                  googleCalendarConfig,
                                  actions,
                                  {
                                      principal: selectedRequest.projection.principal,
                                      lineageId: selectedRequest.projection.lineage.lineageId,
                                      scope: selectedRequest.projection.activeScope,
                                      surface: selectedRequest.projection.surface,
                                  },
                                  { revalidateObjective: (proposalId) => objectiveActions.revalidate(proposalId) },
                              ),
                          ];
                      },
                  }
                : {}),
        })(request, options);
    };
    return {
        providerLabel: providerLabel(config.providerCommand),
        provider:
            config.providerKind === "claude-code"
                ? claude
                : config.providerKind === "codex"
                  ? createCodexProvider(adapter)
                  : config.providerKind === "cursor"
                    ? createCursorProvider(adapter)
                    : createProcessProvider(adapter),
    };
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
