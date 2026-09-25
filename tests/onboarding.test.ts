import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { RunCognitionOptions } from "../src/app/cognition-execution.ts";
import type { MemoryProposalGenerator } from "../src/memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../src/onboarding/progress-evaluator.ts";

import { executeCognition as runCoreCognition } from "../src/app/cognition-execution.ts";
import { prepareCognition } from "../src/app/cognition-preparation.ts";
import { runPostTurnFollowUps } from "../src/app/post-turn.ts";
import { createFileBackedRepositoriesForState } from "../src/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import {
    applyOnboardingProgressDecision,
    createOnboardingWork,
    validateOnboardingProgressDecision,
    validateOnboardingWork,
} from "../src/core/onboarding-work.ts";
import { startRuntime, stopRuntime } from "../src/core/runtime-episode.ts";
import { createProviderMemoryProposalGenerator } from "../src/memory/provider-memory-proposal-generator.ts";
import { createProviderOnboardingProgressEvaluator } from "../src/onboarding/progress-evaluator.ts";
import { OnboardingWorkStore } from "../src/persistence/onboarding-work-store.ts";
import { StateStore } from "../src/persistence/state-store.ts";

async function executeCognition(
    repositories: ReturnType<typeof createFileBackedRepositoriesForState>,
    state: Parameters<typeof runCoreCognition>[1],
    options: RunCognitionOptions & {
        memoryProposalGenerator?: MemoryProposalGenerator;
        memoryProposalProviderLabel?: string;
        onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    },
) {
    const { memoryProposalGenerator, memoryProposalProviderLabel, onboardingProgressEvaluator, ...cognition } = options;
    const preparation = await prepareCognition(repositories, state, {
        runtimeId: cognition.runtimeId,
        principal: cognition.principal,
        scope: cognition.scope,
        surface: cognition.surface ?? "local_cli",
        text: cognition.text,
        ...(cognition.purpose === undefined ? {} : { purpose: cognition.purpose }),
        ...(cognition.explainIds === undefined ? {} : { explainIds: cognition.explainIds }),
        ...(cognition.conversationMembership === undefined
            ? {}
            : { conversationMembership: cognition.conversationMembership }),
    });
    const result = await runCoreCognition(repositories, state, { ...cognition, preparation });
    const diagnostics = await runPostTurnFollowUps(
        repositories,
        { memoryProposalGenerator, memoryProposalProviderLabel, onboardingProgressEvaluator },
        result.state,
        preparation,
        {
            cognitionId: result.cognitionId,
            principal: cognition.principal,
            scope: cognition.scope,
            text: cognition.text,
        },
    );
    return { ...result, ...diagnostics, state: await repositories.state.load() };
}

test("onboarding progress distinguishes defer, resume, decline, and closure", () => {
    let work = createOnboardingWork("lineage-test", "user", "relationship:user", "2026-01-01T00:00:00.000Z");
    const unchanged = applyOnboardingProgressDecision(
        work,
        { decision_version: 1, updates: [] },
        "evidence-work",
        "2026-01-01T00:00:30.000Z",
    );
    assert.ok(unchanged.topics.every((topic) => topic.status === "open"));
    work = applyOnboardingProgressDecision(
        work,
        {
            decision_version: 1,
            updates: [
                { topic: "forms_of_address", action: "defer", basis: "later" },
                { topic: "agent_personality", action: "defer", basis: "later" },
                { topic: "expectations", action: "defer", basis: "later" },
                { topic: "optional_capabilities", action: "defer", basis: "later" },
            ],
        },
        "evidence-1",
        "2026-01-01T00:01:00.000Z",
    );
    assert.deepEqual(new Set(work.topics.map((topic) => topic.status)), new Set(["deferred"]));
    work = applyOnboardingProgressDecision(
        work,
        {
            decision_version: 1,
            updates: work.topics.map(({ topic }) => ({ topic, action: "resume" as const, basis: "Resume" })),
        },
        "evidence-2",
        "2026-01-01T00:02:00.000Z",
    );
    assert.deepEqual(new Set(work.topics.map((topic) => topic.status)), new Set(["open"]));
    work = applyOnboardingProgressDecision(
        work,
        {
            decision_version: 1,
            updates: work.topics.map(({ topic }) => ({ topic, action: "decline" as const, basis: "Skip onboarding" })),
        },
        "evidence-3",
        "2026-01-01T00:03:00.000Z",
    );
    assert.equal(work.status, "closed");
    assert.ok(work.topics.every((topic) => topic.status === "declined"));
    validateOnboardingWork(work);
    assert.throws(
        () =>
            validateOnboardingProgressDecision({
                decision_version: 1,
                updates: [
                    { topic: "expectations", action: "resolve", basis: "expectations" },
                    { topic: "expectations", action: "decline", basis: "expectations" },
                ],
            }),
        /update is invalid/,
    );
});

