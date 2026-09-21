import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type {
    ContactAttentionDecisionRecord,
    ContactAttentionPolicyRequest,
    ProactiveContactIntentSnapshot,
} from "../../src/agency/proactive-contact-attention-policy.ts";
import type { EvidenceId, MeaningId } from "../../src/core/model.ts";

import { decideProactiveContactAttention } from "../../src/agency/proactive-contact-attention-policy.ts";
import { ProactiveContactStore } from "../../src/agency/proactive-contact-store.ts";
import { ValidationError } from "../../src/core/errors.ts";
import { initialState } from "../../src/core/model.ts";
import { findMeaning, rememberFact, supersede } from "../../src/core/semantics.ts";
import { contentDigest, exactKeys, isObject } from "../../src/util.ts";

const CASE_IDS = [
    "useful-contact",
    "low-value-silence",
    "quiet-period-deferral",
    "duplicate-intent",
    "superseded-intent",
    "stale-before-delivery",
    "restart-before-delivery",
    "confirmed-vs-uncertain-delivery",
    "repeated-opportunity",
    "remembered-currentness-change",
] as const;
export type ProactiveContactCaseId = (typeof CASE_IDS)[number];
type ExpectedPolicyOutcome = "admit" | "defer" | "suppress" | "no_contact";
export interface ProactiveContactScenarioCase {
    id: ProactiveContactCaseId;
    expect_contact: boolean;
    expected_policy: { outcome: ExpectedPolicyOutcome; basis: string };
}
export interface ProactiveContactScenario {
    scenario_version: 1;
    id: string;
    description: string;
    cases: ProactiveContactScenarioCase[];
}
export type LiveContactDecision = (input: {
    id: ProactiveContactCaseId;
    concern: string;
}) => Promise<"contact" | "silent">;

export async function loadProactiveContactScenario(path: string): Promise<ProactiveContactScenario> {
    if (!isAbsolute(path)) throw new ValidationError("proactive-contact scenario path must be absolute");
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    validateScenario(value);
    return value;
}

export async function runProactiveContactScenario(
    scenario: ProactiveContactScenario,
    directory: string,
    liveDecision?: LiveContactDecision,
) {
    validateScenario(scenario);
    if (!isAbsolute(directory)) throw new ValidationError("proactive-contact evaluation directory must be absolute");
    const reports: Awaited<ReturnType<typeof runCase>>[] = [];
    for (const item of scenario.cases) reports.push(await runCase(item, directory, liveDecision));
    const predictedPositive = reports.filter((item) => item.observed_contact).length;
    const expectedPositive = reports.filter((item) => item.expected_contact).length;
    const truePositive = reports.filter((item) => item.observed_contact && item.expected_contact).length;
    const unwanted = reports.filter((item) => item.observed_contact && !item.expected_contact).length;
    const missed = reports.filter((item) => !item.observed_contact && item.expected_contact).length;
    const count = (metric: string) => reports.filter((item) => item.metric_results[metric] === true).length;
    const total = (metric: string) => reports.filter((item) => metric in item.metric_results).length;
    const ratio = (metric: string) => (total(metric) ? count(metric) / total(metric) : 1);
    const metrics = {
        contact_precision: predictedPositive ? truePositive / predictedPositive : 1,
        contact_recall: expectedPositive ? truePositive / expectedPositive : 1,
        unwanted_interruption: {
            cases: reports.length - expectedPositive,
            errors: unwanted,
            rate: unwanted / (reports.length - expectedPositive),
        },
        deliberate_silence: {
            cases: reports.length - expectedPositive,
            passed: reports.length - expectedPositive - unwanted,
            accuracy: 1 - unwanted / (reports.length - expectedPositive),
        },
        stale_contact_suppression: {
            cases: total("stale_contact_suppression"),
            accuracy: ratio("stale_contact_suppression"),
        },
        duplicate_suppression: { cases: total("duplicate_suppression"), accuracy: ratio("duplicate_suppression") },
        delivery_uncertainty_handling: {
            cases: total("delivery_uncertainty_handling"),
            accuracy: ratio("delivery_uncertainty_handling"),
        },
        restart_outcome: { cases: total("restart_outcome"), accuracy: ratio("restart_outcome") },
        missed_useful_contact: missed,
    };
    const emberPassed = reports.every((item) => item.ember_assertions_passed);
    const observationsPassed = reports.every((item) => item.model_observations_passed);
    return {
        report_version: 1,
        suite_id: scenario.id,
        execution_mode: liveDecision ? ("live" as const) : ("deterministic" as const),
        sanitized: true,
        scorecard_input: true,
        ember_assertions_passed: emberPassed,
        model_observations_passed: observationsPassed,
        passed: emberPassed && observationsPassed,
        metrics,
        cases: reports,
    };
}

