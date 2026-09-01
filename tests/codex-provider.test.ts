import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { buildCodexPrompt, codexEnvironment, invokeCodexProvider } from "../src/providers/codex.ts";
import { parseArgs } from "../src/cli/main.ts";
import { ProviderError } from "../src/core/errors.ts";
import { buildProjection } from "../src/core/projection.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { rememberPreference } from "../src/core/semantics.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { captureError, command, populatedState, PRINCIPAL, ROOT, SCOPE, tempDir } from "./support.ts";

const SCRIPTED_CODEX = join(ROOT, "test-fixtures", "providers", "scripted-codex.ts");

function requestFixture() {
    const { state } = populatedState();

    rememberPreference(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "private-marker",
        "project:private",
        "PRIVATE_CANONICAL_MARKER_46"
    );

    const started = startRuntime(state, PRINCIPAL, SCOPE, {
        timestamp: "2026-08-31T12:00:00Z",
    });
    const projection = buildProjection(started.state, {
        principal: PRINCIPAL,
        scope: SCOPE,
        currentInput: "What should I remember?",
        currentTime: "2026-08-31T12:00:01Z",
        runtimeId: started.runtimeId
    });

    return {
        state: started.state,
        runtimeId: started.runtimeId,
        request: {
            contract_version: 1,
            cognition_id: "cognition-codex-test",
            projection,
            input: { text: "What should I remember?" }
        },
    };
}

function childDouble({ output = "", error = "", exitCode = 0, closeOnKill = true } = {}) {
    const child = new EventEmitter();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const signals: unknown[] = [];

    Object.assign(child, {
        stdin,
        stdout,
        stderr,
        kill(signal: unknown) {
            signals.push(signal);
            if (closeOnKill) queueMicrotask(() => child.emit("close", null, signal));
            return true;
        },
    });

    const complete = () => queueMicrotask(() => {
        if (output) stdout.write(output);
        if (error) stderr.write(error);
        stdout.end();
        stderr.end();
        child.emit("close", exitCode, null);
    });

    return { child, stdin, signals, complete };
}

function successfulJsonl(reply = "bounded answer", usedMeaningIds = [] as string[]) {
    return [
        JSON.stringify({ type: "thread.started", thread_id: "thread-operational-46" }),
        JSON.stringify({ type: "turn.started" }),
        JSON.stringify({
            type: "item.completed",
            item: {
                type: "agent_message",
                text: JSON.stringify({ contract_version: 1, reply, used_meaning_ids: usedMeaningIds })
            }
        }),
        JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }),
        "",
    ].join("\n");
}