test("ordinary cognition receives and advances restart-persistent onboarding work", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-onboarding-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "continuity.json");
    const state = initialState("user");
    await new StateStore(statePath).create(state);
    await new OnboardingWorkStore(statePath).save(
        createOnboardingWork(state.lineage.lineageId, "user", "test", "2026-01-01T00:00:00.000Z"),
    );
    const projections: Array<unknown> = [];
    const provider = async (request) => {
        projections.push(request.projection.onboarding_work);
        return { contractVersion: 1, reply: "Understood.", usedMeaningIds: [] } as const;
    };
    const store = new StateStore(statePath);
    const lease = await store.acquireWriteLease();
    const started = startRuntime(await store.load(), "user", "test");
    let current = await store.commit(0, started.state);
    const result = await executeCognition(createFileBackedRepositoriesForState(store), current, {
        runtimeId: started.runtimeId,
        principal: "user",
        scope: "test",
        text: "Let's defer onboarding until later",
        providerLabel: "scripted",
        executor: provider,
        timeoutSeconds: 1,
        output: () => {},
        onboardingProgressEvaluator: async () => ({
            decision_version: 1,
            updates: [
                { topic: "forms_of_address", action: "defer", basis: "later" },
                { topic: "agent_personality", action: "defer", basis: "later" },
                { topic: "expectations", action: "defer", basis: "later" },
                { topic: "optional_capabilities", action: "defer", basis: "later" },
            ],
        }),
    });
    current = result.state;
    const persisted = JSON.parse(await readFile(`${statePath}.onboarding.json`, "utf8"));
    validateOnboardingWork(persisted);
    assert.ok(persisted.topics.every((topic) => topic.status === "deferred"));
    assert.equal(projections.length, 1);
    assert.equal((projections[0] as { status: string }).status, "active");
    assert.ok(current.revision > 1);
    current = await store.commit(current.revision, stopRuntime(current, started.runtimeId, { reason: "test_restart" }));
    await store.releaseWriteLease(lease);

    const restartedStore = new StateStore(statePath);
    const restartedLease = await restartedStore.acquireWriteLease();
    const restarted = startRuntime(await restartedStore.load(), "user", "test");
    const restartedState = await restartedStore.commit(current.revision, restarted.state);
    let restartedWork: unknown;
    await executeCognition(createFileBackedRepositoriesForState(restartedStore), restartedState, {
        runtimeId: restarted.runtimeId,
        principal: "user",
        scope: "test",
        text: "Please summarize this document",
        providerLabel: "replacement-provider",
        executor: async (request) => {
            restartedWork = request.projection.onboarding_work;
            return { contractVersion: 1, reply: "Summary.", usedMeaningIds: [] };
        },
        timeoutSeconds: 1,
        output: () => {},
    });
    assert.ok(
        (restartedWork as { topics: Array<{ status: string }> }).topics.every((topic) => topic.status === "deferred"),
    );
    await restartedStore.releaseWriteLease(restartedLease);
});

test("onboarding is isolated to ordinary cognition in its bound scope", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-onboarding-isolation-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "continuity.json");
    const initial = initialState("user");
    await new StateStore(statePath).create(initial);
    await new OnboardingWorkStore(statePath).save(
        createOnboardingWork(initial.lineage.lineageId, "user", "relationship:user", "2026-01-01T00:00:00.000Z"),
    );
    const store = new StateStore(statePath);
    const lease = await store.acquireWriteLease();
    let state = await store.load();
    const projectRuntime = startRuntime(state, "user", "project:ember");
    state = await store.commit(state.revision, projectRuntime.state);
    const projectResult = await executeCognition(createFileBackedRepositoriesForState(store), state, {
        runtimeId: projectRuntime.runtimeId,
        principal: "user",
        scope: "project:ember",
        text: "Call me Sam",
        providerLabel: "scripted",
        executor: async (request) => {
            assert.equal("onboarding_work" in request.projection, false);
            return { contractVersion: 1, reply: "Hello.", usedMeaningIds: [] };
        },
        timeoutSeconds: 1,
        output: () => {},
        onboardingProgressEvaluator: async () => assert.fail("out-of-scope onboarding must not be evaluated"),
    });
    state = projectResult.state;
    state = await store.commit(
        state.revision,
        stopRuntime(state, projectRuntime.runtimeId, { reason: "scope_isolation_test" }),
    );
    const relationshipRuntime = startRuntime(state, "user", "relationship:user");
    state = await store.commit(state.revision, relationshipRuntime.state);
    await executeCognition(createFileBackedRepositoriesForState(store), state, {
        runtimeId: relationshipRuntime.runtimeId,
        principal: "user",
        scope: "relationship:user",
        text: "Explain the current evidence",
        purpose: "explain",
        explainIds: [],
        providerLabel: "scripted",
        executor: async (request) => {
            assert.equal("onboarding_work" in request.projection, false);
            return { contractVersion: 1, reply: "Explanation.", usedMeaningIds: [] };
        },
        timeoutSeconds: 1,
        output: () => {},
    });
    assert.equal((await new OnboardingWorkStore(statePath).load())?.status, "active");
    await store.releaseWriteLease(lease);
});

