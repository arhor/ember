import type { CognitionId } from "../core/model.ts";

export const MAX_CAPABILITY_OUTPUT_BYTES = 8 * 1024;

export type CapabilityJsonValue =
    | null
    | boolean
    | number
    | string
    | CapabilityJsonValue[]
    | { [key: string]: CapabilityJsonValue };

export interface CapabilityContext {
    cognitionId: CognitionId;
    principal: string;
    scope: string;
    surface: string;
    validatedRevision: number;
}

export interface CapabilityAuthorityGrant {
    status: "authorized";
    basis: "current_instruction" | "standing_authority" | "fresh_approval";
    sourceId: string;
    current: true;
}

export type CapabilityAuthorityDecision =
    | CapabilityAuthorityGrant
    | { status: "approval_required"; reason: string }
    | { status: "denied"; reason: string };

export type CapabilityInputDecision = { status: "allowed" } | { status: "rejected"; reason: string };

export interface CapabilityBinding {
    name: string;
    description: string;
    inputSchema: Readonly<Record<string, unknown>>;
    occurrencePolicy: "at_most_once_per_cognition";
    authorize: (
        context: CapabilityContext,
        input: unknown,
    ) => CapabilityAuthorityDecision | Promise<CapabilityAuthorityDecision>;
    validateInput?: (
        context: CapabilityContext,
        input: unknown,
    ) => CapabilityInputDecision | Promise<CapabilityInputDecision>;
    execute: (
        context: CapabilityContext,
        input: unknown,
        options: { signal?: AbortSignal },
    ) => CapabilityJsonValue | Promise<CapabilityJsonValue>;
}

export type CapabilityExecutionOutcome =
    | "succeeded"
    | "authority_denied"
    | "approval_required"
    | "input_rejected"
    | "occurrence_blocked"
    | "cancelled_before_execution"
    | "failed"
    | "outcome_unknown";

export type CapabilityRetryDisposition = "safe" | "unsafe" | "requires_new_authority_or_context";

export interface CapabilityExecutionEvidence {
    kind: "capability_execution_evidence";
    cognitionId: CognitionId;
    capability: string;
    outcome: CapabilityExecutionOutcome;
    executionAttempted: boolean;
    retry: CapabilityRetryDisposition;
    authority?: Pick<CapabilityAuthorityGrant, "basis" | "sourceId">;
    interruption?: "cancellation" | "timeout";
    reason?: string;
    output?: CapabilityJsonValue;
}

export interface CapabilityExecutionLedger {
    readonly entries: readonly CapabilityExecutionEvidence[];
    record(evidence: CapabilityExecutionEvidence): void;
}

export function createCapabilityExecutionLedger(): CapabilityExecutionLedger {
    const entries: CapabilityExecutionEvidence[] = [];
    return {
        entries,
        record(evidence) {
            entries.push(evidence);
        },
    };
}

