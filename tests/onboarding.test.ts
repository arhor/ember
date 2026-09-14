import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { initialState } from "../src/core/model.ts";
import { advanceOnboardingWork, createOnboardingWork, validateOnboardingWork } from "../src/core/onboarding-work.ts";
import { createProviderMemoryProposalGenerator } from "../src/memory/provider-memory-proposal-generator.ts";
import { OnboardingWorkStore } from "../src/persistence/onboarding-work-store.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";

test("onboarding progress distinguishes defer, resume, decline, and closure", () => {
    let work = createOnboardingWork("lineage-test", "user", "relationship:user", "2026-01-01T00:00:00.000Z");
    const unchanged = advanceOnboardingWork(
        work,
        "Please summarize this document",
        "evidence-work",
        "2026-01-01T00:00:30.000Z",
    );
    assert.ok(unchanged.topics.every((topic) => topic.status === "open"));
    work = advanceOnboardingWork(work, "Let's defer onboarding until later", "evidence-1", "2026-01-01T00:01:00.000Z");
    assert.deepEqual(new Set(work.topics.map((topic) => topic.status)), new Set(["deferred"]));
    work = advanceOnboardingWork(work, "Resume onboarding", "evidence-2", "2026-01-01T00:02:00.000Z");
    assert.deepEqual(new Set(work.topics.map((topic) => topic.status)), new Set(["open"]));
    work = advanceOnboardingWork(work, "Skip onboarding", "evidence-3", "2026-01-01T00:03:00.000Z");
    assert.equal(work.status, "closed");
    assert.ok(work.topics.every((topic) => topic.status === "declined"));
    validateOnboardingWork(work);
});

test("ordinary cognition receives and advances restart-persistent onboarding work", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-onboarding-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "continuity.json");
    const state = initialState("user");
    await new StateStore(statePath).create(state);
    await new OnboardingWorkStore(statePath).save(
        createOnboardingWork(state.lineage.lineageId, "user", "relationship:user", "2026-01-01T00:00:00.000Z"),
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
    const result = await runCognition(store, current, {
        runtimeId: started.runtimeId,
        principal: "user",
        scope: "test",
        text: "Let's defer onboarding until later",
        providerLabel: "scripted",
        provider,
        timeoutSeconds: 1,
        output: () => {},
    });
    current = result.state;
    const persisted = JSON.parse(await readFile(`${statePath}.onboarding.json`, "utf8"));
    validateOnboardingWork(persisted);
    assert.ok(persisted.topics.every((topic) => topic.status === "deferred"));
    assert.equal(projections.length, 1);
    assert.equal((projections[0] as { status: string }).status, "active");
    assert.ok(current.revision > 1);
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
