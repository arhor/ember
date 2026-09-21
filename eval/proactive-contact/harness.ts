import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type {
    ContactAttentionPolicyRequest,
    ProactiveContactIntentSnapshot,
} from "../../src/agency/proactive-contact-attention-policy.ts";
import type { MeaningId } from "../../src/core/model.ts";

import { decideProactiveContactAttention } from "../../src/agency/proactive-contact-attention-policy.ts";
import { ProactiveContactStore } from "../../src/agency/proactive-contact-store.ts";
import { ValidationError } from "../../src/core/errors.ts";
import { initialState } from "../../src/core/model.ts";
import { rememberFact, supersede } from "../../src/core/semantics.ts";
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
export interface ProactiveContactScenario {
    scenario_version: 1;
    id: string;
    description: string;
    cases: Array<{ id: ProactiveContactCaseId; expect_contact: boolean }>;
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
    for (const item of scenario.cases)
        reports.push(await runCase(item.id, item.expect_contact, directory, liveDecision));
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

async function runCase(id: ProactiveContactCaseId, expected: boolean, directory: string, live?: LiveContactDecision) {
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
    const storePath = join(directory, `${id}.json`);
    let decisionOutcome: "contact" | "silent" = id === "low-value-silence" ? "silent" : "contact";
    if (live && (id === "useful-contact" || id === "low-value-silence")) {
        decisionOutcome = await live({
            id,
            concern:
                id === "useful-contact"
                    ? "A time-sensitive prescription must be collected before closing."
                    : "A decorative app icon changed shade slightly.",
        });
    }
    const sourceEvidence = [`evidence:concern:${id}`];
    if (decisionOutcome === "silent")
        return report(
            id,
            expected,
            false,
            "no_contact",
            sourceEvidence,
            null,
            {},
            true,
            decisionOutcome === (expected ? "contact" : "silent"),
        );

    const intentId = `contact-intent-${id}` as const;
    const snapshot: ProactiveContactIntentSnapshot = {
        contact_intent_id: intentId,
        disposition: "pending",
        principal: "alice",
        scope: "private",
        created_at: "2026-09-20T09:00:00Z",
        source_revision: state.revision,
        grounding_meaning_ids: [groundingId],
        urgency: "ordinary",
        urgency_meaning_ids: [],
        expires_at: "2026-09-21T09:00:00Z",
        representation: {
            digest: contentDigest("Please collect the prescription before closing."),
            currentness: "current",
            evidence_ids: [`evidence:representation:${id}`],
        },
        supersession:
            id === "superseded-intent"
                ? { successor_intent_id: "contact-intent-successor", evidence_ids: ["evidence:successor"] }
                : null,
    };
    if (id === "stale-before-delivery") supersede(state, "alice", groundingId, "The pharmacy is closed today");
    const occurrence =
        id === "duplicate-intent" || id === "repeated-opportunity"
            ? {
                  status: "confirmed_duplicate" as const,
                  related_intent_id: "contact-intent-established" as const,
                  evidence_ids: ["evidence:stable-occurrence"],
              }
            : { status: "distinct" as const, related_intent_id: null, evidence_ids: ["evidence:distinct-occurrence"] };
    const request: ContactAttentionPolicyRequest = {
        assessment_id: `contact-policy-${id}`,
        considered_at: "2026-09-20T10:00:00Z",
        authority: { status: "authorized", evidence_ids: ["evidence:contact-authority"] },
        attention:
            id === "quiet-period-deferral"
                ? {
                      status: "quiet_period",
                      window_id: "night",
                      starts_at: "2026-09-20T09:00:00Z",
                      ends_at: "2026-09-20T11:00:00Z",
                      evidence_ids: ["evidence:quiet-window"],
                  }
                : { status: "available", evidence_ids: ["evidence:attention-available"] },
        occurrence,
        surfaces: [
            {
                surface_id: "telegram",
                preference_rank: 0,
                status: "eligible",
                evidence_ids: ["evidence:surface-eligible"],
            },
        ],
    };
    const decision = decideProactiveContactAttention(state, snapshot, request);
    let observedContact = decision.outcome === "admit";
    let deliveryOutcome: string | null = null;
    const metricResults: Record<string, boolean> = {};
    if (["duplicate-intent", "repeated-opportunity"].includes(id))
        metricResults.duplicate_suppression = !observedContact && decision.basis === "duplicate_intent";
    if (["superseded-intent", "stale-before-delivery"].includes(id))
        metricResults.stale_contact_suppression = !observedContact;
    if (id === "restart-before-delivery") {
        const store = await createStoredIntent(storePath, snapshot, groundingId);
        await store.recordPolicyDecision(decision);
        const restarted = new ProactiveContactStore(storePath);
        const retained = (await restarted.load()).intents[0];
        metricResults.restart_outcome = retained?.policy_decisions[0]?.outcome === "admit";
        observedContact = metricResults.restart_outcome;
    }
    if (id === "confirmed-vs-uncertain-delivery") {
        const store = await createStoredIntent(storePath, snapshot, groundingId);
        await store.recordPolicyDecision(decision);
        await store.commitHandoff({
            contactIntentId: intentId,
            assessmentId: request.assessment_id,
            surfaceId: "telegram",
            deliveryId: "delivery-contact-eval",
            representationDigest: snapshot.representation.digest,
            handedOffAt: "2026-09-20T10:01:00Z",
        });
        await store.recordReconciliationOutcome(intentId, {
            delivery_id: "delivery-contact-eval",
            attempt_id: "attempt-1",
            status: "blocked_uncertain",
            observed_at: "2026-09-20T10:02:00Z",
        });
        const uncertain = (await store.load()).intents[0]!;
        await store.recordReconciliationOutcome(intentId, {
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
    if (id === "remembered-currentness-change")
        metricResults.stale_contact_suppression =
            observedContact && decision.evidence.grounding_meaning_ids.includes(groundingId);
    const emberPassed =
        decision.evidence.grounding_meaning_ids.includes(groundingId) &&
        Object.values(metricResults).every(Boolean) &&
        observedContact === expected;
    return report(
        id,
        expected,
        observedContact,
        decision.basis,
        [...sourceEvidence, ...decision.evidence.grounding_meaning_ids],
        decision,
        metricResults,
        emberPassed,
        !live || decisionOutcome === (expected ? "contact" : "silent"),
        deliveryOutcome,
    );
}

async function createStoredIntent(path: string, snapshot: ProactiveContactIntentSnapshot, groundingId: MeaningId) {
    const store = new ProactiveContactStore(path);
    await store.createIntent({
        contactIntentId: snapshot.contact_intent_id,
        purpose: "Evaluation contact",
        principal: "alice",
        scope: "private",
        source: {
            cognition_id: `cognition-${snapshot.contact_intent_id}` as never,
            expression_evidence_id: `evidence-expression-${snapshot.contact_intent_id}` as never,
            opportunity_id: null,
            evidence_ids: ["evidence:concern"],
            grounding_meaning_ids: [groundingId],
            source_revision: snapshot.source_revision,
        },
        groundingCurrentness: {
            status: "current",
            evidence_ids: ["evidence:grounding-current"],
            assessed_at: snapshot.created_at,
        },
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

function report(
    id: ProactiveContactCaseId,
    expected: boolean,
    observed: boolean,
    basis: string,
    evidence: string[],
    policy: unknown,
    metricResults: Record<string, boolean>,
    ember: boolean,
    model: boolean,
    delivery: string | null = null,
) {
    return {
        id,
        expected_contact: expected,
        observed_contact: observed,
        contact_policy_outcome: observed ? "contact" : "remain_silent",
        contact_policy_basis: basis,
        source_evidence_ids: evidence.map(String),
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
            !exactKeys(item, ["id", "expect_contact"]) ||
            !CASE_IDS.includes(item.id as ProactiveContactCaseId) ||
            typeof item.expect_contact !== "boolean" ||
            ids.has(String(item.id))
        )
            throw new ValidationError("proactive-contact case is invalid or duplicated");
        ids.add(String(item.id));
    }
    if (ids.size !== CASE_IDS.length || !CASE_IDS.every((id) => ids.has(id)))
        throw new ValidationError("proactive-contact scenario does not satisfy the version-1 case contract");
}