export function createCapabilityExecutionFirewall(
    capabilities: readonly CapabilityBinding[],
    context: CapabilityContext,
    ledger?: CapabilityExecutionLedger,
) {
    const selected = new Map<string, CapabilityBinding>();
    for (const capability of capabilities) {
        validateCapabilityDefinition(capability);
        if (selected.has(capability.name)) {
            throw new Error(`duplicate capability name: ${capability.name}`);
        }
        selected.set(capability.name, capability);
    }

    const attempted = new Set<string>();

    return {
        async execute(name: string, input: unknown, { signal }: { signal?: AbortSignal } = {}) {
            const capability = selected.get(name);
            if (!capability) {
                throw new Error(`capability is not selected for this cognition: ${name}`);
            }

            if (signal?.aborted) {
                return record(
                    ledger,
                    evidence(context, capability.name, "cancelled_before_execution", false, "safe", {
                        interruption: interruption(signal),
                        reason: "cancellation or timeout was observed before capability execution began",
                    }),
                );
            }

            const authority = await capability.authorize(context, input);
            if (authority.status === "denied") {
                return record(
                    ledger,
                    evidence(context, capability.name, "authority_denied", false, "requires_new_authority_or_context", {
                        reason: authority.reason,
                    }),
                );
            }
            if (authority.status === "approval_required") {
                return record(
                    ledger,
                    evidence(
                        context,
                        capability.name,
                        "approval_required",
                        false,
                        "requires_new_authority_or_context",
                        {
                            reason: authority.reason,
                        },
                    ),
                );
            }

            const inputDecision = (await capability.validateInput?.(context, input)) ?? { status: "allowed" as const };
            if (inputDecision.status === "rejected") {
                return record(
                    ledger,
                    evidence(context, capability.name, "input_rejected", false, "requires_new_authority_or_context", {
                        authority: authorityEvidence(authority),
                        reason: inputDecision.reason,
                    }),
                );
            }

            if (signal?.aborted) {
                return record(
                    ledger,
                    evidence(context, capability.name, "cancelled_before_execution", false, "safe", {
                        authority: authorityEvidence(authority),
                        interruption: interruption(signal),
                        reason: "cancellation or timeout was observed before capability execution began",
                    }),
                );
            }

            if (attempted.has(capability.name)) {
                return record(
                    ledger,
                    evidence(context, capability.name, "occurrence_blocked", false, "unsafe", {
                        authority: authorityEvidence(authority),
                        reason: "capability occurrence policy permits at most one execution attempt per cognition",
                    }),
                );
            }
            attempted.add(capability.name);

            try {
                const output = await capability.execute(context, input, { signal });
                const bounded = boundOutput(output);
                return record(
                    ledger,
                    evidence(context, capability.name, "succeeded", true, "unsafe", {
                        authority: authorityEvidence(authority),
                        output: bounded,
                    }),
                );
            } catch (error) {
                if (signal?.aborted) {
                    return record(
                        ledger,
                        evidence(context, capability.name, "outcome_unknown", true, "unsafe", {
                            authority: authorityEvidence(authority),
                            interruption: interruption(signal),
                            reason: "execution began before cancellation or timeout; completion and effects are not proven absent",
                        }),
                    );
                }
                return record(
                    ledger,
                    evidence(context, capability.name, "failed", true, "unsafe", {
                        authority: authorityEvidence(authority),
                        reason: `capability execution failed after attempt began: ${errorMessage(error)}`,
                    }),
                );
            }
        },
    };
}

function evidence(
    context: CapabilityContext,
    capability: string,
    outcome: CapabilityExecutionOutcome,
    executionAttempted: boolean,
    retry: CapabilityRetryDisposition,
    extra: Omit<
        CapabilityExecutionEvidence,
        "kind" | "cognitionId" | "capability" | "outcome" | "executionAttempted" | "retry"
    > = {},
): CapabilityExecutionEvidence {
    return {
        kind: "capability_execution_evidence",
        cognitionId: context.cognitionId,
        capability,
        outcome,
        executionAttempted,
        retry,
        ...extra,
    };
}

function authorityEvidence(authority: CapabilityAuthorityGrant) {
    return { basis: authority.basis, sourceId: authority.sourceId };
}

function record(ledger: CapabilityExecutionLedger | undefined, evidence: CapabilityExecutionEvidence) {
    ledger?.record(evidence);
    return evidence;
}

function interruption(signal: AbortSignal): "cancellation" | "timeout" {
    return signal.reason instanceof Error && signal.reason.name === "TimeoutError" ? "timeout" : "cancellation";
}

function boundOutput(output: CapabilityJsonValue): CapabilityJsonValue {
    const serialized = JSON.stringify(output);
    if (serialized === undefined) {
        throw new Error("capability output must be JSON serializable");
    }
    if (Buffer.byteLength(serialized, "utf8") > MAX_CAPABILITY_OUTPUT_BYTES) {
        throw new Error(`capability output exceeds ${MAX_CAPABILITY_OUTPUT_BYTES} bytes`);
    }
    return output;
}

function validateCapabilityDefinition(capability: CapabilityBinding) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(capability.name)) {
        throw new Error(`invalid capability name: ${capability.name}`);
    }
    if (!capability.description.trim()) {
        throw new Error(`capability description must be non-empty: ${capability.name}`);
    }
    if (capability.occurrencePolicy !== "at_most_once_per_cognition") {
        throw new Error(`unsupported occurrence policy for capability: ${capability.name}`);
    }
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
