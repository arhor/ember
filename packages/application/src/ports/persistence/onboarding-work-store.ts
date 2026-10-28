import type { OnboardingWorkDocument } from "@ember/domain/onboarding-work.ts";
export interface OnboardingWorkStore {
    readonly path: string;
    load(): Promise<OnboardingWorkDocument | null>;
    save(document: OnboardingWorkDocument): Promise<void>;
}
