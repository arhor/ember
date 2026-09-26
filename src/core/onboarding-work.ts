import { exactKeys, isObject } from "./util.ts";
import { ValidationError } from "./errors.ts";
import { isRfc3339Utc } from "./model.ts";

export const ONBOARDING_TOPICS = [
    "forms_of_address",
    "agent_personality",
    "expectations",
    "optional_capabilities",
] as const;
export type OnboardingTopic = (typeof ONBOARDING_TOPICS)[number];
export type OnboardingTopicStatus = "open" | "deferred" | "declined" | "resolved";
export type OnboardingProgressAction = "leave_open" | "defer" | "decline" | "resolve" | "resume";

export interface OnboardingProgressDecision {
    decision_version: 1;
    updates: Array<{ topic: OnboardingTopic; action: OnboardingProgressAction; basis: string }>;
}

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
    status: "pending_activation" | "active" | "closed";
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

/**
 * Backfills topics introduced after a document was persisted, as newly `open` (or
 * `declined` on an already-closed document, to preserve the closed/unfinished-topic
 * invariant) without inventing evidence for a topic that was never surfaced.
 */
export function migrateOnboardingWorkTopics(value: unknown): unknown {
    if (!isObject(value) || !Array.isArray(value.topics)) return value;
    const present = new Set(value.topics.map((item) => (isObject(item) ? item.topic : undefined)));
    const missing = ONBOARDING_TOPICS.filter((topic) => !present.has(topic));
    if (missing.length === 0) return value;
    const backfillStatus: OnboardingTopicStatus = value.status === "closed" ? "declined" : "open";
    const updatedAt =
        typeof value.updated_at === "string"
            ? value.updated_at
            : typeof value.created_at === "string"
              ? value.created_at
              : new Date().toISOString();
    return {
        ...value,
        topics: [
            ...value.topics,
            ...missing.map((topic) => ({
                topic,
                status: backfillStatus,
                updated_at: updatedAt,
                source_evidence_ids: [],
            })),
        ],
    };
}

export function createOnboardingWork(
    lineageId: string,
    principal: string,
    scope: string,
    timestamp: string,
    status: OnboardingWorkDocument["status"] = "active",
): OnboardingWorkDocument {
    const document: OnboardingWorkDocument = {
        onboarding_work_version: 1,
        lineage_id: lineageId,
        principal,
        scope,
        status,
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
    if (document === null || document.status !== "active") return undefined;
    return {
        work_version: 1,
        status: "active",
        guidance:
            "Treat onboarding as optional ordinary conversation; never fabricate a user turn to force it. forms_of_address covers both what to call the user and what name the user would like to use for you; agent_personality covers what personality, tone, or interaction style the user wants from you. If forms_of_address and agent_personality are both still open, you may combine them into one welcoming invitation on your first substantive reply asking all three at once: what to call the user, what to call you, and what personality or style they want from you. Otherwise invite at most one other useful open topic per turn. The user may answer any subset, skip, or defer any part; respect deferred and declined topics, and never request reusable secrets. When Telegram is wanted, explain BotFather and propose the trusted local setup handoff; never ask for its token in conversation.",
        topics: document.topics.map(({ topic, status }) => ({ topic, status })),
    };
}

export function applyOnboardingProgressDecision(
    document: OnboardingWorkDocument,
    decision: OnboardingProgressDecision,
    evidenceId: string,
    timestamp: string,
): OnboardingWorkDocument {
    validateOnboardingWork(document);
    validateOnboardingProgressDecision(decision);
    if (document.status !== "active") return structuredClone(document);
    const next = structuredClone(document);
    for (const update of decision.updates) {
        const item = next.topics.find((candidate) => candidate.topic === update.topic)!;
        const status = progressStatus(item.status, update.action);
        if (status === item.status) continue;
        item.status = status;
        item.updated_at = timestamp;
        if (!item.source_evidence_ids.includes(evidenceId)) item.source_evidence_ids.push(evidenceId);
    }
    if (next.topics.every((item) => item.status === "resolved" || item.status === "declined")) next.status = "closed";
    next.updated_at = timestamp;
    validateOnboardingWork(next);
    return next;
}

export function validateOnboardingProgressDecision(
    value: unknown,
    currentInput?: string,
): asserts value is OnboardingProgressDecision {
    if (
        !isObject(value) ||
        !exactKeys(value, ["decision_version", "updates"]) ||
        value.decision_version !== 1 ||
        !Array.isArray(value.updates)
    )
        throw new ValidationError("onboarding progress decision is invalid");
    const seen = new Set<string>();
    for (const update of value.updates) {
        if (
            !isObject(update) ||
            !exactKeys(update, ["topic", "action", "basis"]) ||
            !ONBOARDING_TOPICS.includes(update.topic as OnboardingTopic) ||
            !["leave_open", "defer", "decline", "resolve", "resume"].includes(String(update.action)) ||
            typeof update.basis !== "string" ||
            !update.basis.trim() ||
            update.basis.length > 512 ||
            (currentInput !== undefined &&
                !currentInput.toLocaleLowerCase().includes(update.basis.toLocaleLowerCase())) ||
            seen.has(String(update.topic))
        )
            throw new ValidationError("onboarding progress update is invalid");
        seen.add(String(update.topic));
    }
}

function progressStatus(current: OnboardingTopicStatus, action: OnboardingProgressAction): OnboardingTopicStatus {
    if (action === "leave_open") return current;
    if (action === "resume") return current === "deferred" ? "open" : current;
    if (current === "declined" || current === "resolved") return current;
    if (action === "defer") return "deferred";
    return action === "decline" ? "declined" : "resolved";
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
        !["pending_activation", "active", "closed"].includes(String(value.status)) ||
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
            !item.source_evidence_ids.every((id) => typeof id === "string" && id.startsWith("evidence-")) ||
            new Set(item.source_evidence_ids).size !== item.source_evidence_ids.length
        )
            throw new ValidationError("onboarding work topic is invalid");
        seen.add(String(item.topic));
    }
    if (value.status === "closed" && value.topics.some((item) => item.status === "open" || item.status === "deferred"))
        throw new ValidationError("closed onboarding work contains unfinished topics");
}
