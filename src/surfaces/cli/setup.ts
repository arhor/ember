import { lstat, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import type { EmberState } from "../../core/model.ts";
import type { ProviderInvoker } from "../../providers/contract.ts";
import type { CliIo, ConfiguredRunArgs, SetupArgs, SetupIntent } from "./model.ts";

import { ProviderError, ValidationError } from "../../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, initialState, isRfc3339Utc, newId, nowUtc } from "../../core/model.ts";
import { createOnboardingWork } from "../../core/onboarding-work.ts";
import { buildProjection } from "../../core/projection.ts";
import { createProviderMemoryProposalGenerator } from "../../memory/provider-memory-proposal-generator.ts";
import { replaceFileDurably } from "../../persistence/file-replacement.ts";
import { OnboardingWorkStore } from "../../persistence/onboarding-work-store.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { createCodexProvider } from "../../providers/codex.ts";
import { validateProviderResult } from "../../providers/contract.ts";
import { createCursorProvider } from "../../providers/cursor.ts";
import { startRuntime } from "../../runtime/runtime.ts";
import { exactKeys, isObject } from "../../util.ts";
import { runCliSurface } from "./surface.ts";

export interface SetupProvider {
    kind: "codex" | "cursor" | "claude-code";
    command: string;
    model: string;
    timeoutSeconds: number;
}

export interface SetupConfig {
    version: 1;
    intent: SetupIntent;
    statePath: string;
    principal: string;
    lineageId: string;
    establishedAt: string;
    provider: SetupProvider;
    verification:
        | "not_attempted"
        | "requested"
        | "verified"
        | "failed"
        | "timed_out"
        | "cancellation_requested"
        | "outcome_unknown";
    continuity: "pending" | "requested" | "available" | "outcome_unknown";
    cancellationRequested: boolean;
    updatedAt: string;
}

type SetupDependencies = {
    provider?: (config: SetupProvider) => ProviderInvoker;
    signal?: AbortSignal;
    persistConfig?: (path: string, config: SetupConfig) => Promise<void>;
};

export function defaultSetupConfigPath(): string {
    return join(homedir(), ".ember", "config", "setup.json");
}

function defaultSetupStatePath(): string {
    return join(homedir(), ".ember", "state", "continuity.json");
}

export function setupProvider(config: SetupProvider): ProviderInvoker {
    if (config.kind === "claude-code")
        return async (request, options) => {
            const { createClaudeCodeProvider } = await import("../../providers/claude-code.ts");
            return await createClaudeCodeProvider(config.model ? { model: config.model } : {})(request, options);
        };
    const options = { command: config.command, arguments_: config.model ? ["--model", config.model] : [] };
    return config.kind === "codex" ? createCodexProvider(options) : createCursorProvider(options);
}

export async function loadSetupConfig(path: string): Promise<SetupConfig | null> {
    let text: string;
    try {
        text = await readFile(path, "utf8");
    } catch (error) {
        if (hasCode(error, "ENOENT")) return null;
        throw new ValidationError("cannot read machine-local setup configuration");
    }
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new ValidationError("invalid machine-local setup JSON; preserve it for recovery");
    }
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "version",
            "intent",
            "statePath",
            "principal",
            "lineageId",
            "establishedAt",
            "provider",
            "verification",
            "continuity",
            "cancellationRequested",
            "updatedAt",
        ]) ||
        value.version !== 1 ||
        typeof value.cancellationRequested !== "boolean" ||
        typeof value.intent !== "string" ||
        !["create-new", "restore-existing", "use-existing"].includes(String(value.intent)) ||
        !safeText(value.statePath) ||
        !isAbsolute(value.statePath) ||
        !safeText(value.principal) ||
        !safeText(value.lineageId) ||
        !value.lineageId.startsWith("lineage-") ||
        !isRfc3339Utc(value.establishedAt) ||
        !isRfc3339Utc(value.updatedAt) ||
        typeof value.verification !== "string" ||
        ![
            "not_attempted",
            "requested",
            "verified",
            "failed",
            "timed_out",
            "cancellation_requested",
            "outcome_unknown",
        ].includes(String(value.verification)) ||
        typeof value.continuity !== "string" ||
        !["pending", "requested", "available", "outcome_unknown"].includes(String(value.continuity)) ||
        !isObject(value.provider) ||
        !exactKeys(value.provider, ["kind", "command", "model", "timeoutSeconds"])
    )
        throw new ValidationError("invalid machine-local setup configuration; preserve it for recovery");
    validateSetupProvider(value.provider);
    return value as unknown as SetupConfig;
}

