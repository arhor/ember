import { isDeepStrictEqual } from "node:util";

import type { AiExecutionRequest, AiExecutor, CapabilitySelector } from "../ai/contract.ts";
import type { CapabilityExecutionLedger } from "../capabilities/execution.ts";
import type { ConversationMembershipIntent } from "../core/interaction-contract.ts";
import type {
    CognitionEpisode,
    CognitionId,
    CognitionPurpose,
    AgentExpressionEvidence,
    EmberState,
    MeaningId,
    RuntimeId,
} from "../core/model.ts";
import type { ConversationContextStore } from "../persistence/conversation-context-store.ts";
import type { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { PreparedCognition } from "./cognition-preparation.ts";

import { AI_EXECUTION_CONTRACT_VERSION, MAX_AI_TIMEOUT_SECONDS } from "../ai/contract.ts";
import { selectRecentConversationContext } from "../core/conversation-context.ts";
import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import { agentActor, newId, nowUtc } from "../core/model.ts";
import { projectOnboardingWork } from "../core/onboarding-work.ts";
import { buildProjection, findRuntime } from "../core/projection.ts";
import { requirePrincipal, userEvidence } from "../core/semantics.ts";
import { cloneState } from "../core/util.ts";
import { prepareCognition } from "./cognition-preparation.ts";

export interface RunCognitionOptions {
    runtimeId: RuntimeId;
    principal: string;
    scope: string;
    surface?: string;
    text: string;
    providerLabel: string;
    executor: AiExecutor;
    selectCapabilities?: CapabilitySelector | undefined;
    capabilityLedger?: CapabilityExecutionLedger | undefined;
    timeoutSeconds: number;
    signal?: AbortSignal | undefined;
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    trustedHostSetupAvailable?: boolean;
    conversationMembership?: ConversationMembershipIntent;
    cognitionId?: CognitionId;
    preparation?: PreparedCognition;
}

export interface CognitionRepositories {
    state: Pick<StateStore, "load" | "commit">;
    conversation: Pick<
        ConversationContextStore,
        "load" | "activeConversation" | "startFreshConversation" | "recordAcceptedInput" | "recordCommittedExpression"
    >;
    onboarding: Pick<OnboardingWorkStore, "load">;
}

export async function executeCognition(
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
    return executePreparedCognition(repositories, state, { ...options, preparation });
}

export interface CognitionResult {
    state: EmberState;
    providerFailure: string | null;
    cognitionId: CognitionId;
    expressionText: string | null;
    setupIntent?: "telegram" | null;
}

export type CommittedCognitionResult = CognitionResult;
export type PreparedCognitionOptions = RunCognitionOptions & { preparation: PreparedCognition };

export async function executePreparedCognition(
    repositories: CognitionRepositories,
    state: EmberState,
    {
        runtimeId,
        principal,
        scope,
        surface = "local_cli",
        text,
        providerLabel: label,
        executor,
        selectCapabilities,
        capabilityLedger,
        timeoutSeconds,
        signal,
        purpose = "ordinary",
        explainIds = [],
        trustedHostSetupAvailable = false,
        conversationMembership,
        cognitionId: requestedCognitionId,
        preparation: suppliedPreparation,
    }: PreparedCognitionOptions,
): Promise<CommittedCognitionResult> {
    const store = repositories.state;
    validateCognitionInvocation(state, {
        runtimeId,
        principal,
        scope,
        surface,
        text,
        providerLabel: label,
        executor,
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
    const { projection, conversationId, startedAt: timestamp } = preparation;
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
    const request: AiExecutionRequest = {
        contractVersion: AI_EXECUTION_CONTRACT_VERSION,
        cognitionId: cognitionId,
        projection,
        input: { text },
    };
    let result;
    try {
        const capabilities = await resolveCapabilities(selectCapabilities, request, timeoutSeconds, signal);
        result = await executor(request, { timeoutSeconds, signal, capabilities, capabilityLedger });
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
            cognitionId,
            expressionText: null,
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
    const expressionContent = `${result.reply}${result.setupIntent === "telegram" && !trustedHostSetupAvailable ? "\nTo continue, open Ember on the trusted local host and ask to set up Telegram there. Enter the bot token locally, never in chat." : ""}`;
    await conversationStore.recordCommittedExpression({
        cognition_id: cognitionId,
        expression_evidence_id: expressionId,
        expression_occurred_at: expression.occurredAt,
        expression_content: expressionContent,
    });
    const outputText = `${expressionContent}\n`;
    return {
        state,
        ...(result.setupIntent === undefined ? {} : { setupIntent: result.setupIntent }),
        providerFailure: null,
        cognitionId,
        expressionText: outputText,
    };
}

async function resolveCapabilities(
    selectCapabilities: CapabilitySelector | undefined,
    request: AiExecutionRequest,
    timeoutSeconds: number,
    callerSignal?: AbortSignal,
) {
    if (selectCapabilities === undefined) return [];
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_AI_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_AI_TIMEOUT_SECONDS} seconds`);
    if (callerSignal?.aborted) throw capabilitySelectionCancellation();

    const timeoutMilliseconds = Math.max(1, Math.ceil(timeoutSeconds * 1000));
    const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
    const selectionSignal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(selectionSignal.reason);
        selectionSignal.addEventListener("abort", onAbort, { once: true });
    });

    try {
        return await Promise.race([selectCapabilities(request, { signal: selectionSignal }), aborted]);
    } catch (error) {
        if (callerSignal?.aborted) throw capabilitySelectionCancellation();
        if (timeoutSignal.aborted)
            throw new ProviderError("capability selection timed out before AI invocation", { outcome: "timed_out" });
        if (error instanceof ProviderError) throw error;
        throw new ProviderError("capability selection failed before AI invocation", { cause: error });
    } finally {
        if (onAbort !== undefined) selectionSignal.removeEventListener("abort", onAbort);
    }
}

function capabilitySelectionCancellation() {
    return new ProviderError("capability selection was cancelled before AI invocation", {
        outcome: "cancellation_requested",
        terminationConfirmed: false,
    });
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
