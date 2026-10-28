import type { AiExecutor, CapabilitySelector } from "../ai/contract.ts";
import type { MemoryProposalGenerator } from "../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../onboarding/progress-evaluator.ts";
import type { ProactiveContactStore } from "../ports/agency/proactive-contact-store.ts";
import type { ActionProposalStore } from "../ports/capabilities/action-proposal.ts";
import type { MemoryProposalGenerationStore } from "../ports/persistence/memory-proposal-generation-store.ts";
import type { OnboardingWorkStore } from "../ports/persistence/onboarding-work-store.ts";
import type { StateStore } from "../ports/persistence/state-store.ts";
import type { InteractionRepositories, InteractionLedgerStore } from "../runtime/interaction-boundary.ts";
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
