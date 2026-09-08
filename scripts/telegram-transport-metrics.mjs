#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const command = process.argv[2];

if (command === "probe") {
    const repo = resolve(requiredArg(3, "repository path"));
    const metrics = await probe(repo);
    process.stdout.write(`${JSON.stringify(metrics)}\n`);
} else if (command === "compare") {
    const baseline = resolve(requiredOption("--baseline"));
    const candidate = resolve(requiredOption("--candidate"));
    const samples = Number(option("--samples") ?? "5");
    if (!Number.isSafeInteger(samples) || samples < 1 || samples > 20)
        throw new Error("--samples must be an integer in [1, 20]");
    const result = compareSamples(runSamples(baseline, samples), runSamples(candidate, samples));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
    throw new Error(
        "usage: telegram-transport-metrics.mjs probe REPO | compare --baseline REPO --candidate REPO [--samples N]",
    );
}

async function probe(repo) {
    const [{ runTelegramPolling }, { initialState }, { StateStore }] = await Promise.all([
        import(pathToFileURL(join(repo, "src/surfaces/telegram.ts")).href),
        import(pathToFileURL(join(repo, "src/core/model.ts")).href),
        import(pathToFileURL(join(repo, "src/persistence/state-store.ts")).href),
    ]);

    const footprint = {
        node_modules_bytes: await directoryBytes(join(repo, "node_modules")),
        telegram_dependency_bytes: await directoryBytes(join(repo, "node_modules/node-telegram-bot-api")),
    };

    const idleFixture = await createFixture(repo, initialState, StateStore);
    let idleRssBytes;
    let pollingRssBytes;
    let idleShutdownMs;
    try {
        collectGarbage();
        idleRssBytes = process.memoryUsage().rss;

        const controller = new AbortController();
        const entered = deferred();
        const api = fakeApi({
            getUpdates: async (params, signal) => {
                entered.resolve();
                const pollSignal = signal ?? params?.signal;
                if (!pollSignal) throw new Error("poll signal was not supplied");
                return await new Promise((_, reject) => {
                    pollSignal.addEventListener(
                        "abort",
                        () => reject(pollSignal.reason ?? new DOMException("aborted", "AbortError")),
                        { once: true },
                    );
                });
            },
        });
        const running = runTelegramPolling(idleFixture.config, api, { signal: controller.signal });
        await entered.promise;
        await immediate();
        collectGarbage();
        pollingRssBytes = process.memoryUsage().rss;
        const started = process.hrtime.bigint();
        controller.abort(new DOMException("metric idle shutdown", "AbortError"));
        await running;
        idleShutdownMs = elapsedMs(started);
    } finally {
        await idleFixture.close();
    }

    const activeFixture = await createFixture(repo, initialState, StateStore);
    let activeShutdownMs;
    try {
        const controller = new AbortController();
        const providerEntered = deferred();
        let polls = 0;
        const api = fakeApi({
            getUpdates: async () => {
                polls += 1;
                if (polls === 1) return [telegramUpdate(501)];
                throw new Error("unexpected acknowledgement poll during active shutdown metric");
            },
        });
        const provider = async (_request, options) => {
            providerEntered.resolve();
            return await new Promise((resolveProvider, rejectProvider) => {
                const timer = setTimeout(
                    () => resolveProvider({ contractVersion: 1, reply: "metric reply", usedMeaningIds: [] }),
                    40,
                );
                options.signal?.addEventListener(
                    "abort",
                    () => {
                        clearTimeout(timer);
                        rejectProvider(options.signal.reason ?? new DOMException("aborted", "AbortError"));
                    },
                    { once: true },
                );
            });
        };
        const running = runTelegramPolling(activeFixture.config, api, { provider, signal: controller.signal });
        await providerEntered.promise;
        const started = process.hrtime.bigint();
        controller.abort(new DOMException("metric active shutdown", "AbortError"));
        await running;
        activeShutdownMs = elapsedMs(started);
    } finally {
        await activeFixture.close();
    }

    return {
        ...footprint,
        idle_rss_bytes: idleRssBytes,
        polling_rss_bytes: pollingRssBytes,
        idle_shutdown_ms: idleShutdownMs,
        active_handler_shutdown_ms: activeShutdownMs,
    };
}

