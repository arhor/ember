import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { EmberState } from "../core/model.ts";
import type {
    ContactAttentionDecisionRecord,
    ContactAttentionWindow,
    ContactOccurrenceAssessment,
    ProactiveContactIntentSnapshot,
} from "./proactive-contact-attention-policy.ts";
import type { ProactiveContactIntentRecord } from "./proactive-contact-store.ts";

import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";
import { exactKeys, isObject } from "../util.ts";
import { decideProactiveContactAttention } from "./proactive-contact-attention-policy.ts";
import { ProactiveContactStore } from "./proactive-contact-store.ts";

export interface ConfiguredProactiveContactPolicy {
    policy_version: 1;
    authority: {
        status: "authorized" | "unknown" | "denied";
        source_id: string;
    };
    attention:
        | {
              kind: "always_available";
              source_id: string;
          }
        | {
              kind: "daily_quiet_hours_utc";
              source_id: string;
              window_id: string;
              starts_at: string;
              ends_at: string;
          };
    surface: {
        preference_rank: number;
        source_id: string;
    };
}

export async function loadConfiguredProactiveContactPolicy(path: string): Promise<ConfiguredProactiveContactPolicy> {
    let value: unknown;
    try {
        value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
        if (error instanceof SyntaxError)
            throw new ValidationError("configured proactive contact policy is not valid JSON");
        throw error;
    }
    validateConfiguredProactiveContactPolicy(value);
    return value;
}

export async function decideConfiguredProactiveContactHandoff({
    state,
    statePath,
    intent,
    consideredAt,
    surfaceId,
    policy,
}: {
    state: EmberState;
    statePath: string;
    intent: ProactiveContactIntentRecord;
    consideredAt: string;
    surfaceId: string;
    policy: ConfiguredProactiveContactPolicy;
}): Promise<ContactAttentionDecisionRecord> {
    validateConfiguredProactiveContactPolicy(policy);
    const occurrence = await observeOccurrence(statePath, intent);
    return decideProactiveContactAttention(state, snapshot(intent), {
        assessment_id: `contact-policy-${randomUUID()}`,
        considered_at: consideredAt,
        authority: {
            status: policy.authority.status,
            evidence_ids: [policy.authority.source_id],
        },
        attention: observeAttention(policy.attention, consideredAt),
        occurrence,
        surfaces: [
            {
                surface_id: surfaceId,
                preference_rank: policy.surface.preference_rank,
                status: "eligible",
                evidence_ids: [policy.surface.source_id],
            },
        ],
    });
}

export function validateConfiguredProactiveContactPolicy(
    value: unknown,
): asserts value is ConfiguredProactiveContactPolicy {
    if (!isObject(value) || !exactKeys(value, ["attention", "authority", "policy_version", "surface"]))
        throw new ValidationError("configured proactive contact policy is invalid");
    if (value.policy_version !== 1)
        throw new ValidationError("configured proactive contact policy version is unsupported");
    if (!isObject(value.authority) || !exactKeys(value.authority, ["source_id", "status"]))
        throw new ValidationError("configured proactive contact authority is invalid");
    if (
        !(
            value.authority.status === "authorized" ||
            value.authority.status === "unknown" ||
            value.authority.status === "denied"
        )
    )
        throw new ValidationError("configured proactive contact authority status is invalid");
    validateOpaque(value.authority.source_id, "configured proactive contact authority source");

    if (!isObject(value.attention)) throw new ValidationError("configured proactive contact attention is invalid");
    if (value.attention.kind === "always_available") {
        if (!exactKeys(value.attention, ["kind", "source_id"]))
            throw new ValidationError("configured proactive contact available attention is invalid");
    } else if (value.attention.kind === "daily_quiet_hours_utc") {
        if (!exactKeys(value.attention, ["ends_at", "kind", "source_id", "starts_at", "window_id"]))
            throw new ValidationError("configured proactive contact quiet hours are invalid");
        validateOpaque(value.attention.window_id, "configured proactive contact quiet-hours window");
        validateUtcTime(value.attention.starts_at, "configured proactive contact quiet-hours start");
        validateUtcTime(value.attention.ends_at, "configured proactive contact quiet-hours end");
        if (value.attention.starts_at === value.attention.ends_at)
            throw new ValidationError("configured proactive contact quiet hours cannot span a full day");
    } else {
        throw new ValidationError("configured proactive contact attention kind is invalid");
    }
    validateOpaque(value.attention.source_id, "configured proactive contact attention source");

    if (!isObject(value.surface) || !exactKeys(value.surface, ["preference_rank", "source_id"]))
        throw new ValidationError("configured proactive contact surface policy is invalid");
    if (!Number.isSafeInteger(value.surface.preference_rank) || (value.surface.preference_rank as number) < 0)
        throw new ValidationError("configured proactive contact surface preference must be a non-negative integer");
    validateOpaque(value.surface.source_id, "configured proactive contact surface source");
}

