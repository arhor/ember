import { isDeepStrictEqual } from "node:util";

import type { PreparedCognition } from "../app/cognition-preparation.ts";
import type { ConversationMembershipIntent } from "../core/interaction-contract.ts";
import type {
    CognitionEpisode,
    CognitionId,
    CognitionPurpose,
    AgentExpressionEvidence,
    EmberState,
    MeaningId,
    RuntimeEpisode,
    RuntimeId,
} from "../core/model.ts";
import type {
    MemoryProposalGenerationRepository,
    MemoryProposalGenerator,
} from "../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../onboarding/progress-evaluator.ts";
import type { ConversationContextStore } from "../persistence/conversation-context-store.ts";
import type { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";

import { prepareCognition } from "../app/cognition-preparation.ts";
import { selectRecentConversationContext } from "../core/conversation-context.ts";
import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import { agentActor, newId, nowUtc, validateState } from "../core/model.ts";
import { applyOnboardingProgressDecision, projectOnboardingWork } from "../core/onboarding-work.ts";
import { buildProjection, findRuntime } from "../core/projection.ts";
import { requirePrincipal, userEvidence } from "../core/semantics.ts";
import { generateAndAdoptConversationMemories } from "../memory/memory-proposal-generation.ts";
import { CONTRACT_VERSION } from "../providers/contract.ts";
import { cloneState } from "../util.ts";

export function startRuntime(
    state: EmberState,
    principal: string,
    scope: string,
    { timestamp = nowUtc() }: { timestamp?: string } = {},
) {
    requirePrincipal(state, principal);
    if (typeof scope !== "string" || !scope.trim()) {
        throw new ValidationError("active scope must be non-empty");
    }
    const candidate = cloneState(state);
    const previous = latestRuntime(candidate);
    const runtimeId = newId("runtime");
    const recovery =
        previous === null
            ? {
                  previousRuntime: null,
                  currentRuntime: runtimeId,
                  gapKind: "initial_start" as const,
                  lastDurableObservationAt: null,
                  cleanStopAt: null,
                  restartAt: timestamp,
                  agentCognitionDuringInterval: "not_applicable" as const,
                  externalChangesDuringInterval: "unknown" as const,
              }
            : previous.cleanStopAt !== null
              ? {
                    previousRuntime: previous.runtimeId,
                    currentRuntime: runtimeId,
                    gapKind: "known_clean_stop_interval" as const,
                    lastDurableObservationAt: previous.lastDurableObservationAt,
                    cleanStopAt: previous.cleanStopAt,
                    restartAt: timestamp,
                    agentCognitionDuringInterval: "none_in_supported_runtime" as const,
                    externalChangesDuringInterval: "unknown" as const,
                }
              : {
                    previousRuntime: previous.runtimeId,
                    currentRuntime: runtimeId,
                    gapKind: "uncertain_interruption_boundary" as const,
                    lastDurableObservationAt: previous.lastDurableObservationAt,
                    cleanStopAt: null,
                    restartAt: timestamp,
                    agentCognitionDuringInterval: "unknown_after_last_durable_observation" as const,
                    externalChangesDuringInterval: "unknown" as const,
                };
    if (previous?.cleanStopAt === null) {
        for (const cognition of candidate.operations.cognitionEpisodes) {
            if (cognition.runtimeId === previous.runtimeId && cognition.status === "started") {
                cognition.status = "outcome_unknown";
            }
        }
        for (const opportunity of candidate.operations.cognitionOpportunities ?? []) {
            if (opportunity.runtimeId === previous.runtimeId && opportunity.status === "evaluating") {
                opportunity.status = "outcome_unknown";
                opportunity.lastDurableObservationAt = timestamp;
                opportunity.providerTermination = null;
            }
        }
    }
    candidate.operations.runtimeEpisodes.push({
        runtimeId: runtimeId,
        principal,
        activeScope: scope,
        startedAt: timestamp,
        lastDurableObservationAt: timestamp,
        cleanStopAt: null,
        stopReason: null,
        recoveryAccount: recovery,
    });
    validateState(candidate);
    return { state: candidate, runtimeId };
}

export function stopRuntime(
    state: EmberState,
    runtimeId: RuntimeId | string,
    {
        reason,
        timestamp = nowUtc(),
    }: {
        reason: string;
        timestamp?: string;
    },
): EmberState {
    const candidate = cloneState(state);
    const runtime = findRuntime(candidate, runtimeId);
    if (runtime.cleanStopAt !== null) {
        throw new ValidationError("runtime is already stopped");
    }
    for (const opportunity of candidate.operations.cognitionOpportunities ?? []) {
        if (opportunity.runtimeId === runtime.runtimeId && opportunity.status === "evaluating") {
            opportunity.status = "outcome_unknown";
            opportunity.lastDurableObservationAt = timestamp;
            opportunity.providerTermination = null;
        }
    }
    runtime.lastDurableObservationAt = timestamp;
    runtime.cleanStopAt = timestamp;
    runtime.stopReason = reason;
    validateState(candidate);
    return candidate;
}

export interface RunCognitionOptions {
    runtimeId: RuntimeId;
    principal: string;
    scope: string;
    surface?: string;
    text: string;
    providerLabel: string;
    provider: ProviderInvoker;
    timeoutSeconds: number;
    signal?: AbortSignal | undefined;
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    conversationMembership?: ConversationMembershipIntent;
    memoryProposalGenerator?: MemoryProposalGenerator;
    memoryProposalProviderLabel?: string;
    onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    cognitionId?: CognitionId;
    preparation?: PreparedCognition;
}

export interface CognitionRepositories {
    state: Pick<StateStore, "load" | "commit">;
    conversation: Pick<
        ConversationContextStore,
        "load" | "activeConversation" | "startFreshConversation" | "recordAcceptedInput" | "recordCommittedExpression"
    >;
    onboarding: Pick<OnboardingWorkStore, "load" | "save">;
    memoryProposalGenerations: MemoryProposalGenerationRepository;
}

export async function runCognition(
    repositories: CognitionRepositories,
    state: EmberState,
    options: RunCognitionOptions,
): Promise<CognitionResult> {
    validateCognitionInvocation(state, options);
    const preparation =
        options.preparation ??
        (await prepareCognition(repositories, state, {
            runtimeId: options.runtimeId,
            principal: options.principal,
            scope: options.scope,
            surface: options.surface ?? "local_cli",
            text: options.text,
            ...(options.purpose === undefined ? {} : { purpose: options.purpose }),
            ...(options.explainIds === undefined ? {} : { explainIds: options.explainIds }),
            ...(options.conversationMembership === undefined
                ? {}
                : { conversationMembership: options.conversationMembership }),
        }));
    const committed = await runCognitionUntilExpressionCommit(repositories, state, { ...options, preparation });
    if (committed.finishPostTurn === null) return committed;
    return committed.finishPostTurn();
}

export interface CognitionResult {
    state: EmberState;
    providerFailure: string | null;
    memoryProposalFailure: string | null;
    onboardingProgressFailure: string | null;
    cognitionId: CognitionId;
    expressionText: string | null;
}

export interface CommittedCognitionResult extends CognitionResult {
    finishPostTurn: (() => Promise<CognitionResult>) | null;
}

export async function runCognitionUntilExpressionCommit(
    repositories: CognitionRepositories,
    state: EmberState,
    {
        runtimeId,
        principal,
        scope,
        surface = "local_cli",
        text,
        providerLabel: label,
        provider,
        timeoutSeconds,
        signal,
        purpose = "ordinary",
        explainIds = [],
        conversationMembership,
        memoryProposalGenerator,
        memoryProposalProviderLabel,
        onboardingProgressEvaluator,
        cognitionId: requestedCognitionId,
        preparation: suppliedPreparation,
    }: RunCognitionOptions,
): Promise<CommittedCognitionResult> {
    const store = repositories.state;
    validateCognitionInvocation(state, {
        runtimeId,
        principal,
        scope,
        surface,
        text,
        providerLabel: label,
        provider,
        timeoutSeconds,
        ...(requestedCognitionId === undefined ? {} : { cognitionId: requestedCognitionId }),
    });
    const cognitionId = requestedCognitionId ?? newId("cognition");
    const conversationStore = repositories.conversation;
    if (suppliedPreparation === undefined) {
        throw new ValidationError("cognition execution requires an already-built Ember projection");
    }
    const preparation = suppliedPreparation;
    await validatePreparation(
        preparation,
        state,
        {
            runtimeId,
            principal,
            scope,
            surface,
            text,
            purpose,
            explainIds,
            ...(conversationMembership === undefined ? {} : { conversationMembership }),
        },
        repositories,
    );
    const {
        projection,
        conversationId,
        conversationMembership: resolvedConversationMembership,
        onboardingDocument,
        onboardingWork,
        startedAt: timestamp,
    } = preparation;
    const started = cloneState(state);
    const input = userEvidence(started, principal, scope, text, { timestamp });
    findRuntime(started, runtimeId).lastDurableObservationAt = timestamp;
    started.operations.cognitionEpisodes.push({
        cognitionId: cognitionId,
        runtimeId: runtimeId,
        principal,
        activeScope: scope,
        providerLabel: label,
        purpose,
        startedAt: timestamp,
        lastDurableObservationAt: timestamp,
        status: "started",
        selectedMeaningIds: projection.selection.meaning_ids,
        selectedEvidenceIds: projection.selection.evidence_ids,
        usedMeaningIds: [],
        inputEvidenceId: input.evidenceId,
        expressionEvidenceId: null,
        deliveryStatus: "not_attempted",
        externalProviderThreadId: null,
        providerTermination: null,
    });
    state = await store.commit(state.revision, started);
    await conversationStore.recordAcceptedInput({
        conversation_id: conversationId,
        cognition_id: cognitionId,
        principal,
        scope,
        surface,
        input_evidence_id: input.evidenceId,
        started_at: timestamp,
    });
    const request: ProviderRequest = {
        contractVersion: CONTRACT_VERSION,
        cognitionId: cognitionId,
        projection,
        input: { text },
    };
    let result;
    try {
        result = await provider(request, { timeoutSeconds, signal });
    } catch (error) {
        if (!(error instanceof ProviderError)) {
            throw error;
        }
        const current = await store.load();
        if (current.revision !== state.revision) {
            throw new StaleRevision("canonical revision changed during provider failure", { cause: error });
        }
        const failed = cloneState(current);
        const cognition = findCognition(failed, cognitionId);
        const at = nowUtc();
        cognition.status = error.outcome;
        cognition.externalProviderThreadId = error.externalThreadId;
        cognition.providerTermination =
            error.termination === null
                ? null
                : {
                      reason: error.termination.reason,
                      directChildExitObserved: error.termination.directChildExitObserved,
                  };
        cognition.lastDurableObservationAt = at;
        findRuntime(failed, runtimeId).lastDurableObservationAt = at;
        state = await store.commit(current.revision, failed);
        return {
            state,
            providerFailure: error.message,
            memoryProposalFailure: null,
            onboardingProgressFailure: null,
            cognitionId,
            expressionText: null,
            finishPostTurn: null,
        };
    }

    const current = await store.load();
    if (current.revision !== state.revision) {
        throw new StaleRevision("canonical revision changed during provider call");
    }
    const completed = cloneState(current);
    const cognition = findCognition(completed, cognitionId);
    const expressionId = newId("evidence");
    const at = nowUtc();
    const expression: AgentExpressionEvidence = {
        evidenceId: expressionId,
        sourceRole: "agent_expression_via_provider",
        sourceActor: agentActor(completed.lineage.lineageId),
        assertedPrincipal: principal,
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [],
        scope,
        payloadMode: "descriptor_only",
        cognitionId: cognitionId,
        providerLabel: label,
    };
    completed.evidence.push(expression);
    Object.assign(cognition, {
        status: "completed",
        lastDurableObservationAt: at,
        usedMeaningIds: result.usedMeaningIds,
        expressionEvidenceId: expressionId,
        deliveryStatus: "pending",
        externalProviderThreadId: result.operational?.externalThreadId ?? null,
    });
    findRuntime(completed, runtimeId).lastDurableObservationAt = at;
    state = await store.commit(current.revision, completed);
    await conversationStore.recordCommittedExpression({
        cognition_id: cognitionId,
        expression_evidence_id: expressionId,
        expression_occurred_at: expression.occurredAt,
        expression_content: result.reply,
    });
    const outputText = `${result.reply}\n`;
    return {
        state,
        providerFailure: null,
        memoryProposalFailure: null,
        onboardingProgressFailure: null,
        cognitionId,
        expressionText: outputText,
        finishPostTurn: async () => {
            let onboardingProgressFailure: string | null = null;
            if (
                purpose === "ordinary" &&
                onboardingDocument?.status === "active" &&
                onboardingProgressEvaluator !== undefined
            ) {
                try {
                    const decision = await onboardingProgressEvaluator({
                        projection,
                        onboardingWork: onboardingWork!,
                        input: text,
                    });
                    await repositories.onboarding.save(
                        applyOnboardingProgressDecision(onboardingDocument, decision, input.evidenceId, nowUtc()),
                    );
                } catch (error) {
                    onboardingProgressFailure = error instanceof Error ? error.message : String(error);
                }
            }
            let memoryProposalFailure: string | null = null;
            if (purpose === "ordinary" && memoryProposalGenerator !== undefined) {
                try {
                    const reflectionContext = selectRecentConversationContext(state, await conversationStore.load(), {
                        principal,
                        scope,
                        conversationId,
                        membership: resolvedConversationMembership,
                    });
                    const reflection = await generateAndAdoptConversationMemories(
                        store,
                        repositories.memoryProposalGenerations,
                        state,
                        reflectionContext,
                        {
                            principal,
                            scope,
                            generator: memoryProposalGenerator,
                            ...(memoryProposalProviderLabel === undefined
                                ? {}
                                : { providerLabel: memoryProposalProviderLabel }),
                        },
                    );
                    state = reflection.state;
                } catch (error) {
                    memoryProposalFailure = error instanceof Error ? error.message : String(error);
                    state = await store.load();
                }
            }
            return {
                state,
                providerFailure: null,
                memoryProposalFailure,
                onboardingProgressFailure,
                cognitionId,
                expressionText: outputText,
            };
        },
    };
}

export function validateCognitionInvocation(state: EmberState, options: RunCognitionOptions) {
    requirePrincipal(state, options.principal);
    if (typeof options.providerLabel !== "string" || !options.providerLabel.trim())
        throw new ValidationError("provider label must be non-empty");
    if (
        options.cognitionId !== undefined &&
        state.operations.cognitionEpisodes.some((episode) => episode.cognitionId === options.cognitionId)
    ) {
        throw new ValidationError(`cognition already exists: ${options.cognitionId}`);
    }
}

async function validatePreparation(
    preparation: PreparedCognition,
    state: EmberState,
    expected: Pick<
        RunCognitionOptions,
        "runtimeId" | "principal" | "scope" | "surface" | "text" | "purpose" | "explainIds" | "conversationMembership"
    >,
    repositories: Pick<CognitionRepositories, "conversation" | "onboarding">,
) {
    const projection = preparation.projection;
    const runtime = findRuntime(state, expected.runtimeId);
    const surface = expected.surface ?? "local_cli";
    const purpose = expected.purpose ?? "ordinary";
    const conversationMembership = expected.conversationMembership ?? {
        action: "continue",
        basis: "ordinary_adjacency",
    };
    const conversationContext = projection.conversation_context;
    if (conversationContext === undefined) {
        throw new ValidationError("prepared cognition is missing conversation context");
    }
    if (
        conversationContext.conversation_id !== preparation.conversationId ||
        !isDeepStrictEqual(conversationContext.selection.membership, preparation.conversationMembership)
    ) {
        throw new ValidationError("prepared cognition conversation binding is inconsistent");
    }
    if (
        conversationMembership.action === "fresh"
            ? preparation.conversationMembership.action !== "started" ||
              preparation.conversationMembership.basis !== conversationMembership.basis
            : !(
                  (preparation.conversationMembership.action === "continued" &&
                      preparation.conversationMembership.basis === conversationMembership.basis) ||
                  (preparation.conversationMembership.action === "started" &&
                      preparation.conversationMembership.basis === "initial_interaction")
              )
    ) {
        throw new ValidationError("prepared cognition does not match the requested conversation membership");
    }
    const selectedConversationContext = selectRecentConversationContext(state, await repositories.conversation.load(), {
        principal: expected.principal,
        scope: expected.scope,
        conversationId: preparation.conversationId,
        membership: preparation.conversationMembership,
    });
    const loadedOnboardingDocument = purpose === "ordinary" ? await repositories.onboarding.load() : null;
    if (
        loadedOnboardingDocument !== null &&
        (loadedOnboardingDocument.lineage_id !== state.lineage.lineageId ||
            loadedOnboardingDocument.principal !== expected.principal)
    ) {
        throw new ValidationError("current onboarding work does not match the current continuity and principal");
    }
    const selectedOnboardingDocument =
        loadedOnboardingDocument?.scope === expected.scope ? loadedOnboardingDocument : null;
    if (
        purpose !== "ordinary"
            ? preparation.onboardingDocument !== null || preparation.onboardingWork !== undefined
            : preparation.onboardingDocument !== null &&
              (preparation.onboardingDocument.lineage_id !== state.lineage.lineageId ||
                  preparation.onboardingDocument.principal !== expected.principal ||
                  preparation.onboardingDocument.scope !== expected.scope)
    ) {
        throw new ValidationError("prepared cognition onboarding document does not match the current interaction");
    }
    if (!isDeepStrictEqual(preparation.onboardingDocument, selectedOnboardingDocument)) {
        throw new ValidationError("prepared cognition onboarding document is not the current repository snapshot");
    }
    const expectedOnboardingWork = projectOnboardingWork(preparation.onboardingDocument);
    const rebuilt = buildProjection(state, {
        principal: expected.principal,
        scope: expected.scope,
        surface,
        currentInput: expected.text,
        currentTime: preparation.startedAt,
        runtimeId: expected.runtimeId,
        purpose,
        explainIds: expected.explainIds ?? [],
        conversationContext: conversationContext,
        ...(expectedOnboardingWork === undefined ? {} : { onboardingWork: expectedOnboardingWork }),
    });
    if (
        preparation.onboardingWork === undefined
            ? expectedOnboardingWork !== undefined
            : !isDeepStrictEqual(preparation.onboardingWork, expectedOnboardingWork)
    ) {
        throw new ValidationError("prepared cognition onboarding work does not match its document");
    }
    if (
        !isDeepStrictEqual(conversationContext, selectedConversationContext) ||
        projection.current_time !== preparation.startedAt ||
        !isDeepStrictEqual(projection, rebuilt) ||
        !isDeepStrictEqual(projection.lineage, state.lineage) ||
        !isDeepStrictEqual(projection.recoveryAccount, runtime.recoveryAccount)
    ) {
        throw new ValidationError("prepared cognition does not match the current interaction");
    }
}

export function findCognition(state: EmberState, id: CognitionId | string): CognitionEpisode {
    const value = state.operations.cognitionEpisodes.find((c) => c.cognitionId === id);
    if (!value) {
        throw new ValidationError(`cognition does not exist: ${id}`);
    }
    return value;
}

function latestRuntime(state: EmberState): RuntimeEpisode | null {
    const runtimes = state.operations.runtimeEpisodes;
    if (!runtimes.length) {
        return null;
    }
    const referenced = new Set(
        runtimes.map((r) => r.recoveryAccount.previousRuntime).filter((id): id is RuntimeId => id !== null),
    );
    const tails = runtimes.filter((r) => !referenced.has(r.runtimeId));
    if (tails.length !== 1) {
        throw new ValidationError("runtime recovery chain has no unique current tail");
    }
    return tails[0]!;
}
