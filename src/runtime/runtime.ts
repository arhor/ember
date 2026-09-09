import type { Writable } from "node:stream";

import type {
    CognitionEpisode,
    CognitionId,
    CognitionPurpose,
    EmberExpressionEvidence,
    EmberState,
    MeaningId,
    RuntimeEpisode,
    RuntimeId,
} from "../core/model.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";

import { selectRecentConversationContext } from "../core/conversation-context.ts";
import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import { newId, nowUtc, validateState } from "../core/model.ts";
import { buildProjection, findRuntime } from "../core/projection.ts";
import { requirePrincipal, userEvidence } from "../core/semantics.ts";
import { ConversationContextStore } from "../persistence/conversation-context-store.ts";
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
                  emberCognitionDuringInterval: "not_applicable" as const,
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
                    emberCognitionDuringInterval: "none_in_supported_runtime" as const,
                    externalChangesDuringInterval: "unknown" as const,
                }
              : {
                    previousRuntime: previous.runtimeId,
                    currentRuntime: runtimeId,
                    gapKind: "uncertain_interruption_boundary" as const,
                    lastDurableObservationAt: previous.lastDurableObservationAt,
                    cleanStopAt: null,
                    restartAt: timestamp,
                    emberCognitionDuringInterval: "unknown_after_last_durable_observation" as const,
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
    output?: Writable | ((text: string) => void | Promise<void>);
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    cognitionId?: CognitionId;
    hooks?: {
        afterExpressionCommit?: (state: EmberState, outputText: string) => void | Promise<void>;
        afterDisplay?: (state: EmberState) => void | Promise<void>;
    };
}

export async function runCognition(
    store: StateStore,
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
        output = process.stdout,
        purpose = "ordinary",
        explainIds = [],
        cognitionId: requestedCognitionId,
        hooks = {},
    }: RunCognitionOptions,
): Promise<{ state: EmberState; providerFailure: string | null; cognitionId: CognitionId }> {
    requirePrincipal(state, principal);
    if (typeof label !== "string" || !label.trim()) throw new ValidationError("provider label must be non-empty");
    const cognitionId = requestedCognitionId ?? newId("cognition");
    if (state.operations.cognitionEpisodes.some((episode) => episode.cognitionId === cognitionId)) {
        throw new ValidationError(`cognition already exists: ${cognitionId}`);
    }
    const timestamp = nowUtc();
    const conversationStore = new ConversationContextStore(store.path);
    const conversationContext = selectRecentConversationContext(state, await conversationStore.load(), {
        principal,
        scope,
        surface,
    });
    const projection = buildProjection(state, {
        principal,
        scope,
        surface,
        currentInput: text,
        currentTime: timestamp,
        runtimeId,
        purpose,
        explainIds,
        conversationContext,
    });
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
        return { state, providerFailure: error.message, cognitionId };
    }

    const current = await store.load();
    if (current.revision !== state.revision) {
        throw new StaleRevision("canonical revision changed during provider call");
    }
    const completed = cloneState(current);
    const cognition = findCognition(completed, cognitionId);
    const expressionId = newId("evidence");
    const at = nowUtc();
    const expression: EmberExpressionEvidence = {
        evidenceId: expressionId,
        sourceRole: "ember_expression_via_provider",
        sourceActor: "ember",
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
    await conversationStore.recordCompletedExchange({
        cognition_id: cognitionId,
        principal,
        scope,
        surface,
        input_evidence_id: cognition.inputEvidenceId,
        expression_evidence_id: expressionId,
        started_at: cognition.startedAt,
        expression_occurred_at: expression.occurredAt,
        expression_content: result.reply,
    });
    const outputText = `${result.reply}\n`;
    await hooks.afterExpressionCommit?.(state, outputText);
    await writeOutput(output, outputText);
    await hooks.afterDisplay?.(state);
    const displayed = cloneState(state);
    const displayedCognition = findCognition(displayed, cognitionId);
    const displayedAt = nowUtc();
    displayedCognition.deliveryStatus = "displayed";
    displayedCognition.lastDurableObservationAt = displayedAt;
    findRuntime(displayed, runtimeId).lastDurableObservationAt = displayedAt;
    state = await store.commit(state.revision, displayed);
    return { state, providerFailure: null, cognitionId };
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

async function writeOutput(output: Writable | ((text: string) => void | Promise<void>), text: string) {
    if (typeof output === "function") {
        await output(text);
        return;
    }
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error | null) => {
            if (settled) {
                return;
            }
            settled = true;
            if (error) {
                setImmediate(() => output.off("error", onError));
                reject(error);
            } else {
                output.off("error", onError);
                resolve();
            }
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