function validateSetupProvider(value: Record<string, unknown>): void {
    if (
        typeof value.kind !== "string" ||
        !["codex", "cursor", "claude-code"].includes(String(value.kind)) ||
        !safeText(value.command) ||
        typeof value.model !== "string" ||
        (value.model !== "" && !safeText(value.model)) ||
        typeof value.timeoutSeconds !== "number" ||
        !Number.isFinite(value.timeoutSeconds) ||
        value.timeoutSeconds <= 0 ||
        value.timeoutSeconds > 120 ||
        (value.kind === "claude-code" && value.command !== "claude-code")
    )
        throw new ValidationError(
            "setup provider requires codex, cursor, or claude-code and a timeout in (0, 120] seconds",
        );
}

function safeText(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 4096 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}

function validateLocalPath(path: string, label: string): void {
    if (!isAbsolute(path) || !safeText(path))
        throw new ValidationError(`${label} path must be absolute and contain no control characters`);
}

async function exists(path: string): Promise<boolean> {
    try {
        await lstat(path);
        return true;
    } catch (error) {
        if (hasCode(error, "ENOENT")) return false;
        throw error;
    }
}

function hasCode(error: unknown, code: string): boolean {
    return isObject(error) && error.code === code;
}

// Resolve parent aliases even for not-yet-created files before comparing destinations.
async function physicalPath(path: string): Promise<string> {
    try {
        return await realpath(path);
    } catch (error) {
        if (!hasCode(error, "ENOENT")) throw error;
        const parent = dirname(path);
        if (parent === path) throw error;
        return join(await physicalPath(parent), basename(path));
    }
}

async function writeConfig(path: string, config: SetupConfig): Promise<void> {
    config.updatedAt = nowUtc();
    await replaceFileDurably(path, `${JSON.stringify(config, null, 2)}\n`, {
        durabilityUncertainMessage: "setup configuration may be visible; inspect it before retrying",
    });
}

