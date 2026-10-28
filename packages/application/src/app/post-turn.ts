import type { CognitionId, EmberState } from "@ember/domain/model.ts";

import type { EmberApplicationDependencies } from "./dependencies.ts";
interface PostTurnDiagnostics {
    memoryProposalFailure: string | null;
}
import type { PreparedCognition } from "@ember/application/app/cognition-preparation.ts";

import { generateAndAdoptConversationMemories } from "@ember/application/memory/memory-proposal-generation.ts";
import { selectRecentConversationContext } from "@ember/domain/conversation-context.ts";

/** Runs fallible application follow-ups after cognition and its delivery intent are durable. */
export async function runPostTurnFollowUps(
    repositories: Pick<
        EmberApplicationDependencies["repositories"],
        "state" | "conversation" | "memoryProposalGenerations"
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

    return { memoryProposalFailure };
}
