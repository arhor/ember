import type { EmberApplicationDependencies } from "../composition/ember.ts";
import type { CognitionId, EmberState } from "../core/model.ts";
import type { PostTurnDiagnostics } from "../runtime/interaction-boundary.ts";
import type { PreparedCognition } from "./cognition-preparation.ts";

import { selectRecentConversationContext } from "../core/conversation-context.ts";
import { nowUtc } from "../core/model.ts";
import { applyOnboardingProgressDecision } from "../core/onboarding-work.ts";
import { generateAndAdoptConversationMemories } from "../memory/memory-proposal-generation.ts";
import { findCognition } from "../runtime/runtime.ts";

/** Runs fallible application follow-ups after cognition and its delivery intent are durable. */
export async function runPostTurnFollowUps(
    repositories: Pick<
        EmberApplicationDependencies["repositories"],
        "state" | "conversation" | "onboarding" | "memoryProposalGenerations"
    >,
    postTurn: EmberApplicationDependencies["postTurn"],
    state: EmberState,
    preparation: PreparedCognition,
    options: {
        cognitionId: CognitionId;
        principal: string;
        scope: string;
        text: string;
    },
): Promise<PostTurnDiagnostics> {
    const cognition = findCognition(state, options.cognitionId);
    let onboardingProgressFailure: string | null = null;
    if (preparation.onboardingDocument?.status === "active" && postTurn.onboardingProgressEvaluator !== undefined) {
        try {
            const decision = await postTurn.onboardingProgressEvaluator({
                projection: preparation.projection,
                onboardingWork: preparation.onboardingWork!,
                input: options.text,
            });
            await repositories.onboarding.save(
                applyOnboardingProgressDecision(
                    preparation.onboardingDocument,
                    decision,
                    cognition.inputEvidenceId,
                    nowUtc(),
                ),
            );
        } catch (error) {
            onboardingProgressFailure = error instanceof Error ? error.message : String(error);
        }
    }

    let memoryProposalFailure: string | null = null;
    if (postTurn.memoryProposalGenerator !== undefined) {
        try {
            const reflectionContext = selectRecentConversationContext(state, await repositories.conversation.load(), {
                principal: options.principal,
                scope: options.scope,
                conversationId: preparation.conversationId,
                membership: preparation.conversationMembership,
            });
            await generateAndAdoptConversationMemories(
                repositories.state,
                repositories.memoryProposalGenerations,
                state,
                reflectionContext,
                {
                    principal: options.principal,
                    scope: options.scope,
                    generator: postTurn.memoryProposalGenerator,
                    ...(postTurn.memoryProposalProviderLabel === undefined
                        ? {}
                        : { providerLabel: postTurn.memoryProposalProviderLabel }),
                },
            );
        } catch (error) {
            memoryProposalFailure = error instanceof Error ? error.message : String(error);
        }
    }

    return { memoryProposalFailure, onboardingProgressFailure };
}