export async function setupMain(args: SetupArgs, io: CliIo, dependencies: SetupDependencies = {}): Promise<number> {
    if (args.help) {
        io.output.write(SETUP_HELP);
        return 0;
    }
    const requestedConfigPath = resolve(args.config ?? defaultSetupConfigPath());
    validateLocalPath(requestedConfigPath, "setup configuration");
    const configPath = await physicalPath(requestedConfigPath);
    validateLocalPath(configPath, "setup configuration");
    const existing = await loadSetupConfig(configPath);
    const requestedStatePath = resolve(args.state ?? existing?.statePath ?? defaultSetupStatePath());
    validateLocalPath(requestedStatePath, "continuity state");
    const statePath = await physicalPath(requestedStatePath);
    validateLocalPath(statePath, "continuity state");
    if (configPath === statePath || configPath.startsWith(`${statePath}.`) || statePath.startsWith(`${configPath}.`))
        throw new ValidationError("setup configuration and canonical state/sidecars must have separate paths");
    const store = new StateStore(statePath);
    const state = (await exists(statePath)) ? await store.load() : null;
    io.output.write(
        `Machine configuration: ${existing ? "present" : "absent"}; continuity: ${state ? "loadable" : "absent"}.\n`,
    );
    if (existing && (existing.statePath !== statePath || (args.principal && args.principal !== existing.principal)))
        throw new ValidationError(
            "existing setup binding is preserved; use a separate --config and --state for another lineage",
        );
    if (existing && state) assertBinding(existing, state);
    if (!args.intent) {
        if (existing)
            io.output.write(
                `Last probe: ${existing.verification}; continuity operation: ${existing.continuity}. This inspection does not reverify cognition.\n`,
            );
        io.output.write(SETUP_HELP);
        return 0;
    }
    const intent = args.intent;
    if (existing && intent !== "use-existing" && intent !== existing.intent)
        throw new ValidationError("existing setup intent is preserved; use use-existing or a separate configuration");
    if (intent === "create-new" && state && !existing)
        throw new ValidationError("create-new refuses existing state; choose a separate state path");
    if (intent !== "create-new" && !state)
        throw new ValidationError("selected existing continuity is absent; restore it explicitly before retrying");
    if (intent === "restore-existing" && !existing && !args.acceptContinuityRisk)
        throw new ValidationError(
            "restore attaches local state; snapshot age, missing history, and forks remain unresolved. Confirm intended continuation with --accept-continuity-risk",
        );
    if (existing && !state && (existing.continuity !== "pending" || existing.intent !== "create-new"))
        throw new ValidationError(
            "previous continuity operation requires recovery; missing state will not be recreated",
        );
    const principal = args.principal ?? existing?.principal ?? state?.runtimeContract.localPrincipal;
    if (!principal || !safeText(principal)) throw new ValidationError("create-new requires --principal");
    if (state && principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("principal does not match continuity state");
    const kind = args.provider ?? existing?.provider.kind;
    const changedKind = kind !== existing?.provider.kind;
    const provider = {
        kind,
        command:
            args.providerCommand ??
            (!changedKind ? existing?.provider.command : undefined) ??
            (kind === "cursor" ? "cursor-agent" : kind),
        model: args.model ?? (!changedKind ? existing?.provider.model : undefined) ?? "",
        timeoutSeconds: args.providerTimeoutSeconds ?? existing?.provider.timeoutSeconds ?? 60,
    };
    validateSetupProvider(provider);
    if (existing && JSON.stringify(provider) !== JSON.stringify(existing.provider) && !args.confirmProviderChange)
        throw new ValidationError("provider configuration change requires --confirm-provider-change");
    const candidate = state ?? initialState(principal);
    if (existing && !state) {
        candidate.lineage.lineageId = existing.lineageId as EmberState["lineage"]["lineageId"];
        candidate.lineage.establishedAt = existing.establishedAt;
    }
    const config: SetupConfig = {
        version: 1,
        intent: existing?.intent ?? intent,
        statePath,
        principal,
        lineageId: candidate.lineage.lineageId,
        establishedAt: candidate.lineage.establishedAt,
        provider: provider as SetupProvider,
        verification: "not_attempted",
        continuity: state ? "available" : "pending",
        cancellationRequested: false,
        updatedAt: nowUtc(),
    };
    const lock = new StateStore(configPath);
    const lease = await lock.acquireWriteLease();
    const controller = new AbortController();
    const cancel = () => {
        config.cancellationRequested = true;
        controller.abort();
    };
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    dependencies.signal?.addEventListener("abort", cancel, { once: true });
    if (dependencies.signal?.aborted) cancel();
    const persistConfig = dependencies.persistConfig ?? writeConfig;
    const persistObserved = async () => {
        const cancellationWasRequested = config.cancellationRequested;
        await persistConfig(configPath, config);
        if (!cancellationWasRequested && config.cancellationRequested) await persistConfig(configPath, config);
    };
    try {
        // Prevent concurrent setup from replacing a configuration read before acquiring the lease.
        if (JSON.stringify(await loadSetupConfig(configPath)) !== JSON.stringify(existing))
            throw new ValidationError("setup configuration changed; inspect and retry");
        await persistObserved();
        if (controller.signal.aborted) {
            io.output.write("Setup cancelled before cognition; continuity unchanged.\n");
            return 2;
        }
        config.verification = "requested";
        await persistObserved();
        if (controller.signal.aborted) {
            config.verification = "not_attempted";
            await persistObserved();
            io.output.write("Setup cancelled before cognition; continuity unchanged.\n");
            return 2;
        }
        io.output.write("Verifying cognition. Authentication remains owned by the selected provider runtime.\n");
        try {
            const synthetic = startRuntime(initialState("setup-probe"), "setup-probe", "setup-probe");
            const input =
                "This is a synthetic machine bootstrap probe. Reply briefly to confirm cognition works; do not infer identity or user facts.";
            const projection = buildProjection(synthetic.state, {
                principal: "setup-probe",
                scope: "setup-probe",
                surface: "setup-probe",
                currentInput: input,
                currentTime: nowUtc(),
                runtimeId: synthetic.runtimeId,
            });
            const result = await (dependencies.provider ?? setupProvider)(config.provider)(
                {
                    contractVersion: 1,
                    cognitionId: newId("cognition"),
                    projection,
                    input: { text: input },
                },
                { timeoutSeconds: config.provider.timeoutSeconds, signal: controller.signal },
            );
            validateProviderResult(result, new Set());
            config.verification = "verified";
        } catch (error) {
            config.verification = error instanceof ProviderError ? error.outcome : "failed";
            await persistObserved();
            io.error.write(
                `Cognition verification ${config.verification}; setup is not ready. Check provider-owned authentication and retry setup. Raw provider diagnostics are not retained.\n`,
            );
            return 2;
        }
        await persistObserved();
        if (controller.signal.aborted) {
            io.output.write(
                "Cancellation requested; cognition returned successfully, continuity activation was not attempted.\n",
            );
            return 2;
        }
        config.continuity = "requested";
        await persistObserved();
        if (controller.signal.aborted) {
            config.continuity = state ? "available" : "pending";
            await persistObserved();
            io.output.write("Setup cancelled before continuity activation; continuity unchanged.\n");
            return 2;
        }
        try {
            if (!state) await store.create(candidate);
            assertBinding(config, await store.load());
            if (!state && intent === "create-new") {
                await new OnboardingWorkStore(statePath).save(
                    createOnboardingWork(candidate.lineage.lineageId, principal, `relationship:${principal}`, nowUtc()),
                );
            }
            config.continuity = "available";
            await persistObserved();
        } catch {
            config.continuity = "outcome_unknown";
            await persistObserved();
            io.error.write(
                "Continuity activation did not complete; inspect the state and setup record before retrying. Existing state was not reset.\n",
            );
            return 2;
        }
        io.output.write(
            "Cognition verified; continuity available. Ready for ordinary conversation and progressive onboarding.\n",
        );
        io.output.write(`Run: ember run --config '${configPath.replaceAll("'", "'\\''")}' --scope SCOPE\n`);
        if (controller.signal.aborted) {
            io.output.write("Cancellation requested after activation; committed continuity remains available.\n");
        }
        return controller.signal.aborted ? 2 : 0;
    } finally {
        process.off("SIGINT", cancel);
        process.off("SIGTERM", cancel);
        dependencies.signal?.removeEventListener("abort", cancel);
        await lock.releaseWriteLease(lease);
    }
}

export function assertBinding(config: SetupConfig, state: EmberState): void {
    if (
        state.lineage.lineageId !== config.lineageId ||
        state.runtimeContract.localPrincipal !== config.principal ||
        state.lineage.establishedAt !== config.establishedAt
    )
        throw new ValidationError("continuity no longer matches setup binding; explicit recovery is required");
}

export async function setupRunMain(args: ConfiguredRunArgs, io: CliIo): Promise<number> {
    if (!args.config || !safeText(args.scope))
        throw new ValidationError("configured run requires --config PATH and --scope SCOPE");
    const config = await loadSetupConfig(resolve(args.config));
    if (!config || config.verification !== "verified" || config.continuity !== "available")
        throw new ValidationError("setup has not verified cognition and continuity; rerun ember setup first");
    const provider = setupProvider(config.provider);
    return await runCliSurface(
        {
            statePath: config.statePath,
            principal: config.principal,
            scope: args.scope,
            expectedContinuityBinding: {
                lineageId: config.lineageId,
                establishedAt: config.establishedAt,
            },
            providerKind: config.provider.kind,
            providerCommand: config.provider.command,
            providerArgs: config.provider.model ? ["--model", config.provider.model] : [],
            providerModel: config.provider.model,
            providerTimeoutSeconds: config.provider.timeoutSeconds,
            memoryProposalGenerator: createProviderMemoryProposalGenerator(provider, config.provider.timeoutSeconds),
            memoryProposalProviderLabel: `${config.provider.kind}:memory-proposal`,
        },
        io,
    );
}

const SETUP_HELP = `ember setup [--config PATH] [--state PATH]
Defaults: ~/.ember/config/setup.json and ~/.ember/state/continuity.json.
Config and state path overrides are independent; an existing config retains its state binding.
Inspect first, then choose explicitly:
  --intent create-new --principal USER --provider codex|cursor|claude-code
  --intent restore-existing --state PATH --accept-continuity-risk --provider PROVIDER
  --intent use-existing [--state PATH] [--provider PROVIDER]
Restore attaches a local store and its sidecars; fork, snapshot age, and missing-history risks remain unresolved.
Options: --model MODEL, --provider-command EXECUTABLE (Codex/Cursor only),
  --provider-timeout-seconds SECONDS (default 60, maximum 120), --confirm-provider-change.
Provider credentials stay in provider-owned login stores; never pass secrets as options.
Rerun with the same intent or use-existing to reverify; existing continuity is never overwritten.
Use a separate config and state path to create another lineage. Ctrl-C requests cancellation.
`;
