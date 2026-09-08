import type { CapabilityBinding, CapabilityContext } from "./execution.ts";

import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../core/model.ts";
import { createCapabilityExecutionFirewall, createCapabilityExecutionLedger } from "./execution.ts";

const AUTHORIZED = {
    status: "authorized",
    basis: "current_instruction",
    sourceId: "test-authority",
    current: true,
} as const;

function context(): CapabilityContext {
    return {
        cognitionId: newId("cognition"),
        principal: "local-user",
        scope: "project:ember",
        surface: "test",
        validatedRevision: 1,
    };
}

function capability(overrides: Partial<CapabilityBinding> = {}): CapabilityBinding {
    return {
        name: "testCapability",
        description: "Deterministic test capability",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: { value: { type: "string" } },
            required: ["value"],
        },
        occurrencePolicy: "at_most_once_per_cognition",
        authorize: () => AUTHORIZED,
        execute: () => ({ ok: true }),
        ...overrides,
    };
}

test("capability authority denial should remain distinct from technical availability", async () => {
    let executions = 0;
    const ledger = createCapabilityExecutionLedger();
    const firewall = createCapabilityExecutionFirewall(
        [
            capability({
                authorize: () => ({ status: "denied", reason: "no current authority for this effect" }),
                execute: () => {
                    executions += 1;
                    return { ok: true };
                },
            }),
        ],
        context(),
        ledger,
    );

    const result = await firewall.execute("testCapability", { value: "x" });

    assert.equal(result.outcome, "authority_denied");
    assert.equal(result.executionAttempted, false);
    assert.equal(result.retry, "requires_new_authority_or_context");
    assert.equal(executions, 0);
    assert.deepEqual(ledger.entries, [result]);
});

test("capability semantic input rejection should prevent execution after authority succeeds", async () => {
    let executions = 0;
    const firewall = createCapabilityExecutionFirewall(
        [
            capability({
                validateInput: () => ({ status: "rejected", reason: "argument is outside the selected target set" }),
                execute: () => {
                    executions += 1;
                    return { ok: true };
                },
            }),
        ],
        context(),
    );

    const result = await firewall.execute("testCapability", { value: "x" });

    assert.equal(result.outcome, "input_rejected");
    assert.equal(result.executionAttempted, false);
    assert.deepEqual(result.authority, { basis: "current_instruction", sourceId: "test-authority" });
    assert.equal(executions, 0);
});

test("capability cancellation before execution should remain safely repeatable", async () => {
    let executions = 0;
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const firewall = createCapabilityExecutionFirewall(
        [
            capability({
                execute: () => {
                    executions += 1;
                    return { ok: true };
                },
            }),
        ],
        context(),
    );

    const result = await firewall.execute("testCapability", { value: "x" }, { signal: controller.signal });

    assert.equal(result.outcome, "cancelled_before_execution");
    assert.equal(result.executionAttempted, false);
    assert.equal(result.retry, "safe");
    assert.equal(result.interruption, "cancellation");
    assert.equal(executions, 0);
});

test("capability cancellation after execution starts should preserve uncertainty and block a second occurrence", async () => {
    const controller = new AbortController();
    let executions = 0;
    let startedResolve!: () => void;
    const started = new Promise<void>((resolve) => {
        startedResolve = resolve;
    });
    const ledger = createCapabilityExecutionLedger();
    const firewall = createCapabilityExecutionFirewall(
        [
            capability({
                execute: (_context, _input, { signal }) =>
                    new Promise((_, reject) => {
                        executions += 1;
                        startedResolve();
                        const rejectForAbort = () => reject(signal?.reason ?? new Error("cancelled"));
                        if (signal?.aborted) rejectForAbort();
                        else signal?.addEventListener("abort", rejectForAbort, { once: true });
                    }),
            }),
        ],
        context(),
        ledger,
    );

    const pending = firewall.execute("testCapability", { value: "x" }, { signal: controller.signal });
    await started;
    controller.abort(new Error("cancelled after start"));
    const result = await pending;
    const repeated = await firewall.execute("testCapability", { value: "x" });

    assert.equal(result.outcome, "outcome_unknown");
    assert.equal(result.executionAttempted, true);
    assert.equal(result.retry, "unsafe");
    assert.match(result.reason ?? "", /not proven absent/);
    assert.equal(repeated.outcome, "occurrence_blocked");
    assert.equal(repeated.executionAttempted, false);
    assert.equal(executions, 1);
    assert.deepEqual(ledger.entries, [result, repeated]);
});
