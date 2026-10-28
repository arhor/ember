import type { Agent, InteractionEvent, InteractionOptions, InteractionResult } from "@ember/agent";

import type { ExecutionHooks, ObserverDiagnostic, RunEvent } from "./extensions.ts";
import type { RunRepository, SessionRepository } from "./repositories.ts";
import type { RunExecutor } from "./run-executor.ts";

import { DefaultAgent } from "./default-agent.ts";

type Cleanup = () => void | Promise<void>;

/** Registration capabilities exist only during the owning plugin's setup. */
export interface PluginSetup<Input, Output> {
    executor(executor: RunExecutor<Input, Output>): void;
    sessions(repository: SessionRepository): void;
    runs(repository: RunRepository): void;
    hook(hook: ExecutionHooks<Input, Output>): void;
    observe(observer: (event: RunEvent) => void | Promise<void>): void;
    onCleanup(cleanup: Cleanup): void;
}
export interface EnginePlugin<Input = unknown, Output = unknown> {
    readonly id: string;
    readonly dependencies?: readonly string[];
    setup(registration: PluginSetup<Input, Output>): void | Promise<void>;
}
export interface StartedEngine<Input = unknown, Output = unknown> extends Agent<Input, Output> {
    /** Stops admission, waits for active interactions, then releases plugins. Idempotent. */
    close(): Promise<void>;
    readonly diagnostics: readonly ObserverDiagnostic[];
}

/** Explicit startup composition, with no module discovery or runtime registration. */
export class EngineBuilder<Input = unknown, Output = unknown> {
    readonly #plugins: EnginePlugin<Input, Output>[] = [];
    #started = false;

    register(plugin: EnginePlugin<Input, Output>): this {
        if (this.#started) throw new Error("Engine registration is closed");
        if (!plugin.id.trim()) throw new Error("Plugin ID must not be empty");
        if (this.#plugins.some((item) => item.id === plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
        this.#plugins.push({
            id: plugin.id,
            setup: plugin.setup.bind(plugin),
            dependencies: [...(plugin.dependencies ?? [])],
        });
        return this;
    }

    async start(identity: string): Promise<StartedEngine<Input, Output>> {
        if (this.#started) throw new Error("Engine already started");
        this.#started = true;
        const ordered = orderPlugins(this.#plugins);
        const cleanups: Cleanup[] = [];
        const hooks: ExecutionHooks<Input, Output>[] = [];
        const observers: Array<(event: RunEvent) => void | Promise<void>> = [];
        const diagnostics: ObserverDiagnostic[] = [];
        let executor: RunExecutor<Input, Output> | undefined;
        let sessions: SessionRepository | undefined;
        let runs: RunRepository | undefined;
        try {
            for (const plugin of ordered) {
                let open = true;
                const check = () => {
                    if (!open) throw new Error(`Plugin registration is closed: ${plugin.id}`);
                };
                try {
                    await plugin.setup({
                        executor(value) {
                            check();
                            if (executor) throw new Error("Conflicting executor registration");
                            executor = value;
                        },
                        sessions(value) {
                            check();
                            if (sessions) throw new Error("Conflicting session repository registration");
                            sessions = value;
                        },
                        runs(value) {
                            check();
                            if (runs) throw new Error("Conflicting run repository registration");
                            runs = value;
                        },
                        hook(value) {
                            check();
                            hooks.push({
                                ...(value.beforeExecute ? { beforeExecute: value.beforeExecute.bind(value) } : {}),
                                ...(value.afterExecute ? { afterExecute: value.afterExecute.bind(value) } : {}),
                            });
                        },
                        observe(value) {
                            check();
                            observers.push(value);
                        },
                        onCleanup(value) {
                            check();
                            cleanups.push(value);
                        },
                    });
                } finally {
                    open = false;
                }
            }
            if (!executor) throw new Error("Engine requires an executor");
        } catch (error) {
            const failures = await cleanupAll(cleanups);
            if (failures.length)
                throw new AggregateError([error, ...failures], "Engine startup and cleanup failed", { cause: error });
            throw error;
        }
        const agent = new DefaultAgent(identity, executor, {
            ...(sessions ? { sessions } : {}),
            ...(runs ? { runs } : {}),
            hooks,
            observers,
            onDiagnostic: (diagnostic) => {
                diagnostics.push(diagnostic);
            },
        });
        const active = new Set<Promise<InteractionResult<Output>>>();
        let closing: Promise<void> | undefined;
        return {
            identity,
            get diagnostics() {
                return diagnostics.slice();
            },
            getRun: (id) => agent.getRun(id),
            handle(interaction: InteractionEvent<Input>, options?: InteractionOptions) {
                if (closing) return Promise.reject(new Error("Engine is closed"));
                const operation = agent.handle(interaction, options);
                active.add(operation);
                void operation.then(
                    () => active.delete(operation),
                    () => active.delete(operation),
                );
                return operation;
            },
            close() {
                closing ??= (async () => {
                    await Promise.allSettled([...active]);
                    const failures = await cleanupAll(cleanups);
                    if (failures.length) throw new AggregateError(failures, "Engine cleanup failed");
                })();
                return closing;
            },
        };
    }
}

function orderPlugins<Input, Output>(plugins: readonly EnginePlugin<Input, Output>[]) {
    const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
    const ordered: EnginePlugin<Input, Output>[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(plugin: EnginePlugin<Input, Output>) {
        if (visited.has(plugin.id)) return;
        if (visiting.has(plugin.id)) throw new Error(`Plugin dependency cycle: ${plugin.id}`);
        visiting.add(plugin.id);
        for (const id of plugin.dependencies ?? []) {
            const dependency = byId.get(id);
            if (!dependency) throw new Error(`Missing plugin dependency: ${id}`);
            visit(dependency);
        }
        visiting.delete(plugin.id);
        visited.add(plugin.id);
        ordered.push(plugin);
    }
    for (const plugin of plugins) visit(plugin);
    return ordered;
}
async function cleanupAll(cleanups: Cleanup[]): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const cleanup of cleanups.splice(0).reverse()) {
        try {
            await cleanup();
        } catch (error) {
            failures.push(error);
        }
    }
    return failures;
}
