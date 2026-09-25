import type { AiExecutor } from "../ai/contract.ts";
import type { EmberState } from "../core/model.ts";
import type { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import type { StateStore } from "../persistence/state-store.ts";

import { validateAiExecutionResult } from "../ai/contract.ts";
import { ProviderError, ValidationError } from "../core/errors.ts";
import { initialState, newId, nowUtc } from "../core/model.ts";
import { createOnboardingWork } from "../core/onboarding-work.ts";
import { buildProjection } from "../core/projection.ts";
import { startRuntime } from "../core/runtime-episode.ts";
import { safeText, validateSetupProvider } from "./bootstrap-validation.ts";

export type SetupIntent = "create-new" | "restore-existing" | "use-existing";
export interface SetupRequest {
    config: string | undefined;
    state: string | undefined;
    principal: string | undefined;
    intent: SetupIntent | undefined;
    provider: "codex" | "cursor" | "claude-code" | "ollama" | undefined;
    providerCommand: string | undefined;
    model: string | undefined;
    providerBaseUrl?: string | undefined;
    providerTimeoutSeconds: number | undefined;
    acceptContinuityRisk: boolean;
    confirmProviderChange: boolean;
}

export type SetupProvider =
    | { kind: "codex" | "cursor" | "claude-code"; command: string; model: string; timeoutSeconds: number }
    | { kind: "ollama"; model: string; baseUrl?: string; timeoutSeconds: number };

export interface SetupConfig {
    version: 1 | 2;
    googleCalendarConfigPath?: string;
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

/** A deliberately redacted, host-local setup probe record. */
export type SetupProbeDiagnostic =
    | {
          event: "probe_started";
          at: string;
          provider: "codex" | "cursor" | "claude-code" | "ollama";
          modelConfigured: boolean;
          node: string;
          platform: string;
      }
    | {
          event: "probe_failed";
          at: string;
          provider: "codex" | "cursor" | "claude-code" | "ollama";
          outcome: SetupConfig["verification"];
          errorClass: string;
          category?: ProviderError["category"];
          configuredTimeoutSeconds: number;
          durationMs: number;
          statusCode?: number;
          termination?: ProviderError["termination"];
          terminationConfirmed?: boolean;
      };

export type BootstrapEvent =
    | {
          kind: "inspection";
          configured: boolean;
          continuity: boolean;
          verification?: SetupConfig["verification"];
          operation?: SetupConfig["continuity"];
      }
    | {
          kind:
              | "cancelled_before_cognition"
              | "verifying"
              | "verification_failed"
              | "cancelled_after_probe"
              | "cancelled_before_activation"
              | "activation_failed"
              | "ready"
              | "cancelled_after_activation";
          outcome?: SetupConfig["verification"];
          diagnostic?: SetupProbeDiagnostic;
      };

export interface BootstrapDependencies {
    defaultConfigPath(): string;
    defaultStatePath(): string;
    resolvePath(path: string, label: string): Promise<string>;
    exists(path: string): Promise<boolean>;
    loadConfig(path: string): Promise<SetupConfig | null>;
    persistConfig(path: string, config: SetupConfig): Promise<void>;
    createStateStore(path: string): Pick<StateStore, "load" | "create" | "acquireWriteLease" | "releaseWriteLease">;
    createOnboardingStore(path: string): Pick<OnboardingWorkStore, "load" | "save">;
    provider(config: SetupProvider): AiExecutor;
    loadGoogleCalendarConfig(path: string): Promise<{ setup_lineage_id: string } | null>;
    signal?: AbortSignal;
    onProgress(event: BootstrapEvent): void;
}

export async function bootstrapContinuity(args: SetupRequest, dependencies: BootstrapDependencies): Promise<number> {
    const configPath = await dependencies.resolvePath(
        args.config ?? dependencies.defaultConfigPath(),
        "setup configuration",
    );
    const existing = await dependencies.loadConfig(configPath);
    const statePath = await dependencies.resolvePath(
        args.state ?? existing?.statePath ?? dependencies.defaultStatePath(),
        "continuity state",
    );
    if (configPath === statePath || configPath.startsWith(`${statePath}.`) || statePath.startsWith(`${configPath}.`))
        throw new ValidationError("setup configuration and canonical state/sidecars must have separate paths");
    const store = dependencies.createStateStore(statePath);
    const state = (await dependencies.exists(statePath)) ? await store.load() : null;
    dependencies.onProgress({
        kind: "inspection",
        configured: !!existing,
        continuity: !!state,
        ...(!args.intent && existing ? { verification: existing.verification, operation: existing.continuity } : {}),
    });
    if (existing && (existing.statePath !== statePath || (args.principal && args.principal !== existing.principal)))
        throw new ValidationError(
            "existing setup binding is preserved; use a separate --config and --state for another lineage",
        );
    if (existing && state) assertBinding(existing, state);
    if (!args.intent) {
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
    if (kind === "ollama" && args.providerCommand !== undefined)
        throw new ValidationError("Ollama connects to an endpoint and does not accept --provider-command");
    if (kind !== "ollama" && args.providerBaseUrl !== undefined)
        throw new ValidationError("--provider-base-url is supported only for Ollama");
    const model = args.model ?? (!changedKind ? existing?.provider.model : undefined) ?? "";
    const timeoutSeconds = args.providerTimeoutSeconds ?? existing?.provider.timeoutSeconds ?? 60;
    const baseUrl =
        args.providerBaseUrl ??
        (!changedKind && existing?.provider.kind === "ollama" ? existing.provider.baseUrl : undefined);
    const provider =
        kind === "ollama"
            ? { kind, model, ...(baseUrl === undefined ? {} : { baseUrl }), timeoutSeconds }
            : {
                  kind,
                  command:
                      args.providerCommand ??
                      (!changedKind && existing?.provider.kind !== "ollama" ? existing?.provider.command : undefined) ??
                      (kind === "cursor" ? "cursor-agent" : kind),
                  model,
                  timeoutSeconds,
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
        version: existing?.version ?? 1,
        ...(existing?.version === 2 ? { googleCalendarConfigPath: existing.googleCalendarConfigPath } : {}),
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
    const lock = dependencies.createStateStore(configPath);
    const lease = await lock.acquireWriteLease();
    const controller = new AbortController();
    const cancel = () => {
        config.cancellationRequested = true;
        controller.abort();
    };
    dependencies.signal?.addEventListener("abort", cancel, { once: true });
    if (dependencies.signal?.aborted) cancel();
    const persistConfig = dependencies.persistConfig;
    const persistObserved = async () => {
        const cancellationWasRequested = config.cancellationRequested;
        await persistConfig(configPath, config);
        if (!cancellationWasRequested && config.cancellationRequested) await persistConfig(configPath, config);
    };
    try {
        // Prevent concurrent setup from replacing a configuration read before acquiring the lease.
        if (JSON.stringify(await dependencies.loadConfig(configPath)) !== JSON.stringify(existing))
            throw new ValidationError("setup configuration changed; inspect and retry");
        await persistObserved();
        if (controller.signal.aborted) {
            dependencies.onProgress({ kind: "cancelled_before_cognition" });
            return 2;
        }
        config.verification = "requested";
        await persistObserved();
        if (controller.signal.aborted) {
            config.verification = "not_attempted";
            await persistObserved();
            dependencies.onProgress({ kind: "cancelled_before_cognition" });
            return 2;
        }
        const probeStartedAt = performance.now();
        const probeDiagnostic = {
            event: "probe_started" as const,
            at: nowUtc(),
            provider: config.provider.kind,
            modelConfigured: Boolean(config.provider.model),
            node: process.version,
            platform: process.platform,
        };
        dependencies.onProgress({ kind: "verifying", diagnostic: probeDiagnostic });
        let continuityMutationStarted = false;
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
            const result = await dependencies.provider(config.provider)(
                {
                    contractVersion: 1,
                    cognitionId: newId("cognition"),
                    projection,
                    input: { text: input },
                },
                { timeoutSeconds: config.provider.timeoutSeconds, signal: controller.signal },
            );
            validateAiExecutionResult(result, new Set());
            config.verification = "verified";
        } catch (error) {
            config.verification = error instanceof ProviderError ? error.outcome : "failed";
            await persistObserved();
            dependencies.onProgress({
                kind: "verification_failed",
                outcome: config.verification,
                diagnostic: {
                    event: "probe_failed",
                    at: nowUtc(),
                    provider: config.provider.kind,
                    outcome: config.verification,
                    errorClass: error instanceof Error ? error.constructor.name : typeof error,
                    configuredTimeoutSeconds: config.provider.timeoutSeconds,
                    durationMs: Math.max(0, Math.round(performance.now() - probeStartedAt)),
                    ...(error instanceof ProviderError && error.category !== null
                        ? { category: error.category }
                        : {}),
                    ...(error instanceof ProviderError && error.statusCode !== null
                        ? { statusCode: error.statusCode }
                        : {}),
                    ...(error instanceof ProviderError && error.termination !== null
                        ? { termination: error.termination }
                        : {}),
                    ...(error instanceof ProviderError ? { terminationConfirmed: error.terminationConfirmed } : {}),
                },
            });
            return 2;
        }
        await persistObserved();
        if (controller.signal.aborted) {
            dependencies.onProgress({ kind: "cancelled_after_probe" });
            return 2;
        }
        config.continuity = "requested";
        await persistObserved();
        if (controller.signal.aborted) {
            config.continuity = state ? "available" : "pending";
            await persistObserved();
            dependencies.onProgress({ kind: "cancelled_before_activation" });
            return 2;
        }
        try {
            const onboardingStore = dependencies.createOnboardingStore(statePath);
            if (!state && intent === "create-new") {
                const work = await onboardingStore.load();
                if (work === null) {
                    await onboardingStore.save(
                        createOnboardingWork(
                            candidate.lineage.lineageId,
                            principal,
                            `relationship:${principal}`,
                            nowUtc(),
                            "pending_activation",
                        ),
                    );
                } else if (
                    work.lineage_id !== candidate.lineage.lineageId ||
                    work.principal !== principal ||
                    work.status !== "pending_activation"
                ) {
                    throw new ValidationError("onboarding activation evidence conflicts with the intended new lineage");
                }
            }
            if (!state) {
                continuityMutationStarted = true;
                await store.create(candidate);
            }
            assertBinding(config, await store.load());
            const pendingOnboarding = await onboardingStore.load();
            if (
                config.intent === "create-new" &&
                pendingOnboarding?.status === "pending_activation" &&
                pendingOnboarding.lineage_id === config.lineageId &&
                pendingOnboarding.principal === principal
            ) {
                pendingOnboarding.status = "active";
                pendingOnboarding.updated_at = nowUtc();
                await onboardingStore.save(pendingOnboarding);
            }
            config.continuity = "available";
            await persistObserved();
        } catch {
            try {
                assertBinding(config, await store.load());
                config.continuity = "available";
            } catch {
                config.continuity = continuityMutationStarted ? "outcome_unknown" : "pending";
            }
            await persistObserved();
            dependencies.onProgress({ kind: "activation_failed" });
            return 2;
        }
        dependencies.onProgress({ kind: "ready" });
        if (controller.signal.aborted) {
            dependencies.onProgress({ kind: "cancelled_after_activation" });
        }
        return controller.signal.aborted ? 2 : 0;
    } finally {
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

export async function prepareConfiguredRun(
    args: { mode: "configured"; config: string; scope: string } | { mode: "default" },
    dependencies: BootstrapDependencies,
) {
    if (args.mode === "configured" && (!args.config || !safeText(args.scope)))
        throw new ValidationError("configured run requires --config PATH and --scope SCOPE");
    const config = await dependencies.loadConfig(
        await dependencies.resolvePath(
            args.mode === "default" ? dependencies.defaultConfigPath() : args.config,
            "setup configuration",
        ),
    );
    if (!config || config.verification !== "verified" || config.continuity !== "available")
        throw new ValidationError("setup has not verified cognition and continuity; rerun ember setup first");
    const scope = args.mode === "default" ? `relationship:${config.principal}` : args.scope;
    if ((await dependencies.createOnboardingStore(config.statePath).load())?.status === "pending_activation")
        throw new ValidationError("new-lineage onboarding activation is incomplete; rerun ember setup first");
    const googleCalendarConfig =
        config.version === 2
            ? await dependencies.loadGoogleCalendarConfig(config.googleCalendarConfigPath!)
            : undefined;
    if (googleCalendarConfig && googleCalendarConfig.setup_lineage_id !== config.lineageId)
        throw new ValidationError("Google Calendar configuration belongs to a different setup lineage");
    return {
        statePath: config.statePath,
        principal: config.principal,
        scope,
        expectedContinuityBinding: {
            lineageId: config.lineageId,
            establishedAt: config.establishedAt,
        },
        providerKind: config.provider.kind,
        providerCommand: config.provider.kind === "ollama" ? undefined : config.provider.command,
        providerArgs: config.provider.model ? ["--model", config.provider.model] : [],
        providerModel: config.provider.model,
        ...(config.provider.kind === "ollama" && config.provider.baseUrl !== undefined
            ? { providerBaseUrl: config.provider.baseUrl }
            : {}),
        providerTimeoutSeconds: config.provider.timeoutSeconds,
        ...(googleCalendarConfig === undefined ? {} : { googleCalendarConfigPath: config.googleCalendarConfigPath }),
    };
}