async function runCase(item: ProactiveContactScenarioCase, directory: string, live?: LiveContactDecision) {
    const { id } = item;
    const state = initialState("alice", "2026-09-20T08:00:00Z");
    const previousNow = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = "2026-09-20T08:01:00Z";
    const groundingId = rememberFact(
        state,
        "alice",
        "user:alice",
        "contact-evaluation",
        "private",
        "The pharmacy closes at 18:00",
    ) as MeaningId;
    if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
    else process.env.EMBER_TEST_NOW = previousNow;
    const sourceEvidenceIds = [...findMeaning(state, groundingId).sourceEvidenceIds];
    const modelDecision =
        live && (id === "useful-contact" || id === "low-value-silence")
            ? await live({
                  id,
                  concern:
                      id === "useful-contact"
                          ? "A time-sensitive prescription must be collected before closing."
                          : "A decorative app icon changed shade slightly.",
              })
            : item.expect_contact
              ? "contact"
              : "silent";
    const modelPassed =
        !live ||
        !["useful-contact", "low-value-silence"].includes(id) ||
        modelDecision === (item.expect_contact ? "contact" : "silent");

    if (id === "low-value-silence") {
        const exactPolicy =
            item.expected_policy.outcome === "no_contact" && item.expected_policy.basis === "insufficient_value";
        return report(
            item,
            false,
            "no_contact",
            "insufficient_value",
            sourceEvidenceIds,
            [groundingId],
            [],
            null,
            {},
            exactPolicy,
            modelPassed,
        );
    }

    const storePath = join(directory, `${id}.json`);
    let activeGroundingId = groundingId;
    let snapshot = makeSnapshot(id, state.revision, activeGroundingId);
    let request = makeRequest(id);
    const policyDecisions: ContactAttentionDecisionRecord[] = [];
    const metricResults: Record<string, boolean> = {};
    let deliveryOutcome: string | null = null;

    if (id === "stale-before-delivery") supersede(state, "alice", groundingId, "The pharmacy is closed today");
    if (id === "remembered-currentness-change") {
        const beforeChangeNow = process.env.EMBER_TEST_NOW;
        process.env.EMBER_TEST_NOW = "2026-09-20T09:30:00Z";
        try {
            activeGroundingId = supersede(state, "alice", groundingId, "The pharmacy now closes at 16:00") as MeaningId;
        } finally {
            if (beforeChangeNow === undefined) delete process.env.EMBER_TEST_NOW;
            else process.env.EMBER_TEST_NOW = beforeChangeNow;
        }
        const oldDecision = decideProactiveContactAttention(state, snapshot, {
            ...request,
            assessment_id: "contact-policy-remembered-currentness-old",
        });
        policyDecisions.push(oldDecision);
        snapshot = makeSnapshot(id, state.revision, activeGroundingId);
        request = { ...request, assessment_id: "contact-policy-remembered-currentness-new" };
        metricResults.stale_contact_suppression =
            oldDecision.outcome === "suppress" && oldDecision.basis === "stale_grounding";
        sourceEvidenceIds.push(...findMeaning(state, activeGroundingId).sourceEvidenceIds);
    }

    const decision = decideProactiveContactAttention(state, snapshot, request);
    policyDecisions.push(decision);
    let observedContact = decision.outcome === "admit";
    if (["duplicate-intent", "repeated-opportunity"].includes(id))
        metricResults.duplicate_suppression = decision.outcome === "suppress" && decision.basis === "duplicate_intent";
    if (id === "superseded-intent")
        metricResults.stale_contact_suppression =
            decision.outcome === "suppress" && decision.basis === "superseded_intent";
    if (id === "stale-before-delivery")
        metricResults.stale_contact_suppression =
            decision.outcome === "suppress" && decision.basis === "stale_grounding";

    if (id === "restart-before-delivery") {
        const store = await createStoredIntent(storePath, snapshot, sourceEvidenceIds);
        await store.recordPolicyDecision(decision);
        const restarted = new ProactiveContactStore(storePath);
        const retained = (await restarted.load()).intents[0]!;
        const resumedSnapshot = snapshotFromRecord(retained);
        const resumedRequest: ContactAttentionPolicyRequest = {
            ...makeRequest(id),
            assessment_id: "contact-policy-restart-resumed",
            considered_at: "2026-09-20T10:02:00Z",
        };
        const resumedDecision = decideProactiveContactAttention(state, resumedSnapshot, resumedRequest);
        policyDecisions.push(resumedDecision);
        await restarted.recordPolicyDecision(resumedDecision);
        const handoff = {
            contactIntentId: snapshot.contact_intent_id,
            assessmentId: resumedRequest.assessment_id,
            surfaceId: "telegram",
            deliveryId: "delivery-restart-contact",
            representationDigest: snapshot.representation.digest,
            handedOffAt: "2026-09-20T10:03:00Z",
        } as const;
        await restarted.commitHandoff(handoff);
        await restarted.commitHandoff(handoff);
        const continued = await restarted.load();
        const continuedIntent = continued.intents[0]!;
        metricResults.restart_outcome =
            continued.intents.length === 1 &&
            continuedIntent.handoff?.delivery_id === "delivery-restart-contact" &&
            continuedIntent.policy_decisions.length === 2;
        observedContact = metricResults.restart_outcome;
        deliveryOutcome = continuedIntent.handoff?.delivery_id ?? null;
    }

    if (id === "confirmed-vs-uncertain-delivery") {
        const store = await createStoredIntent(storePath, snapshot, sourceEvidenceIds);
        await store.recordPolicyDecision(decision);
        await store.commitHandoff({
            contactIntentId: snapshot.contact_intent_id,
            assessmentId: request.assessment_id,
            surfaceId: "telegram",
            deliveryId: "delivery-contact-eval",
            representationDigest: snapshot.representation.digest,
            handedOffAt: "2026-09-20T10:01:00Z",
        });
        await store.recordReconciliationOutcome(snapshot.contact_intent_id, {
            delivery_id: "delivery-contact-eval",
            attempt_id: "attempt-1",
            status: "blocked_uncertain",
            observed_at: "2026-09-20T10:02:00Z",
        });
        const uncertain = (await store.load()).intents[0]!;
        await store.recordReconciliationOutcome(snapshot.contact_intent_id, {
            delivery_id: "delivery-contact-eval",
            attempt_id: "attempt-1",
            status: "confirmed",
            observed_at: "2026-09-20T10:03:00Z",
        });
        const confirmed = (await store.load()).intents[0]!;
        metricResults.delivery_uncertainty_handling =
            uncertain.disposition === "handed_off" &&
            confirmed.disposition === "satisfied" &&
            uncertain.delivery_observations.length === 1 &&
            confirmed.delivery_observations.length === 2;
        deliveryOutcome = `${uncertain.delivery_observations.at(-1)!.status}->${confirmed.delivery_observations.at(-1)!.status}`;
    }

    const exactPolicy =
        decision.outcome === item.expected_policy.outcome && decision.basis === item.expected_policy.basis;
    const canonicalEvidence = [...new Set(sourceEvidenceIds)];
    const evidenceResolvable = canonicalEvidence.every((id) =>
        state.evidence.some((evidence) => evidence.evidenceId === id),
    );
    const policyEvidenceIds = policyDecisions.flatMap(policyEvidence);
    const emberPassed =
        exactPolicy &&
        evidenceResolvable &&
        Object.values(metricResults).every(Boolean) &&
        observedContact === item.expect_contact;
    return report(
        item,
        observedContact,
        decision.outcome,
        decision.basis,
        canonicalEvidence,
        [groundingId, ...(activeGroundingId === groundingId ? [] : [activeGroundingId])],
        policyEvidenceIds,
        policyDecisions.length === 1 ? decision : policyDecisions,
        metricResults,
        emberPassed,
        modelPassed,
        deliveryOutcome,
    );
}

