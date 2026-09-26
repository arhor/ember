import type { MemoryProposalGenerator } from "../../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import type { StateStoreOptions } from "../../persistence/state-store.ts";
import type { InteractionRepositories } from "../../runtime/interaction-boundary.ts";
import type { ClaudeCodeProviderOptions } from "../ai/claude-code.ts";
import type { AiExecutionRequest, AiExecutor, CapabilitySelector } from "../ai/contract.ts";

import { selectApprovedGoogleCalendarEventCapability } from "../../integrations/google-calendar/create.ts";
import { loadGoogleCalendarConfig, selectGoogleCalendarCapability } from "../../integrations/google-calendar/read.ts";
import { createProviderMemoryProposalGenerator } from "../../memory/provider-memory-proposal-generator.ts";
import { DurableObjectiveStore } from "../../objectives/durable-objective.ts";
import { createProviderOnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import { ConversationContextStore } from "../../persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "../../persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../../persistence/onboarding-work-store.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { InteractionLedgerStore } from "../../runtime/interaction-boundary.ts";
import { ProactiveContactStore } from "../agency/proactive-contact-store.ts";
import { createCodexLanguageModel } from "../ai/codex.ts";
import { createAiSdkCognitionExecutor } from "../ai/cognition.ts";
import { createCursorLanguageModel } from "../ai/cursor.ts";
import { createDeepSeekLanguageModel } from "../ai/deepseek.ts";
import { createAiSdkMemoryProposalGenerator } from "../ai/memory-proposals.ts";
import { createOllamaLanguageModel } from "../ai/ollama.ts";
import { createAiSdkOnboardingProgressEvaluator } from "../ai/onboarding-progress.ts";
import { createProcessLanguageModel } from "../ai/process.ts";
import { createProcessProvider } from "../ai/providers/process.ts";
import { ObjectiveActionCoordinator } from "../app/objective-action.ts";
import { ActionProposalStore } from "../capabilities/action-proposal.ts";
import { providerLabel } from "./provider-label.ts";

export type EmberProviderKind = "process" | "codex" | "cursor" | "claude-code" | "ollama" | "deepseek";

export interface EmberCompositionConfig {
    statePath: string;
    expectedContinuityBinding?: { lineageId: string; establishedAt: string };
    provider: {
        kind: EmberProviderKind;
        command?: string;
        arguments?: string[];
        model?: string;
        baseUrl?: string;
        timeoutSeconds: number;
    };
    googleCalendarConfigPath?: string;
}

export interface EmberCompositionOverrides {
    executor?: AiExecutor;
    memoryProposalGenerator?: MemoryProposalGenerator;
    memoryProposalProviderLabel?: string;
    onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    stateStoreOptions?: StateStoreOptions;
    claudeProviderFactory?: (options: ClaudeCodeProviderOptions) => AiExecutor;
    selectCapabilities?: CapabilitySelector;
}

/** Concrete production dependencies for one Ember application instance. */
export interface EmberApplicationDependencies {
    admission: {
        expectedContinuityBinding?: { lineageId: string; establishedAt: string };
    };
    repositories: InteractionRepositories & {
        state: InteractionRepositories["state"] & Pick<StateStore, "acquireWriteLease" | "releaseWriteLease">;
        interactions: InteractionRepositories["interactions"] & Pick<InteractionLedgerStore, "fenceDelivery">;
        onboarding: InteractionRepositories["onboarding"] & Pick<OnboardingWorkStore, "save">;
        memoryProposalGenerations: MemoryProposalGenerationStore;
        actions: Pick<ActionProposalStore, "present" | "get" | "decide" | "invalidate">;
        proactiveContacts: Pick<
            ProactiveContactStore,
            "load" | "recordPolicyDecision" | "adoptHandoff" | "recordReconciliationOutcome"
        >;
    };
    cognition: {
        executor: AiExecutor;
        providerLabel: string;
        timeoutSeconds: number;
        selectCapabilities?: CapabilitySelector | undefined;
    };
    postTurn: {
        memoryProposalGenerator?: MemoryProposalGenerator;
        memoryProposalProviderLabel?: string;
        onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    };
}

export type ComposedEmberApplicationDependencies = EmberApplicationDependencies & {
    repositories: ReturnType<typeof createRepositories>;
};

/**
 * The production composition root. Configuration is parsed by the executable or
 * setup boundary; this function only turns validated values into collaborators.
 */
export function composeEmberApplication(
    config: EmberCompositionConfig,
    overrides: EmberCompositionOverrides = {},
): ComposedEmberApplicationDependencies {
    const repositories = createRepositories(config.statePath, overrides.stateStoreOptions);
    const executor = overrides.executor ?? createConfiguredExecutor(config, overrides);
    const controls: Partial<ReturnType<typeof createConfiguredControlHelpers>> =
        overrides.executor === undefined ? createConfiguredControlHelpers(config) : {};
    const memoryProposalGenerator = overrides.memoryProposalGenerator ?? controls.memoryProposalGenerator;
    const onboardingProgressEvaluator = overrides.onboardingProgressEvaluator ?? controls.onboardingProgressEvaluator;
    return {
        admission: {
            ...(config.expectedContinuityBinding === undefined
                ? {}
                : { expectedContinuityBinding: config.expectedContinuityBinding }),
        },
        repositories,
        cognition: {
            executor,
            providerLabel:
                config.provider.kind === "ollama" || config.provider.kind === "deepseek"
                    ? config.provider.kind
                    : providerLabel(config.provider.command!),
            timeoutSeconds: config.provider.timeoutSeconds,
            ...createCapabilitySelector(config, repositories, overrides),
        },
        postTurn: {
            ...(memoryProposalGenerator === undefined ? {} : { memoryProposalGenerator }),
            ...(overrides.memoryProposalProviderLabel === undefined
                ? {}
                : { memoryProposalProviderLabel: overrides.memoryProposalProviderLabel }),
            ...(onboardingProgressEvaluator === undefined ? {} : { onboardingProgressEvaluator }),
        },
    };
}

function createConfiguredControlHelpers(config: EmberCompositionConfig): {
    memoryProposalGenerator?: MemoryProposalGenerator;
    onboardingProgressEvaluator?: OnboardingProgressEvaluator;
} {
    const timeoutSeconds = config.provider.timeoutSeconds;
    const adapter = { command: config.provider.command!, arguments_: config.provider.arguments!, timeoutSeconds };
    if (config.provider.kind === "codex" || config.provider.kind === "cursor") {
        const model =
            config.provider.kind === "codex" ? createCodexLanguageModel(adapter) : createCursorLanguageModel(adapter);
        return {
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds }),
            onboardingProgressEvaluator: createAiSdkOnboardingProgressEvaluator(model, timeoutSeconds),
        };
    }
    if (config.provider.kind === "claude-code") {
        const options = config.provider.model ? { model: config.provider.model } : {};
        return {
            memoryProposalGenerator: async (request) => {
                const { createClaudeCodeModelAccess } = await import("../ai/claude-code.ts");
                return createClaudeCodeModelAccess(options)((model) =>
                    createAiSdkMemoryProposalGenerator(model, { timeoutSeconds })(request),
                );
            },
            onboardingProgressEvaluator: async (request) => {
                const { createClaudeCodeModelAccess } = await import("../ai/claude-code.ts");
                return createClaudeCodeModelAccess(options)((model) =>
                    createAiSdkOnboardingProgressEvaluator(model, timeoutSeconds)(request),
                );
            },
        };
    }
    if (config.provider.kind === "ollama") {
        const model = createOllamaLanguageModel({
            model: config.provider.model!,
            ...(config.provider.baseUrl === undefined ? {} : { baseUrl: config.provider.baseUrl }),
        });
        return {
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds }),
            onboardingProgressEvaluator: createAiSdkOnboardingProgressEvaluator(model, timeoutSeconds),
        };
    }
    if (config.provider.kind === "deepseek") {
        const model = createDeepSeekLanguageModel({ model: config.provider.model! });
        return {
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds }),
            onboardingProgressEvaluator: createAiSdkOnboardingProgressEvaluator(model, timeoutSeconds),
        };
    }

    const executor = createProcessProvider({
        command: config.provider.command!,
        arguments_: config.provider.arguments!,
    });
    return {
        memoryProposalGenerator: createProviderMemoryProposalGenerator(executor, timeoutSeconds),
        onboardingProgressEvaluator: createProviderOnboardingProgressEvaluator(executor, timeoutSeconds),
    };
}