test("completion closes temporary work while adopted meaning remains available", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-onboarding-completion-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "continuity.json");
    const initial = initialState("user", "2026-01-01T00:00:00.000Z");
    await new StateStore(statePath).create(initial);
    await new OnboardingWorkStore(statePath).save(
        createOnboardingWork(initial.lineage.lineageId, "user", "test", "2026-01-01T00:00:00.000Z"),
    );
    const store = new StateStore(statePath);
    const lease = await store.acquireWriteLease();
    const started = startRuntime(await store.load(), "user", "test");
    let state = await store.commit(0, started.state);
    let secondProjection: unknown;
    const first = await executeCognition(createFileBackedRepositoriesForState(store), state, {
        runtimeId: started.runtimeId,
        principal: "user",
        scope: "test",
        text: "Call me Sam; concise replies, and no integrations.",
        providerLabel: "scripted",
        executor: async () => ({ contractVersion: 1, reply: "Understood.", usedMeaningIds: [] }),
        timeoutSeconds: 1,
        output: () => {},
        onboardingProgressEvaluator: async () => ({
            decision_version: 1,
            updates: [
                { topic: "forms_of_address", action: "resolve", basis: "Call me Sam" },
                { topic: "agent_personality", action: "decline", basis: "no personality preference" },
                { topic: "expectations", action: "resolve", basis: "concise replies" },
                { topic: "optional_capabilities", action: "decline", basis: "no integrations" },
            ],
        }),
        memoryProposalGenerator: async (request) => ({
            contractVersion: 1,
            candidates: [
                {
                    proposal_version: 1,
                    proposal_id: "memory-proposal-display-name",
                    proposed_at: request.proposedAt,
                    kind: "fact",
                    owner: "user:user",
                    slot: "display-name",
                    scope: "test",
                    content: "The user prefers to be called Sam",
                    source_evidence_ids: [request.projection.selection.source_evidence_ids[0]!],
                    epistemic_role: "user_testimony",
                    applicable_from: request.proposedAt,
                    applicable_until: null,
                    proposed_currentness: "current",
                    confidence: { source: "high", proposition: "high", interpretation: "high" },
                    uncertainty: null,
                    supersedes_meaning_id: null,
                },
            ],
        }),
    });
    assert.equal((await new OnboardingWorkStore(statePath).load())?.status, "closed");
    assert.equal(first.state.meanings[0]?.content, "The user prefers to be called Sam");
    state = first.state;
    await executeCognition(createFileBackedRepositoriesForState(store), state, {
        runtimeId: started.runtimeId,
        principal: "user",
        scope: "test",
        text: "What should you call me?",
        providerLabel: "scripted",
        executor: async (request) => {
            secondProjection = request.projection;
            return { contractVersion: 1, reply: "Sam.", usedMeaningIds: request.projection.selection.meaning_ids };
        },
        timeoutSeconds: 1,
        output: () => {},
    });
    assert.equal("onboarding_work" in (secondProjection as object), false);
    assert.equal(
        (secondProjection as { meanings: Array<{ content: string }> }).meanings[0]?.content,
        "The user prefers to be called Sam",
    );
    await store.releaseWriteLease(lease);
});

test("configured-provider reflection keeps conversation evidence inside the ordinary proposal boundary", async () => {
    let supplied: unknown;
    const generator = createProviderMemoryProposalGenerator(async (request) => {
        supplied = JSON.parse(request.input.text.slice(request.input.text.lastIndexOf('{"generation_id"')));
        return { contractVersion: 1, reply: '{"contractVersion":1,"candidates":[]}', usedMeaningIds: [] };
    }, 2);
    const result = await generator({
        generationId: "memory-generation-test",
        proposedAt: "2026-01-01T00:00:00.000Z",
        projection: {
            projection_version: 1,
            principal: "user",
            scope: "test",
            agent_actor: "agent:lineage-test",
            conversation_id: "conversation-test",
            turns: [],
            current_meanings: [],
            selection: { source_evidence_ids: [], current_meaning_ids: [], excluded_turn_count: 0 },
        },
    });
    assert.deepEqual(result, { contractVersion: 1, candidates: [] });
    assert.equal(
        (supplied as { memory_proposal_projection: { principal: string } }).memory_proposal_projection.principal,
        "user",
    );
});

