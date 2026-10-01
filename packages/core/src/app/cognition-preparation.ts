import type {
    ActiveConversationTrajectory,
    ConversationContextDocument,
    ConversationId,
    ConversationMembershipResolution,
} from "../conversation-context.ts";
import type { ConversationMembershipIntent } from "../interaction-contract.ts";
import type { CognitionPurpose, EmberState, MeaningId, RuntimeId } from "../model.ts";
import type { OnboardingWorkDocument, ProjectedOnboardingWork } from "../onboarding-work.ts";
import type { Projection } from "../projection.ts";

import { selectRecentConversationContext } from "../conversation-context.ts";
import { ValidationError } from "../errors.ts";
import { nowUtc } from "../model.ts";
import { projectOnboardingWork } from "../onboarding-work.ts";
import { buildProjection } from "../projection.ts";

export interface CognitionPreparationOptions {
    runtimeId: RuntimeId;
    principal: string;
    scope: string;
    surface: string;
    text: string;
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    conversationMembership?: ConversationMembershipIntent;
}

export interface PreparedCognition {
    projection: Projection;
    conversationId: ConversationId;
    conversationMembership: ConversationMembershipResolution;
    onboardingDocument: OnboardingWorkDocument | null;
    onboardingWork?: ProjectedOnboardingWork;
    startedAt: string;
}

/** Narrow application port for resolving conversation and onboarding context. */
export interface CognitionPreparationRepositories {
    conversation: {
        load(): Promise<ConversationContextDocument>;
        activeConversation(principal: string, scope: string): Promise<ActiveConversationTrajectory | null>;
        startFreshConversation(principal: string, scope: string, startedAt: string): Promise<ConversationId>;
    };
    onboarding: {
        load(): Promise<OnboardingWorkDocument | null>;
    };
}

/**
 * Resolves Ember-owned conversation membership and assembles the complete provider
 * projection before the model execution boundary is entered.
 */
export async function prepareCognition(
    repositories: CognitionPreparationRepositories,
    state: EmberState,
    {
        runtimeId,
        principal,
        scope,
        surface,
        text,
        purpose = "ordinary",
        explainIds = [],
        conversationMembership = { action: "continue", basis: "ordinary_adjacency" },
    }: CognitionPreparationOptions,
): Promise<PreparedCognition> {
    const startedAt = nowUtc();
    const resolved = await resolveConversationMembership(
        repositories.conversation,
        principal,
        scope,
        conversationMembership,
        startedAt,
    );
    const conversationContext = selectRecentConversationContext(state, await repositories.conversation.load(), {
        principal,
        scope,
        conversationId: resolved.conversationId,
        membership: resolved.membership,
    });
    const loadedOnboardingDocument = purpose === "ordinary" ? await repositories.onboarding.load() : null;
    if (
        loadedOnboardingDocument !== null &&
        (loadedOnboardingDocument.lineage_id !== state.lineage.lineageId ||
            loadedOnboardingDocument.principal !== principal)
    ) {
        throw new ValidationError("onboarding work does not match current continuity and principal");
    }
    const onboardingDocument = loadedOnboardingDocument?.scope === scope ? loadedOnboardingDocument : null;
    const onboardingWork = projectOnboardingWork(onboardingDocument);
    const projection = buildProjection(state, {
        principal,
        scope,
        surface,
        currentInput: text,
        currentTime: startedAt,
        runtimeId,
        purpose,
        explainIds,
        conversationContext,
        ...(onboardingWork === undefined ? {} : { onboardingWork }),
    });
    return {
        projection,
        conversationId: resolved.conversationId,
        conversationMembership: resolved.membership,
        onboardingDocument,
        ...(onboardingWork === undefined ? {} : { onboardingWork }),
        startedAt,
    };
}

async function resolveConversationMembership(
    store: CognitionPreparationRepositories["conversation"],
    principal: string,
    scope: string,
    intent: ConversationMembershipIntent,
    startedAt: string,
): Promise<{ conversationId: ConversationId; membership: ConversationMembershipResolution }> {
    if (intent.action === "fresh") {
        return {
            conversationId: await store.startFreshConversation(principal, scope, startedAt),
            membership: { action: "started", basis: intent.basis },
        };
    }
    const active = await store.activeConversation(principal, scope);
    if (active) {
        return {
            conversationId: active.conversation_id,
            membership: { action: "continued", basis: intent.basis },
        };
    }
    return {
        conversationId: await store.startFreshConversation(principal, scope, startedAt),
        membership: { action: "started", basis: "initial_interaction" },
    };
}