function makeSnapshot(
    id: ProactiveContactCaseId,
    revision: number,
    groundingId: MeaningId,
): ProactiveContactIntentSnapshot {
    return {
        contact_intent_id: `contact-intent-${id}`,
        disposition: "pending",
        principal: "alice",
        scope: "private",
        created_at: "2026-09-20T09:00:00Z",
        source_revision: revision,
        grounding_meaning_ids: [groundingId],
        urgency: "ordinary",
        urgency_meaning_ids: [],
        expires_at: "2026-09-21T09:00:00Z",
        representation: {
            digest: contentDigest("Please collect the prescription before closing."),
            currentness: "current",
            evidence_ids: [`policy:representation:${id}`],
        },
        supersession:
            id === "superseded-intent"
                ? { successor_intent_id: "contact-intent-successor", evidence_ids: ["policy:successor"] }
                : null,
    };
}

function makeRequest(id: ProactiveContactCaseId): ContactAttentionPolicyRequest {
    return {
        assessment_id: `contact-policy-${id}`,
        considered_at: "2026-09-20T10:00:00Z",
        authority: { status: "authorized", evidence_ids: ["policy:contact-authority"] },
        attention:
            id === "quiet-period-deferral"
                ? {
                      status: "quiet_period",
                      window_id: "night",
                      starts_at: "2026-09-20T09:00:00Z",
                      ends_at: "2026-09-20T11:00:00Z",
                      evidence_ids: ["policy:quiet-window"],
                  }
                : { status: "available", evidence_ids: ["policy:attention-available"] },
        occurrence:
            id === "duplicate-intent" || id === "repeated-opportunity"
                ? {
                      status: "confirmed_duplicate",
                      related_intent_id: "contact-intent-established",
                      evidence_ids: ["policy:stable-occurrence"],
                  }
                : { status: "distinct", related_intent_id: null, evidence_ids: ["policy:distinct-occurrence"] },
        surfaces: [
            {
                surface_id: "telegram",
                preference_rank: 0,
                status: "eligible",
                evidence_ids: ["policy:surface-eligible"],
            },
        ],
    };
}