function snapshot(intent: ProactiveContactIntentRecord): ProactiveContactIntentSnapshot {
    if (!(intent.disposition === "pending" || intent.disposition === "deferred"))
        throw new ValidationError("configured proactive contact policy requires a pending or deferred intent");
    return {
        contact_intent_id: intent.contact_intent_id,
        disposition: intent.disposition,
        principal: intent.principal,
        scope: intent.scope,
        created_at: intent.created_at,
        source_revision: intent.source.source_revision,
        grounding_meaning_ids: [...intent.source.grounding_meaning_ids],
        urgency: intent.urgency,
        urgency_meaning_ids: [...intent.urgency_meaning_ids],
        expires_at: intent.expires_at,
        representation: {
            digest: intent.representation.digest,
            currentness: intent.representation.currentness,
            evidence_ids: [...intent.representation.evidence_ids],
        },
        supersession: null,
    };
}

async function observeOccurrence(
    statePath: string,
    intent: ProactiveContactIntentRecord,
): Promise<ContactOccurrenceAssessment> {
    const document = await new ProactiveContactStore(statePath).load();
    const established = document.intents
        .filter(
            (candidate) =>
                candidate.source.cognition_id === intent.source.cognition_id &&
                candidate.source.expression_evidence_id === intent.source.expression_evidence_id,
        )
        .toSorted(
            (left, right) =>
                Date.parse(left.created_at) - Date.parse(right.created_at) ||
                compareCodeUnits(left.contact_intent_id, right.contact_intent_id),
        )[0];
    if (established !== undefined && established.contact_intent_id !== intent.contact_intent_id) {
        return {
            status: "confirmed_duplicate",
            related_intent_id: established.contact_intent_id,
            evidence_ids: [`proactive-contact-store:shared-source:${established.contact_intent_id}`],
        };
    }
    return {
        status: "distinct",
        related_intent_id: null,
        evidence_ids: [`proactive-contact-store:stable-intent:${intent.contact_intent_id}`],
    };
}

function compareCodeUnits(left: string, right: string) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function observeAttention(
    attention: ConfiguredProactiveContactPolicy["attention"],
    consideredAt: string,
): ContactAttentionWindow {
    if (attention.kind === "always_available") {
        return { status: "available", evidence_ids: [attention.source_id] };
    }
    const instant = new Date(consideredAt);
    if (Number.isNaN(instant.getTime())) throw new ValidationError("proactive contact observation time is invalid");
    const startMinutes = utcMinutes(attention.starts_at);
    const endMinutes = utcMinutes(attention.ends_at);
    const currentMinutes = instant.getUTCHours() * 60 + instant.getUTCMinutes();
    const inside =
        startMinutes < endMinutes
            ? currentMinutes >= startMinutes && currentMinutes < endMinutes
            : currentMinutes >= startMinutes || currentMinutes < endMinutes;
    if (!inside) return { status: "available", evidence_ids: [attention.source_id] };

    const dayStart = Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
    const startsOnPreviousDay = startMinutes > endMinutes && currentMinutes < endMinutes;
    const endsOnNextDay = startMinutes > endMinutes && currentMinutes >= startMinutes;
    const startsAt = new Date(dayStart + startMinutes * 60_000 - (startsOnPreviousDay ? 86_400_000 : 0));
    const endsAt = new Date(dayStart + endMinutes * 60_000 + (endsOnNextDay ? 86_400_000 : 0));
    return {
        status: "quiet_period",
        window_id: attention.window_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        evidence_ids: [attention.source_id],
    };
}

function validateUtcTime(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
        throw new ValidationError(`${label} must be HH:MM UTC`);
}

function utcMinutes(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours! * 60 + minutes!;
}

function validateOpaque(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 256 || ASCII_CONTROL_CHARACTER_PATTERN.test(value))
        throw new ValidationError(`${label} is invalid`);
}