function createRepositories(statePath: string, stateStoreOptions?: StateStoreOptions) {
    const interactionRepositories = createFileBackedRepositories(statePath, stateStoreOptions);
    const actions = new ActionProposalStore(statePath);
    const objectives = new DurableObjectiveStore(statePath);
    return {
        ...interactionRepositories,
        actions,
        objectives,
        proactiveContacts: new ProactiveContactStore(statePath),
    };
}

/** File-backed ordinary-flow collaborators sharing the existing canonical-state path. */
export function createFileBackedRepositories(statePath: string, stateStoreOptions?: StateStoreOptions) {
    return createFileBackedRepositoriesForState(new StateStore(statePath, stateStoreOptions));
}

/** Compose the sidecars around an already configured canonical state collaborator. */
export function createFileBackedRepositoriesForState(state: StateStore) {
    return {
        state,
        conversation: new ConversationContextStore(state.path),
        interactions: new InteractionLedgerStore(state.path),
        onboarding: new OnboardingWorkStore(state.path),
        memoryProposalGenerations: new MemoryProposalGenerationStore(state.path),
    };
}

function createConfiguredExecutor(config: EmberCompositionConfig, overrides: EmberCompositionOverrides): AiExecutor {
    const adapter = { command: config.provider.command!, arguments_: config.provider.arguments! };
    if (config.provider.kind === "codex")
        return createAiSdkCognitionExecutor(
            createCodexLanguageModel({ ...adapter, timeoutSeconds: config.provider.timeoutSeconds }),
        );
    if (config.provider.kind === "cursor")
        return createAiSdkCognitionExecutor(
            createCursorLanguageModel({ ...adapter, timeoutSeconds: config.provider.timeoutSeconds }),
        );
    if (config.provider.kind === "process")
        return createAiSdkCognitionExecutor(
            createProcessLanguageModel({ ...adapter, timeoutSeconds: config.provider.timeoutSeconds }),
        );
    if (config.provider.kind === "ollama")
        return createAiSdkCognitionExecutor(
            createOllamaLanguageModel({
                model: config.provider.model!,
                ...(config.provider.baseUrl === undefined ? {} : { baseUrl: config.provider.baseUrl }),
            }),
        );
    if (config.provider.kind === "deepseek")
        return createAiSdkCognitionExecutor(createDeepSeekLanguageModel({ model: config.provider.model! }));

    return async (request, options) => {
        const { createClaudeCodeExecutor } = await import("../ai/claude-code.ts");
        return (overrides.claudeProviderFactory ?? createClaudeCodeExecutor)({
            ...(config.provider.model ? { model: config.provider.model } : {}),
        })(request, options);
    };
}

function createCapabilitySelector(
    config: EmberCompositionConfig,
    repositories: ReturnType<typeof createRepositories>,
    overrides: EmberCompositionOverrides,
) {
    if (overrides.selectCapabilities !== undefined) return { selectCapabilities: overrides.selectCapabilities };
    if (config.provider.kind !== "claude-code" || config.googleCalendarConfigPath === undefined) return {};
    const objectiveActions = new ObjectiveActionCoordinator(repositories.objectives, repositories.actions);
    return {
        selectCapabilities: async (request: AiExecutionRequest) => {
            const calendar = await loadGoogleCalendarConfig(config.googleCalendarConfigPath!);
            if (calendar === undefined) return [];
            return [
                ...selectGoogleCalendarCapability(calendar, capabilityContext(request)),
                ...selectApprovedGoogleCalendarEventCapability(
                    calendar,
                    repositories.actions,
                    capabilityContext(request),
                    { revalidateObjective: (proposalId) => objectiveActions.revalidate(proposalId) },
                ),
            ];
        },
    };
}

function capabilityContext(request: AiExecutionRequest) {
    return {
        principal: request.projection.principal,
        lineageId: request.projection.lineage.lineageId,
        scope: request.projection.activeScope,
        surface: request.projection.surface,
    };
}