describe("Codex provider", () => {
    test("should disclose only the bounded request when invoked with default isolation", async () => {
        // Given
        const { request } = requestFixture();
        const used = request.projection.selection.meaning_ids[0];
        let invocation: { arguments_: string[]; options: any; schemaExists: boolean; cwdEntries: string[] };
        let prompt = "";
        const fixture = childDouble({ output: successfulJsonl("bounded answer", [used]) });

        // When
        const result = await invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            environment: {
                PATH: "/safe/bin",
                HOME: "/safe/home",
                OPENAI_API_KEY: "raw-key",
                PRIVATE_ENV_MARKER_46: "private"
            },
            spawnImpl: (_command, arguments_, options) => {
                invocation = {
                    arguments_,
                    options,
                    schemaExists: existsSync(options.cwd),
                    cwdEntries: readdirSync(options.cwd)
                };
                fixture.stdin.on("data", chunk => {
                    prompt += chunk.toString("utf8");
                });
                fixture.complete();
                return fixture.child;
            },
        });

        // Then
        assert.deepEqual(result, {
            contract_version: 1,
            reply: "bounded answer",
            used_meaning_ids: [used],
            operational: { external_thread_id: "thread-operational-46" }
        });
        assert.equal(prompt, buildCodexPrompt(request));
        assert.equal(prompt.includes("PRIVATE_CANONICAL_MARKER_46"), false);
        assert.equal(request.projection.selection.raw_transcript_included, false);
        assert.equal(invocation.options.cwd === ROOT, false);
        assert.deepEqual(invocation.cwdEntries, ["provider-result.schema.json"]);
        assert.deepEqual(invocation.options.env, { PATH: "/safe/bin", HOME: "/safe/home" });
        assert.notEqual(invocation.arguments_.findIndex((value, index) => value === "--disable" && invocation.arguments_[index + 1] === "plugins"), -1);
        assert.notEqual(invocation.arguments_.findIndex((value, index) => value === "--disable" && invocation.arguments_[index + 1] === "apps"), -1);
        assert.equal(invocation.arguments_.includes("skills.include_instructions=false"), true);
        assert.deepEqual(invocation.arguments_.slice(-3, -1), ["-C", invocation.options.cwd]);
    });

    test("should supply a supported strict result schema when invocation starts", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ output: successfulJsonl() });
        const cwd = await tempDir();
        let schema;

        // When
        await invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1, cwd, spawnImpl: (_command, arguments_) => {
                const schemaPath = arguments_[arguments_.indexOf("--output-schema") + 1];
                schema = JSON.parse(readFileSync(schemaPath, "utf8"));
                fixture.complete();
                return fixture.child;
            }
        });

        // Then
        assert.equal(schema.additionalProperties, false);
        assert.equal("uniqueItems" in schema.properties.used_meaning_ids, false);
    });

    test("should reject malformed JSONL when the child exits successfully", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ output: "not-json\n" });
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            cwd,
            spawnImpl: () => {
                fixture.complete();
                return fixture.child;
            }
        }));

        // Then
        assert.equal(error instanceof ProviderError, true);
        assert.match(error.message, /JSONL line 1 is invalid JSON/);
    });

    test("should reject an unvalidated final result when JSONL is otherwise valid", async () => {
        // Given
        const { request } = requestFixture();
        const output = successfulJsonl("bounded answer", ["meaning-outside-projection"]);
        const fixture = childDouble({ output });
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            cwd,
            spawnImpl: () => {
                fixture.complete();
                return fixture.child;
            }
        }));

        // Then
        assert.equal(error instanceof ProviderError, true);
        assert.match(error.message, /outside its projection/);
    });

    test("should reject success when resumed thread differs from requested thread", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ output: successfulJsonl() });
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            cwd,
            thread: { mode: "resume", externalThreadId: "requested-thread-54" },
            spawnImpl: () => {
                fixture.complete();
                return fixture.child;
            },
        }));

        // Then
        assert.equal(error instanceof ProviderError, true);
        assert.match(error.message, /resumed a different thread than requested/);
    });

    test("should terminate boundedly when JSONL exceeds the output limit", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ output: "x".repeat(1024 * 1024 + 1), closeOnKill: true });
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            cwd,
            terminationGraceMs: 5,
            finalTerminationMs: 20,
            spawnImpl: () => {
                fixture.complete();
                return fixture.child;
            }
        }));

        // Then
        assert.equal(error instanceof ProviderError, true);
        assert.match(error.message, /exceeds 1 MiB/);
        assert.deepEqual(fixture.signals, ["SIGTERM"]);
    });

    test("should retain only bounded stderr when the runtime fails noisily", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ error: "diagnostic".repeat(10_000), exitCode: 2 });
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            cwd,
            spawnImpl: () => {
                fixture.complete();
                return fixture.child;
            }
        }));

        // Then
        assert.equal(error instanceof ProviderError, true);
        assert.ok(error.message.length <= 64 * 1024 + 100);
    });

    test("should report timeout without retry when the direct child exit is observed", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ closeOnKill: true });
        let spawnCount = 0;
        const cwd = await tempDir();

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 0.005,
            cwd,
            terminationGraceMs: 5,
            finalTerminationMs: 20,
            spawnImpl: () => {
                spawnCount += 1;
                return fixture.child;
            }
        }));

        // Then
        assert.deepEqual([error.outcome, error.terminationConfirmed, error.termination, spawnCount, fixture.signals], ["timed_out", true, {
            reason: "timeout",
            directChildExitObserved: true
        }, 1, ["SIGTERM"]]);
        assert.match(error.message, /remote work or effects remain unconfirmed/);
    });

    test("should distinguish explicit cancellation when the direct child exit is observed", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ closeOnKill: true });
        const controller = new AbortController();
        const cwd = await tempDir();
        queueMicrotask(() => controller.abort());

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            signal: controller.signal,
            cwd,
            terminationGraceMs: 5,
            finalTerminationMs: 20,
            spawnImpl: () => fixture.child
        }));

        // Then
        assert.deepEqual([error.outcome, error.terminationConfirmed, error.termination, fixture.signals], ["cancellation_requested", true, {
            reason: "explicit_cancellation",
            directChildExitObserved: true
        }, ["SIGTERM"]]);
    });

    test("should preserve ambiguous termination when direct child exit is not observed", async () => {
        // Given
        const { request } = requestFixture();
        const fixture = childDouble({ closeOnKill: false });
        const controller = new AbortController();
        const cwd = await tempDir();
        queueMicrotask(() => controller.abort());

        // When
        const error = await captureError(() => invokeCodexProvider("codex", [], request, {
            timeoutSeconds: 1,
            signal: controller.signal,
            cwd,
            terminationGraceMs: 5,
            finalTerminationMs: 20,
            spawnImpl: () => fixture.child
        }));

        // Then
        assert.deepEqual([error.outcome, error.terminationConfirmed, error.termination, fixture.signals], ["outcome_unknown", false, {
            reason: "explicit_cancellation",
            directChildExitObserved: false
        }, ["SIGTERM", "SIGKILL"]]);
    });
});

describe("Codex environment", () => {
    test("should omit credentials and unrelated ambient values when runtime authentication is reused", () => {
        // Given
        const source = {
            PATH: "/bin",
            HOME: "/home/user",
            CODEX_HOME: "/home/user/.codex",
            OPENAI_API_KEY: "secret",
            GH_TOKEN: "secret",
            HTTPS_PROXY: "https://credential@example.test"
        };

        // When
        const environment = codexEnvironment(source);

        // Then
        assert.deepEqual(environment, { PATH: "/bin", HOME: "/home/user", CODEX_HOME: "/home/user/.codex" });
    });
});

