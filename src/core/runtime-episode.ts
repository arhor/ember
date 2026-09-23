import type { EmberState, RuntimeEpisode, RuntimeId } from "./model.ts";

import { cloneState } from "../util.ts";
import { ValidationError } from "./errors.ts";
import { newId, nowUtc, validateState } from "./model.ts";
import { findRuntime } from "./projection.ts";
import { requirePrincipal } from "./semantics.ts";

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
        runtimeId,
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

function latestRuntime(state: EmberState): RuntimeEpisode | null {
    const runtimes = state.operations.runtimeEpisodes;
    if (!runtimes.length) {
        return null;
    }
    const referenced = new Set(
        runtimes.map((runtime) => runtime.recoveryAccount.previousRuntime).filter((id): id is RuntimeId => id !== null),
    );
    const tails = runtimes.filter((runtime) => !referenced.has(runtime.runtimeId));
    if (tails.length !== 1) {
        throw new ValidationError("runtime recovery chain has no unique current tail");
    }
    return tails[0]!;
}