test("provider progress evaluation returns a validated typed decision for natural wording", async () => {
    const work = createOnboardingWork("lineage-test", "user", "relationship:user", "2026-01-01T00:00:00.000Z");
    let supplied = "";
    const evaluator = createProviderOnboardingProgressEvaluator(async (request) => {
        supplied = request.input.text;
        return {
            contractVersion: 1,
            reply: JSON.stringify({
                decision_version: 1,
                updates: work.topics.map(({ topic }) => ({
                    topic,
                    action: "decline",
                    basis: "leave all of the introductory questions aside",
                })),
            }),
            usedMeaningIds: [],
        };
    }, 2);
    const decision = await evaluator({
        projection: {
            projection_version: 1,
            purpose: "ordinary",
            validatedRevision: 0,
            lineage: initialState("user").lineage,
            principal: "user",
            activeScope: "test",
            surface: "local_cli",
            current_time: "2026-01-01T00:00:00.000Z",
            current_input: "I'd rather leave all of the introductory questions aside.",
            recoveryAccount: {
                gapKind: "initial_start",
                previousRuntimeId: null,
                gapStartedAt: null,
                recoveredAt: null,
            },
            meanings: [],
            gaps: [],
            selection: { meaning_ids: [], evidence_ids: [], explicit_explain_ids: [], raw_transcript_included: false },
        },
        onboardingWork: {
            work_version: 1,
            status: "active",
            guidance: "optional",
            topics: work.topics.map(({ topic, status }) => ({ topic, status })),
        },
        input: "I'd rather leave all of the introductory questions aside.",
    });
    assert.equal(decision.updates.length, 4);
    assert.match(supplied, /introductory questions/);
    await assert.rejects(
        createProviderOnboardingProgressEvaluator(
            async () => ({ contractVersion: 1, reply: "not-json", usedMeaningIds: [] }),
            2,
        )({
            projection: {} as never,
            onboardingWork: { work_version: 1, status: "active", guidance: "optional", topics: [] },
            input: "hello",
        }),
        /invalid JSON/,
    );
    await assert.rejects(
        createProviderOnboardingProgressEvaluator(
            async () => ({
                contractVersion: 1,
                reply: JSON.stringify({
                    decision_version: 1,
                    updates: [{ topic: "expectations", action: "resolve", basis: "words never supplied" }],
                }),
                usedMeaningIds: [],
            }),
            2,
        )({
            projection: {} as never,
            onboardingWork: { work_version: 1, status: "active", guidance: "optional", topics: [] },
            input: "hello",
        }),
        /update is invalid/,
    );
});

test("loading a legacy onboarding document backfills a topic introduced after it was persisted", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-onboarding-migration-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "continuity.json");
    const legacyActive = {
        onboarding_work_version: 1,
        lineage_id: "lineage-legacy",
        principal: "user",
        scope: "relationship:user",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        topics: [
            {
                topic: "forms_of_address",
                status: "resolved",
                updated_at: "2026-01-01T00:00:00.000Z",
                source_evidence_ids: ["evidence-1"],
            },
            { topic: "expectations", status: "open", updated_at: "2026-01-01T00:00:00.000Z", source_evidence_ids: [] },
            {
                topic: "optional_capabilities",
                status: "open",
                updated_at: "2026-01-01T00:00:00.000Z",
                source_evidence_ids: [],
            },
        ],
    };
    await writeFile(`${statePath}.onboarding.json`, JSON.stringify(legacyActive));
    const store = new OnboardingWorkStore(statePath);
    const loaded = await store.load();
    validateOnboardingWork(loaded);
    assert.equal(loaded!.topics.length, 4);
    const backfilled = loaded!.topics.find((topic) => topic.topic === "agent_personality");
    assert.equal(backfilled?.status, "open");
    assert.deepEqual(backfilled?.source_evidence_ids, []);
    assert.equal(
        loaded!.topics.find((topic) => topic.topic === "forms_of_address")?.status,
        "resolved",
    );

    const legacyClosed = {
        ...legacyActive,
        status: "closed",
        topics: legacyActive.topics.map((topic) => ({ ...topic, status: "declined" })),
    };
    await writeFile(`${statePath}.onboarding.json`, JSON.stringify(legacyClosed));
    const loadedClosed = await new OnboardingWorkStore(statePath).load();
    validateOnboardingWork(loadedClosed);
    assert.equal(loadedClosed!.topics.find((topic) => topic.topic === "agent_personality")?.status, "declined");
});