describe("runCognition", () => {
    test("should retain external thread ID only as operational episode evidence when Codex completes", async () => {
        // Given
        const { state, runtimeId } = requestFixture();
        const directory = await tempDir();
        const store = new StateStore(`${directory}/ember.json`);
        await store.create(state);
        const lease = await store.acquireWriteLease();
        const loaded = await store.load();
        const provider = async (_command, _arguments, request) => ({
            contract_version: 1,
            reply: "transient reply",
            used_meaning_ids: request.projection.selection.meaning_ids,
            operational: { external_thread_id: "thread-operational-46" }
        });

        // When
        const result = await runCognition(store, loaded, {
            runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "hello",
            command: "codex",
            timeoutSeconds: 1,
            provider,
            output: () => {
            }
        });
        const serialized = JSON.stringify(result.state);
        await store.releaseWriteLease(lease);

        // Then
        assert.equal(result.state.operations.cognition_episodes.at(-1).external_provider_thread_id, "thread-operational-46");
        assert.equal(result.state.meanings.some(meaning => JSON.stringify(meaning).includes("thread-operational-46")), false);
        assert.equal(serialized.includes("transient reply"), false);
    });

    test("should persist cancellation request distinctly when Codex termination is observed", async () => {
        // Given
        const { state, runtimeId } = requestFixture();
        const directory = await tempDir();
        const store = new StateStore(`${directory}/ember.json`);
        await store.create(state);
        const lease = await store.acquireWriteLease();
        const loaded = await store.load();
        const provider = async () => {
            throw new ProviderError("cancellation requested", {
                outcome: "cancellation_requested",
                externalThreadId: "thread-operational-46",
                termination: { reason: "explicit_cancellation", directChildExitObserved: true }
            });
        };

        // When
        const result = await runCognition(store, loaded, {
            runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "cancel this turn",
            command: "codex",
            timeoutSeconds: 1,
            provider,
            output: () => {
            }
        });
        await store.releaseWriteLease(lease);

        // Then
        assert.deepEqual([result.state.operations.cognition_episodes.at(-1).status, result.state.operations.cognition_episodes.at(-1).external_provider_thread_id, result.state.operations.cognition_episodes.at(-1).provider_termination], ["cancellation_requested", "thread-operational-46", {
            reason: "explicit_cancellation",
            direct_child_exit_observed: true
        }]);
        assert.equal(result.state.operations.cognition_episodes.at(-1).expression_evidence_id, null);
    });
});

describe("CLI parser", () => {
    test("should select the production Codex backend when the supported provider flag is used", () => {
        // Given
        const arguments_ = ["run", "--state", "/tmp/ember.json", "--principal", PRINCIPAL, "--scope", SCOPE, "--provider", "codex", "--provider-timeout-seconds", "120"];

        // When
        const parsed = parseArgs(arguments_);

        // Then
        assert.equal(parsed.command, "run");
        assert.deepEqual(parsed, {
            command: "run",
            state: "/tmp/ember.json",
            principal: PRINCIPAL,
            scope: SCOPE,
            providerKind: "codex",
            providerCommand: "codex",
            providerArgs: [],
            providerTimeoutSeconds: 120
        });
    });

    test("should preserve runtime-owned authentication overrides when Codex uses a non-default store", () => {
        // Given
        const arguments_ = ["run", "--state", "/tmp/ember.json", "--principal", PRINCIPAL, "--scope", SCOPE, "--provider", "codex", "--codex-arg", "-c", "--codex-arg", 'cli_auth_credentials_store="keyring"', "--provider-timeout-seconds", "120"];

        // When
        const parsed = parseArgs(arguments_);

        // Then
        assert.deepEqual(parsed.providerArgs, ["-c", 'cli_auth_credentials_store="keyring"']);
    });
});

describe("CLI run", () => {
    test("should complete bounded cognition when the production Codex backend is selected", async () => {
        // Given
        const directory = await tempDir();
        const statePath = join(directory, "ember.json");
        await command(["init", "--state", statePath, "--name", "Ember", "--principal", PRINCIPAL]);

        // When
        const executed = await command(["run", "--state", statePath, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider", "codex", "--codex-command", process.execPath, "--codex-arg", SCRIPTED_CODEX, "--provider-timeout-seconds", "2"], {
            stdin: "hello through Codex\n:quit\n",
            env: { PRIVATE_ENV_MARKER_46: "must-not-be-forwarded" }
        });
        const state = JSON.parse(await readFile(statePath, "utf8"));
        const cognition = state.operations.cognition_episodes.at(-1);

        // Then
        assert.deepEqual([executed.code, executed.stdout.includes("CODEX_CLI_RESPONSE"), cognition.status, cognition.delivery_status, cognition.external_provider_thread_id], [0, true, "completed", "displayed", "thread-cli-46"]);
        assert.equal(JSON.stringify(state).includes("CODEX_CLI_RESPONSE"), false);
    });
});
