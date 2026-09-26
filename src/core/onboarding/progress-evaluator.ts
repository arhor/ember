import type { AiExecutor } from "../ai/contract.ts";
import type { OnboardingProgressDecision, ProjectedOnboardingWork } from "../onboarding-work.ts";
import type { Projection } from "../projection.ts";

import { ValidationError } from "../errors.ts";
import { newId } from "../model.ts";
import { validateOnboardingProgressDecision } from "../onboarding-work.ts";

export interface OnboardingProgressEvaluationRequest {
    projection: Projection;
    onboardingWork: ProjectedOnboardingWork;
    input: string;
}

export type OnboardingProgressEvaluator = (
    request: OnboardingProgressEvaluationRequest,
) => Promise<OnboardingProgressDecision>;

export const ONBOARDING_PROGRESS_INSTRUCTION = [
    "Classify only explicit onboarding meaning in the current user input.",
    "Return exact JSON with decision_version 1 and one update per relevant topic; every update contains topic, action, and basis.",
    "Topics are forms_of_address, agent_personality, expectations, and optional_capabilities.",
    "Actions are leave_open, defer, decline, resolve, and resume.",
    "Use resolve only when the user supplied useful topic information, decline for an explicit refusal, defer for later/not-now intent, and resume only when explicitly reopening deferred work.",
    "A request to skip or finish all onboarding declines every unfinished topic.",
    "For real work or unrelated conversation, return an empty updates array.",
    "Basis must be a short exact quote from the current user input that supports that update.",
    "Do not infer facts, preferences, consent, or completion from the agent reply.",
].join(" ");

export function createProviderOnboardingProgressEvaluator(
    provider: AiExecutor,
    timeoutSeconds: number,
): OnboardingProgressEvaluator {
    return async ({ projection, onboardingWork, input }) => {
        const controlProjection: Projection = {
            ...projection,
            current_input: ONBOARDING_PROGRESS_INSTRUCTION,
            onboarding_work: onboardingWork,
        };
        const result = await provider(
            {
                contractVersion: 1,
                cognitionId: newId("cognition"),
                projection: controlProjection,
                input: {
                    text: `${ONBOARDING_PROGRESS_INSTRUCTION} ${JSON.stringify({ onboarding_work: onboardingWork, current_user_input: input })}`,
                },
            },
            { timeoutSeconds },
        );
        let decision: unknown;
        try {
            decision = JSON.parse(result.reply);
        } catch (error) {
            throw new ValidationError("onboarding progress evaluator returned invalid JSON", { cause: error });
        }
        validateOnboardingProgressDecision(decision, input);
        return decision;
    };
}