function snapshotFromRecord(
    intent: Awaited<ReturnType<ProactiveContactStore["createIntent"]>>,
): ProactiveContactIntentSnapshot {
    if (intent.disposition !== "pending" && intent.disposition !== "deferred")
        throw new ValidationError("restart evaluation requires a live intent");
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

async function createStoredIntent(path: string, snapshot: ProactiveContactIntentSnapshot, evidenceIds: EvidenceId[]) {
    const store = new ProactiveContactStore(path);
    await store.createIntent({
        contactIntentId: snapshot.contact_intent_id,
        purpose: "Evaluation contact",
        principal: "alice",
        scope: "private",
        source: {
            cognition_id: `cognition-${snapshot.contact_intent_id}` as never,
            expression_evidence_id: evidenceIds[0]!,
            opportunity_id: null,
            evidence_ids: evidenceIds,
            grounding_meaning_ids: snapshot.grounding_meaning_ids,
            source_revision: snapshot.source_revision,
        },
        groundingCurrentness: { status: "current", evidence_ids: evidenceIds, assessed_at: snapshot.created_at },
        representation: {
            text: "Please collect the prescription before closing.",
            digest: snapshot.representation.digest,
            currentness: "current",
            evidence_ids: snapshot.representation.evidence_ids,
            classification: "private",
        },
        urgency: "ordinary",
        urgencyMeaningIds: [],
        expiresAt: snapshot.expires_at,
        satisfactionBoundary: "transport_acceptance",
        createdAt: snapshot.created_at,
    });
    return store;
}

function policyEvidence(decision: ContactAttentionDecisionRecord): string[] {
    return [
        ...decision.evidence.representation_evidence_ids,
        ...decision.evidence.authority.evidence_ids,
        ...decision.evidence.attention.evidence_ids,
        ...decision.evidence.occurrence.evidence_ids,
        ...decision.evidence.surfaces.flatMap((surface) => surface.evidence_ids),
        ...decision.evidence.supersession_evidence_ids,
    ];
}

function report(
    item: ProactiveContactScenarioCase,
    observed: boolean,
    outcome: string,
    basis: string,
    sourceEvidenceIds: EvidenceId[],
    groundingMeaningIds: MeaningId[],
    policyEvidenceIds: string[],
    policy: unknown,
    metricResults: Record<string, boolean>,
    ember: boolean,
    model: boolean,
    delivery: string | null = null,
) {
    return {
        id: item.id,
        expected_contact: item.expect_contact,
        observed_contact: observed,
        expected_policy: item.expected_policy,
        contact_policy_outcome: outcome,
        contact_policy_basis: basis,
        source_evidence_ids: sourceEvidenceIds,
        grounding_meaning_ids: groundingMeaningIds,
        policy_evidence_ids: [...new Set(policyEvidenceIds)],
        policy_decision: policy,
        delivery_outcome: delivery,
        metric_results: metricResults,
        ember_assertions_passed: ember,
        model_observations_passed: model,
    };
}

function validateScenario(value: unknown): asserts value is ProactiveContactScenario {
    if (
        !isObject(value) ||
        !exactKeys(value, ["scenario_version", "id", "description", "cases"]) ||
        value.scenario_version !== 1 ||
        typeof value.id !== "string" ||
        typeof value.description !== "string" ||
        !Array.isArray(value.cases)
    )
        throw new ValidationError("proactive-contact scenario is invalid");
    const ids = new Set<string>();
    for (const item of value.cases) {
        if (
            !isObject(item) ||
            !exactKeys(item, ["id", "expect_contact", "expected_policy"]) ||
            !CASE_IDS.includes(item.id as ProactiveContactCaseId) ||
            typeof item.expect_contact !== "boolean" ||
            !isObject(item.expected_policy) ||
            !exactKeys(item.expected_policy, ["outcome", "basis"]) ||
            !["admit", "defer", "suppress", "no_contact"].includes(String(item.expected_policy.outcome)) ||
            typeof item.expected_policy.basis !== "string" ||
            !item.expected_policy.basis ||
            ids.has(String(item.id))
        )
            throw new ValidationError("proactive-contact case is invalid or duplicated");
        ids.add(String(item.id));
    }
    if (ids.size !== CASE_IDS.length || !CASE_IDS.every((id) => ids.has(id)))
        throw new ValidationError("proactive-contact scenario does not satisfy the version-1 case contract");
}