function runSamples(repo, count) {
    const samples = [];
    for (let index = 0; index < count; index += 1) {
        const child = spawnSync(process.execPath, ["--expose-gc", import.meta.filename, "probe", repo], {
            cwd: repo,
            encoding: "utf8",
            env: { ...process.env, NODE_NO_WARNINGS: "1" },
        });
        if (child.status !== 0) {
            throw new Error(`metric probe failed for ${repo}: ${child.stderr || child.stdout}`);
        }
        samples.push(JSON.parse(child.stdout));
    }
    return samples;
}

function compareSamples(baselineSamples, candidateSamples) {
    const fields = Object.keys(baselineSamples[0]);
    const baseline = Object.fromEntries(
        fields.map((field) => [field, median(baselineSamples.map((sample) => sample[field]))]),
    );
    const candidate = Object.fromEntries(
        fields.map((field) => [field, median(candidateSamples.map((sample) => sample[field]))]),
    );
    const delta = Object.fromEntries(
        fields.map((field) => {
            const absolute = candidate[field] - baseline[field];
            return [
                field,
                {
                    absolute,
                    percent: baseline[field] === 0 ? null : (absolute / baseline[field]) * 100,
                },
            ];
        }),
    );
    return {
        samples: baselineSamples.length,
        environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
        },
        baseline,
        candidate,
        delta,
        raw: { baseline: baselineSamples, candidate: candidateSamples },
    };
}

async function createFixture(repo, initialState, StateStore) {
    const directory = await mkdtemp(join(tmpdir(), "ember-telegram-metrics-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState("Ember", "metrics"));
    return {
        config: {
            config_version: 1,
            state_path: statePath,
            principal: "metrics",
            activeScope: "private",
            chat_id: 424242,
            token_file: join(directory, "telegram.token"),
            poll_timeout_seconds: 30,
            provider_kind: "process",
            provider_command: "/bin/echo",
            provider_arguments: [],
            provider_timeout_seconds: 30,
            working_directory: repo,
            node_path: process.execPath,
            surface_entrypoint: join(repo, "bin/ember-telegram.ts"),
            stop_timeout_seconds: 45,
        },
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

function fakeApi(overrides = {}) {
    return {
        verifyLongPollingReady: async () => ({
            bot: { id: 1, is_bot: true, first_name: "Ember" },
            webhook: { url: "", pending_update_count: 0 },
        }),
        getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
        getWebhookInfo: async () => ({ url: "", pending_update_count: 0 }),
        getUpdates: async () => [],
        sendMessage: async () => ({
            message_id: 9501,
            date: 1_788_608_000,
            chat: { id: 424242, type: "private" },
        }),
        ...overrides,
    };
}

function telegramUpdate(updateId) {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: 424242, type: "private" },
            from: { id: 424242, is_bot: false, first_name: "Metrics" },
            text: "metric input",
        },
    };
}

async function directoryBytes(path) {
    let info;
    try {
        info = await stat(path);
    } catch (error) {
        if (error?.code === "ENOENT") return 0;
        throw error;
    }
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    let total = 0;
    for (const entry of await readdir(path, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        total += await directoryBytes(join(path, entry.name));
    }
    return total;
}

function deferred() {
    let resolvePromise;
    const promise = new Promise((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

function collectGarbage() {
    globalThis.gc?.();
}

function immediate() {
    return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

function elapsedMs(started) {
    return Number(process.hrtime.bigint() - started) / 1_000_000;
}

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function option(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}

function requiredOption(name) {
    const value = option(name);
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function requiredArg(index, label) {
    const value = process.argv[index];
    if (!value) throw new Error(`${label} is required`);
    return value;
}
