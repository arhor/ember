import { readFile } from "node:fs/promises";

import type { OnboardingWorkDocument } from "../core/onboarding-work.ts";

import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { migrateOnboardingWorkTopics, validateOnboardingWork } from "../core/onboarding-work.ts";
import { replaceFileDurably } from "./file-replacement.ts";

export class OnboardingWorkStore {
    readonly path: string;
    constructor(statePath: string) {
        if (!statePath.trim()) throw new ValidationError("onboarding work store requires a state path");
        this.path = `${statePath}.onboarding.json`;
    }
    async load(): Promise<OnboardingWorkDocument | null> {
        let text: string;
        try {
            text = await readFile(this.path, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw new StoreUnavailable(`cannot read onboarding work ${this.path}`, { cause: error });
        }
        try {
            const value = migrateOnboardingWorkTopics(JSON.parse(text));
            validateOnboardingWork(value);
            return value;
        } catch (error) {
            throw new StoreUnavailable("onboarding work is invalid", { cause: error });
        }
    }
    async save(document: OnboardingWorkDocument): Promise<void> {
        validateOnboardingWork(document);
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage:
                "onboarding work replacement may be visible, but directory synchronization failed",
        });
    }
}
