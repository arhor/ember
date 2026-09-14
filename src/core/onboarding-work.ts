import { exactKeys, isObject } from "../util.ts";
import { ValidationError } from "./errors.ts";
import { isRfc3339Utc } from "./model.ts";

export const ONBOARDING_TOPICS = ["forms_of_address", "expectations", "optional_capabilities"] as const;
export type OnboardingTopic = (typeof ONBOARDING_TOPICS)[number];
export type OnboardingTopicStatus = "open" | "deferred" | "declined" | "resolved";

export interface OnboardingTopicWork {
    topic: OnboardingTopic;
    status: OnboardingTopicStatus;
    updated_at: string;
    source_evidence_ids: string[];
}

export interface OnboardingWorkDocument {
    onboarding_work_version: 1;
    lineage_id: string;
    principal: string;
    scope: string;
    status: "active" | "closed";
    created_at: string;
    updated_at: string;
    topics: OnboardingTopicWork[];
}

export interface ProjectedOnboardingWork {
    work_version: 1;
    status: "active";
    guidance: string;
    topics: Array<{ topic: OnboardingTopic; status: OnboardingTopicStatus }>;
}

export function createOnboardingWork(
    lineageId: string,
    principal: string,
    scope: string,
    timestamp: string,
): OnboardingWorkDocument {
    const document: OnboardingWorkDocument = {
        onboarding_work_version: 1,
        lineage_id: lineageId,
        principal,
        scope,
        status: "active",
        created_at: timestamp,
        updated_at: timestamp,
        topics: ONBOARDING_TOPICS.map((topic) => ({
            topic,
            status: "open",
            updated_at: timestamp,
            source_evidence_ids: [],
        })),
    };
    validateOnboardingWork(document);
    return document;
}

export function projectOnboardingWork(document: OnboardingWorkDocument | null): ProjectedOnboardingWork | undefined {
    if (document === null || document.status === "closed") return undefined;
    return {
        work_version: 1,
        status: "active",
        guidance:
            "Treat onboarding as optional ordinary conversation. Address the user's current request first. Invite at most one useful open topic; respect deferred and declined topics, and never request reusable secrets.",
        topics: document.topics.map(({ topic, status }) => ({ topic, status })),
    };
}

export function advanceOnboardingWork(
    document: OnboardingWorkDocument,
    text: string,
    evidenceId: string,
    timestamp: string,
): OnboardingWorkDocument {
    validateOnboardingWork(document);
    if (document.status === "closed") return structuredClone(document);
    const next = structuredClone(document);
    const normalized = text.trim().toLowerCase();
    const set = (topics: readonly OnboardingTopic[], status: OnboardingTopicStatus) => {
        for (const item of next.topics) {
            if (!topics.includes(item.topic)) continue;
            item.status = status;
            item.updated_at = timestamp;
            if (!item.source_evidence_ids.includes(evidenceId)) item.source_evidence_ids.push(evidenceId);
        }
    };
    if (/\b(skip|stop|finish|end)\b.*\bonboarding\b|\bno onboarding\b/.test(normalized)) {
        set(ONBOARDING_TOPICS, "declined");
    } else if (/\b(defer|pause)\b.*\bonboarding\b|\bonboarding\b.*\b(later|not now)\b/.test(normalized)) {
        set(
            next.topics.filter((item) => item.status === "open").map((item) => item.topic),
            "deferred",
        );
    } else if (/\b(resume|continue)\b.*\bonboarding\b/.test(normalized)) {
        set(
            next.topics.filter((item) => item.status === "deferred").map((item) => item.topic),
            "open",
        );
    } else {
        if (/\b(call me|my name is|address me as|your name is|i(?:'ll| will) call you)\b/.test(normalized))
            set(["forms_of_address"], "resolved");
        if (/\b(i expect|i prefer (?:you|our)|please always|please never|boundary|boundaries)\b/.test(normalized))
            set(["expectations"], "resolved");
        if (/\b(no integrations|skip integrations|don't configure|do not configure)\b/.test(normalized))
            set(["optional_capabilities"], "declined");
        else if (/\b(telegram|integration|capabilit(?:y|ies))\b/.test(normalized))
            set(["optional_capabilities"], "resolved");
    }
    if (next.topics.every((item) => item.status === "resolved" || item.status === "declined")) next.status = "closed";
    next.updated_at = timestamp;
    validateOnboardingWork(next);
    return next;
}

export function validateOnboardingWork(value: unknown): asserts value is OnboardingWorkDocument {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "onboarding_work_version",
            "lineage_id",
            "principal",
            "scope",
            "status",
            "created_at",
            "updated_at",
            "topics",
        ])
    )
        throw new ValidationError("onboarding work contains missing or unsupported fields");
    if (
        value.onboarding_work_version !== 1 ||
        typeof value.lineage_id !== "string" ||
        !value.lineage_id.startsWith("lineage-") ||
        typeof value.principal !== "string" ||
        !value.principal.trim() ||
        typeof value.scope !== "string" ||
        !value.scope.trim() ||
        !["active", "closed"].includes(String(value.status)) ||
        !isRfc3339Utc(value.created_at) ||
        !isRfc3339Utc(value.updated_at) ||
        !Array.isArray(value.topics)
    )
        throw new ValidationError("onboarding work is invalid");
    if (value.topics.length !== ONBOARDING_TOPICS.length)
        throw new ValidationError("onboarding work topics are incomplete");
    const seen = new Set<string>();
    for (const item of value.topics) {
        if (
            !isObject(item) ||
            !exactKeys(item, ["topic", "status", "updated_at", "source_evidence_ids"]) ||
            !ONBOARDING_TOPICS.includes(item.topic as OnboardingTopic) ||
            seen.has(String(item.topic)) ||
            !["open", "deferred", "declined", "resolved"].includes(String(item.status)) ||
            !isRfc3339Utc(item.updated_at) ||
            !Array.isArray(item.source_evidence_ids) ||
            !item.source_evidence_ids.every((id) => typeof id === "string")
        )
            throw new ValidationError("onboarding work topic is invalid");
        seen.add(String(item.topic));
    }
    if (value.status === "closed" && value.topics.some((item) => item.status === "open" || item.status === "deferred"))
        throw new ValidationError("closed onboarding work contains unfinished topics");
}
