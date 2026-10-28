import type { ClaudeCodeProviderOptions } from "@ember/ai-sdk/claude-code.ts";
import type { AiExecutionRequest, AiExecutor, CapabilitySelector } from "@ember/application/ai/contract.ts";
import type { InteractionResult } from "@ember/application/app/contract.ts";
import type { EmberInteraction } from "@ember/application/app/engine-application.ts";
import type { MemoryProposalGenerator } from "@ember/application/memory/memory-proposal-generation.ts";
import type { EnginePlugin } from "@ember/engine";
import type { StateStoreOptions } from "@ember/persistence/persistence/state-store.ts";

import { createCodexLanguageModel } from "@ember/ai-sdk/codex.ts";
import { createAiSdkCognitionExecutor } from "@ember/ai-sdk/cognition.ts";
import { createCursorLanguageModel } from "@ember/ai-sdk/cursor.ts";
import { createDeepSeekLanguageModel } from "@ember/ai-sdk/deepseek.ts";
import { createAiSdkMemoryProposalGenerator } from "@ember/ai-sdk/memory-proposals.ts";
import { createOllamaLanguageModel } from "@ember/ai-sdk/ollama.ts";
import { createCognitionPlugin } from "@ember/ai-sdk/plugin.ts";
import { createProcessLanguageModel } from "@ember/ai-sdk/process.ts";
import { createProcessProvider } from "@ember/ai-sdk/providers/process.ts";
import { createEngineApplication } from "@ember/application/app/engine-application.ts";
import { ObjectiveActionCoordinator } from "@ember/application/app/objective-action.ts";
import { createProviderMemoryProposalGenerator } from "@ember/application/memory/provider-memory-proposal-generator.ts";
import { selectApprovedGoogleCalendarEventCapability } from "@ember/google-calendar/create.ts";
import { createGoogleCalendarPlugin } from "@ember/google-calendar/plugin.ts";
import { loadGoogleCalendarConfig, selectGoogleCalendarCapability } from "@ember/google-calendar/read.ts";
import { ProactiveContactStore } from "@ember/persistence/agency/proactive-contact-store.ts";
import { ActionProposalStore } from "@ember/persistence/capabilities/action-proposal.ts";
import { FileSessionRepository, FileRunRepository } from "@ember/persistence/engine-repositories.ts";
import { DurableObjectiveStore } from "@ember/persistence/objectives/durable-objective.ts";
import { ConversationContextStore } from "@ember/persistence/persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "@ember/persistence/persistence/memory-proposal-generation-store.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import { InteractionLedgerStore } from "@ember/persistence/runtime/interaction-ledger.ts";

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
    plugins?: readonly EnginePlugin<EmberInteraction, InteractionResult>[];
    executor?: AiExecutor;
    memoryProposalGenerator?: MemoryProposalGenerator;
    memoryProposalProviderLabel?: string;
    stateStoreOptions?: StateStoreOptions;
    claudeProviderFactory?: (options: ClaudeCodeProviderOptions) => AiExecutor;
    selectCapabilities?: CapabilitySelector;
}

import type { EmberApplicationDependencies } from "@ember/application/app/dependencies.ts";
export type { EmberApplicationDependencies } from "@ember/application/app/dependencies.ts";

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
        },
    };
}

function createConfiguredControlHelpers(config: EmberCompositionConfig): {
    memoryProposalGenerator?: MemoryProposalGenerator;
} {
    const timeoutSeconds = config.provider.timeoutSeconds;
    const adapter = { command: config.provider.command!, arguments_: config.provider.arguments!, timeoutSeconds };
    if (config.provider.kind === "codex" || config.provider.kind === "cursor") {
        const model =
            config.provider.kind === "codex" ? createCodexLanguageModel(adapter) : createCursorLanguageModel(adapter);
        return {
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds }),
        };
    }
    if (config.provider.kind === "claude-code") {
        const options = config.provider.model ? { model: config.provider.model } : {};
        return {
            memoryProposalGenerator: async (request) => {
                const { createClaudeCodeModelAccess } = await import("@ember/ai-sdk/claude-code.ts");
                return createClaudeCodeModelAccess(options)((model) =>
                    createAiSdkMemoryProposalGenerator(model, { timeoutSeconds })(request),
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
        };
    }
    if (config.provider.kind === "deepseek") {
        const model = createDeepSeekLanguageModel({ model: config.provider.model! });
        return {
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds }),
        };
    }

    const executor = createProcessProvider({
        command: config.provider.command!,
        arguments_: config.provider.arguments!,
    });
    return {
        memoryProposalGenerator: createProviderMemoryProposalGenerator(executor, timeoutSeconds),
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
        const { createClaudeCodeExecutor } = await import("@ember/ai-sdk/claude-code.ts");
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

/** Start the shared engine around the policy-owning Ember application. */
export async function startEmberApplication(
    config: EmberCompositionConfig,
    overrides: EmberCompositionOverrides = {},
    dependencies = composeEmberApplication(config, overrides),
) {
    const state = await dependencies.repositories.state.load();
    const plugins: EnginePlugin<EmberInteraction, InteractionResult>[] = [
        createCognitionPlugin({
            id: "ember.cognition",
            executor: dependencies.cognition.executor,
            register(executor) {
                dependencies.cognition.executor = executor;
            },
        }),
        ...(overrides.plugins ?? []),
    ];
    const selected = dependencies.cognition.selectCapabilities;
    if (selected)
        plugins.push(
            createGoogleCalendarPlugin({
                id: "ember.capabilities",
                selectCapabilities: selected,
                register(selector) {
                    dependencies.cognition.selectCapabilities = selector;
                },
            }),
        );
    return createEngineApplication(state.lineage.lineageId, dependencies, {
        sessions: new FileSessionRepository(config.statePath),
        runs: new FileRunRepository(config.statePath),
        plugins,
    });
}
