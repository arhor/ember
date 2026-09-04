import type { Writable } from "node:stream";
import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import {
    cloneState,
    type CognitionEpisode,
    type CognitionId,
    type CognitionPurpose,
    type EmberExpressionEvidence,
    type EmberState,
    type MeaningId,
    newId,
    nowUtc,
    type RuntimeEpisode,
    type RuntimeId,
    validateState,
} from "../core/model.ts";
import { buildProjection, findRuntime } from "../core/projection.ts";
import { CONTRACT_VERSION, type ProviderInvoker, type ProviderRequest } from "../providers/contract.ts";
import { invokeProvider, providerLabel } from "../providers/process.ts";
import { requirePrincipal, userEvidence } from "../core/semantics.ts";
import type { StateStore } from "../persistence/state-store.ts";

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
                  previous_runtime: null,
                  current_runtime: runtimeId,
                  gap_kind: "initial_start" as const,
                  last_durable_observation_at: null,
                  clean_stop_at: null,
                  restart_at: timestamp,
                  ember_cognition_during_interval: "not_applicable" as const,
                  external_changes_during_interval: "unknown" as const,
              }
            : previous.clean_stop_at !== null
              ? {
                    previous_runtime: previous.runtime_id,
                    current_runtime: runtimeId,
                    gap_kind: "known_clean_stop_interval" as const,
                    last_durable_observation_at: previous.last_durable_observation_at,
                    clean_stop_at: previous.clean_stop_at,
                    restart_at: timestamp,
                    ember_cognition_during_interval: "none_in_supported_runtime" as const,
                    external_changes_during_interval: "unknown" as const,
                }
              : {
                    previous_runtime: previous.runtime_id,
                    current_runtime: runtimeId,
                    gap_kind: "uncertain_interruption_boundary" as const,
                    last_durable_observation_at: previous.last_durable_observation_at,
                    clean_stop_at: null,
                    restart_at: timestamp,
                    ember_cognition_during_interval: "unknown_after_last_durable_observation" as const,
                    external_changes_during_interval: "unknown" as const,
                };
    if (previous?.clean_stop_at === null) {
        for (const cognition of candidate.operations.cognition_episodes) {
            if (cognition.runtime_id === previous.runtime_id && cognition.status === "started") {
                cognition.status = "outcome_unknown";
            }
        }
        for (const opportunity of candidate.operations.cognition_opportunities ?? []) {
            if (opportunity.runtime_id === previous.runtime_id && opportunity.status === "evaluating") {
                opportunity.status = "outcome_unknown";
                opportunity.last_durable_observation_at = timestamp;
                opportunity.provider_termination = null;
            }
        }
    }
    candidate.operations.runtime_episodes.push({
        runtime_id: runtimeId,
        principal,
        active_scope: scope,
        started_at: timestamp,
        last_durable_observation_at: timestamp,
        clean_stop_at: null,
        stop_reason: null,
        recovery_account: recovery,
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
    if (runtime.clean_stop_at !== null) {
        throw new ValidationError("runtime is already stopped");
    }
    for (const opportunity of candidate.operations.cognition_opportunities ?? []) {
        if (opportunity.runtime_id === runtime.runtime_id && opportunity.status === "evaluating") {
            opportunity.status = "outcome_unknown";
            opportunity.last_durable_observation_at = timestamp;
            opportunity.provider_termination = null;
        }
    }
    runtime.last_durable_observation_at = timestamp;
    runtime.clean_stop_at = timestamp;
    runtime.stop_reason = reason;
    validateState(candidate);
    return candidate;
}

export interface RunCognitionOptions {
    runtimeId: RuntimeId;
    principal: string;
    scope: string;
    text: string;
    command: string;
    arguments_?: string[];
    timeoutSeconds: number;
    signal?: AbortSignal;
    output?: Writable | ((text: string) => void | Promise<void>);
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    provider?: ProviderInvoker;
    hooks?: {
        afterExpressionCommit?: (state: EmberState) => void | Promise<void>;
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
        text,
        command,
        arguments_: args = [],
        timeoutSeconds,
        signal,
        output = process.stdout,
        purpose = "ordinary",
        explainIds = [],
        provider = invokeProvider,
        hooks = {},
    }: RunCognitionOptions,
): Promise<{ state: EmberState; providerFailure: string | null; cognitionId: CognitionId }> {
    requirePrincipal(state, principal);
    const timestamp = nowUtc();
    const projection = buildProjection(state, {
        principal,
        scope,
        currentInput: text,
        currentTime: timestamp,
        runtimeId,
        purpose,
        explainIds,
    });
    const cognitionId = newId("cognition");
    const label = providerLabel(command);
    const started = cloneState(state);
    const input = userEvidence(started, principal, scope, text, { timestamp });
    findRuntime(started, runtimeId).last_durable_observation_at = timestamp;
    started.operations.cognition_episodes.push({
        cognition_id: cognitionId,
        runtime_id: runtimeId,
        principal,
        active_scope: scope,
        provider_label: label,
        purpose,
        started_at: timestamp,
        last_durable_observation_at: timestamp,
        status: "started",
        selected_meaning_ids: projection.selection.meaning_ids,
        selected_evidence_ids: projection.selection.evidence_ids,
        used_meaning_ids: [],
        input_evidence_id: input.evidence_id,
        expression_evidence_id: null,
        delivery_status: "not_attempted",
        external_provider_thread_id: null,
        provider_termination: null,
    });
    state = await store.commit(state.revision, started);

    const request: ProviderRequest = {
        contract_version: CONTRACT_VERSION,
        cognition_id: cognitionId,
        projection,
        input: { text },
    };
    let result;
    try {
        result = await provider(command, args, request, { timeoutSeconds, signal });
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
        cognition.external_provider_thread_id = error.externalThreadId;
        cognition.provider_termination =
            error.termination === null
                ? null
                : {
                      reason: error.termination.reason,
                      direct_child_exit_observed: error.termination.directChildExitObserved,
                  };
        cognition.last_durable_observation_at = at;
        findRuntime(failed, runtimeId).last_durable_observation_at = at;
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
        evidence_id: expressionId,
        source_role: "ember_expression_via_provider",
        source_actor: "ember",
        asserted_principal: principal,
        occurred_at: at,
        observed_at: at,
        derived_from_evidence_ids: [],
        scope,
        payload_mode: "descriptor_only",
        cognition_id: cognitionId,
        provider_label: label,
    };
    completed.evidence.push(expression);
    Object.assign(cognition, {
        status: "completed",
        last_durable_observation_at: at,
        used_meaning_ids: result.used_meaning_ids,
        expression_evidence_id: expressionId,
        delivery_status: "pending",
        external_provider_thread_id: result.operational?.external_thread_id ?? null,
    });
    findRuntime(completed, runtimeId).last_durable_observation_at = at;
    state = await store.commit(current.revision, completed);
    await hooks.afterExpressionCommit?.(state);
    await writeOutput(output, `${result.reply}\n`);
    await hooks.afterDisplay?.(state);
    const displayed = cloneState(state);
    const displayedCognition = findCognition(displayed, cognitionId);
    const displayedAt = nowUtc();
    displayedCognition.delivery_status = "displayed";
    displayedCognition.last_durable_observation_at = displayedAt;
    findRuntime(displayed, runtimeId).last_durable_observation_at = displayedAt;
    state = await store.commit(state.revision, displayed);
    return { state, providerFailure: null, cognitionId };
}

export function findCognition(state: EmberState, id: CognitionId | string): CognitionEpisode {
    const value = state.operations.cognition_episodes.find((c) => c.cognition_id === id);
    if (!value) {
        throw new ValidationError(`cognition does not exist: ${id}`);
    }
    return value;
}

function latestRuntime(state: EmberState): RuntimeEpisode | null {
    const runtimes = state.operations.runtime_episodes;
    if (!runtimes.length) {
        return null;
    }
    const referenced = new Set(
        runtimes.map((r) => r.recovery_account.previous_runtime).filter((id): id is RuntimeId => id !== null),
    );
    const tails = runtimes.filter((r) => !referenced.has(r.runtime_id));
    if (tails.length !== 1) {
        throw new ValidationError("runtime recovery chain has no unique current tail");
    }
    return tails[0];
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
