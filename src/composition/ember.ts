import type { MemoryProposalGenerator } from "../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../onboarding/progress-evaluator.ts";
import type { StateStoreOptions } from "../persistence/state-store.ts";
import type { ClaudeCodeProviderOptions } from "../providers/claude-code.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";

import { ProactiveContactStore } from "../agency/proactive-contact-store.ts";
import { ActionProposalStore } from "../capabilities/action-proposal.ts";
import { selectApprovedGoogleCalendarEventCapability } from "../capabilities/google-calendar-create.ts";
import { loadGoogleCalendarConfig, selectGoogleCalendarCapability } from "../capabilities/google-calendar.ts";
import { createProviderMemoryProposalGenerator } from "../memory/provider-memory-proposal-generator.ts";
import { DurableObjectiveStore } from "../objectives/durable-objective.ts";
import { ObjectiveActionCoordinator } from "../objectives/objective-action.ts";
import { createProviderOnboardingProgressEvaluator } from "../onboarding/progress-evaluator.ts";
import { ConversationContextStore } from "../persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "../persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import { StateStore } from "../persistence/state-store.ts";
import { createCodexProvider } from "../providers/codex.ts";
import { createCursorProvider } from "../providers/cursor.ts";
import { createProcessProvider, providerLabel } from "../providers/process.ts";
import { InteractionLedgerStore } from "../runtime/interaction-boundary.ts";

export type EmberProviderKind = "process" | "codex" | "cursor" | "claude-code";

export interface EmberCompositionConfig {
    statePath: string;
    provider: {
        kind: EmberProviderKind;
        command: string;
        arguments: string[];
        model?: string;
        timeoutSeconds: number;
    };
    googleCalendarConfigPath?: string;
}

export interface EmberCompositionOverrides {
    provider?: ProviderInvoker;
    memoryProposalGenerator?: MemoryProposalGenerator;
    onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    stateStoreOptions?: StateStoreOptions;
    claudeProviderFactory?: (options: ClaudeCodeProviderOptions) => ProviderInvoker;
}

/** Concrete production dependencies for one Ember application instance. */
export interface EmberApplicationDependencies {
    repositories: {
        state: StateStore;
        conversation: ConversationContextStore;
        interactions: InteractionLedgerStore;
        onboarding: OnboardingWorkStore;
        memoryProposalGenerations: MemoryProposalGenerationStore;
        actions: ActionProposalStore;
        objectives: DurableObjectiveStore;
        proactiveContacts: ProactiveContactStore;
    };
    cognition: {
        provider: ProviderInvoker;
        providerLabel: string;
        timeoutSeconds: number;
    };
    postTurn: {
        memoryProposalGenerator?: MemoryProposalGenerator;
        onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    };
}

/**
 * The production composition root. Configuration is parsed by the executable or
 * setup boundary; this function only turns validated values into collaborators.
 */
export function composeEmberApplication(
    config: EmberCompositionConfig,
    overrides: EmberCompositionOverrides = {},
): EmberApplicationDependencies {
    const repositories = createRepositories(config.statePath, overrides.stateStoreOptions);
    const provider = overrides.provider ?? createConfiguredProvider(config, repositories, overrides);
    return {
        repositories,
        cognition: {
            provider,
            providerLabel: providerLabel(config.provider.command),
            timeoutSeconds: config.provider.timeoutSeconds,
        },
        postTurn: {
            memoryProposalGenerator:
                overrides.memoryProposalGenerator ??
                createProviderMemoryProposalGenerator(provider, config.provider.timeoutSeconds),
            onboardingProgressEvaluator:
                overrides.onboardingProgressEvaluator ??
                createProviderOnboardingProgressEvaluator(provider, config.provider.timeoutSeconds),
        },
    };
}

function createRepositories(statePath: string, stateStoreOptions?: StateStoreOptions) {
    const actions = new ActionProposalStore(statePath);
    const objectives = new DurableObjectiveStore(statePath);
    return {
        state: new StateStore(statePath, stateStoreOptions),
        conversation: new ConversationContextStore(statePath),
        interactions: new InteractionLedgerStore(statePath),
        onboarding: new OnboardingWorkStore(statePath),
        memoryProposalGenerations: new MemoryProposalGenerationStore(statePath),
        actions,
        objectives,
        proactiveContacts: new ProactiveContactStore(statePath),
    };
}

function createConfiguredProvider(
    config: EmberCompositionConfig,
    repositories: ReturnType<typeof createRepositories>,
    overrides: EmberCompositionOverrides,
): ProviderInvoker {
    const adapter = { command: config.provider.command, arguments_: config.provider.arguments };
    if (config.provider.kind === "codex") return createCodexProvider(adapter);
    if (config.provider.kind === "cursor") return createCursorProvider(adapter);
    if (config.provider.kind === "process") return createProcessProvider(adapter);

    const objectiveActions = new ObjectiveActionCoordinator(repositories.objectives, repositories.actions);
    return async (request, options) => {
        const { createClaudeCodeProvider } = await import("../providers/claude-code.ts");
        const calendar = config.googleCalendarConfigPath
            ? await loadGoogleCalendarConfig(config.googleCalendarConfigPath)
            : undefined;
        return (overrides.claudeProviderFactory ?? createClaudeCodeProvider)({
            ...(config.provider.model ? { model: config.provider.model } : {}),
            ...(calendar === undefined
                ? {}
                : {
                      selectCapabilities: (selectedRequest: ProviderRequest) => [
                          ...selectGoogleCalendarCapability(calendar, capabilityContext(selectedRequest)),
                          ...selectApprovedGoogleCalendarEventCapability(
                              calendar,
                              repositories.actions,
                              capabilityContext(selectedRequest),
                              { revalidateObjective: (proposalId) => objectiveActions.revalidate(proposalId) },
                          ),
                      ],
                  }),
        })(request, options);
    };
}

function capabilityContext(request: ProviderRequest) {
    return {
        principal: request.projection.principal,
        lineageId: request.projection.lineage.lineageId,
        scope: request.projection.activeScope,
        surface: request.projection.surface,
    };
}
