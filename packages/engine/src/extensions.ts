import type { InteractionEvent, Run } from "@ember/agent";

import type { RunContext } from "./run-executor.ts";

export interface ExecutionHookContext<Input> {
    readonly interaction: InteractionEvent<Input>;
    readonly context: RunContext;
}
export interface ExecutionHooks<Input = unknown, Output = unknown> {
    beforeExecute?(context: ExecutionHookContext<Input>): void | Promise<void>;
    afterExecute?(context: ExecutionHookContext<Input>, output: Output): void | Promise<void>;
}
export interface RunEvent {
    readonly type: "run-state";
    readonly run: Run;
}
export interface ObserverDiagnostic {
    readonly event: RunEvent;
    readonly error: unknown;
}
export interface ExecutionExtensions<Input = unknown, Output = unknown> {
    readonly hooks?: readonly ExecutionHooks<Input, Output>[];
    readonly observers?: readonly ((event: RunEvent) => void | Promise<void>)[];
    readonly onDiagnostic?: (diagnostic: ObserverDiagnostic) => void | Promise<void>;
}

export async function notifyRun<Input, Output>(extensions: ExecutionExtensions<Input, Output>, run: Run) {
    const event: RunEvent = Object.freeze({ type: "run-state", run: Object.freeze({ ...run }) });
    for (const observer of extensions.observers ?? []) {
        try {
            await observer(event);
        } catch (error) {
            try {
                await extensions.onDiagnostic?.({ event, error });
            } catch {
                // Diagnostics are observational too; execution truth remains unchanged.
            }
        }
    }
}
