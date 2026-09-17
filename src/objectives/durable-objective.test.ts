import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { tempDir } from "../../tests/support.ts";
import { DurableObjectiveStore } from "./durable-objective.ts";

async function createdObjective(store: DurableObjectiveStore) {
    return store.create({
        purpose: "Publish a verified release note",
        successConditions: [
            { conditionId: "draft", description: "A draft exists" },
            { conditionId: "verified", description: "The draft reflects the current release" },
        ],
        principal: "alice",
        scope: "private",
        sourceEvidenceId: "evidence-user-request",
        occurrenceId: "occurrence-request-1",
        occurredAt: "2026-09-17T08:00:00Z",
        observedAt: "2026-09-17T08:00:01Z",
        currentnessBasis: ["repository revision and requested release remain current"],
        nextStep: { owner: "ember", description: "Inspect the current release" },
    });
}

test("an objective advances through separate episodes and a fresh provider after restart", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const firstProcess = new DurableObjectiveStore(statePath);
    const objective = await createdObjective(firstProcess);
    const first = await firstProcess.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T08:05:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "the requested release is still current",
        evidenceIds: ["evidence-repository-revision-1"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Draft the release note" },
        runtime: { kind: "cognition", runtime_id: "runtime-1", provider_label: "codex", session_id: "session-1" },
    });
    await firstProcess.checkpoint({
        objectiveId: objective.objective_id,
        episodeId: first.episode!.episode_id,
        recordedAt: "2026-09-17T08:10:00Z",
        acceptanceConditionIds: ["draft"],
        progress: "condition_satisfied",
        summary: "Drafted the release note from revision 1",
        evidenceIds: ["artifact-release-note-draft"],
        assumptions: ["revision 1 remains the release candidate"],
        uncertainty: null,
        proposedNextStep: "Verify against the final release revision",
    });
    await firstProcess.finishEpisode({
        objectiveId: objective.objective_id,
        episodeId: first.episode!.episode_id,
        status: "completed",
        endedAt: "2026-09-17T08:11:00Z",
        detail: "bounded drafting episode finished",
    });

    // When
    const restartedProcess = new DurableObjectiveStore(statePath);
    const second = await restartedProcess.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T09:00:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "the final revision still needs verification",
        evidenceIds: ["evidence-repository-revision-2"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Verify the draft against revision 2" },
        runtime: { kind: "cognition", runtime_id: "runtime-2", provider_label: "claude-code", session_id: null },
    });
    await restartedProcess.checkpoint({
        objectiveId: objective.objective_id,
        episodeId: second.episode!.episode_id,
        recordedAt: "2026-09-17T09:05:00Z",
        acceptanceConditionIds: ["verified"],
        progress: "partial",
        summary: "Verified the draft structure; final version number remains pending",
        evidenceIds: ["evidence-verification-2"],
        assumptions: ["the final version number will be supplied separately"],
        uncertainty: null,
        proposedNextStep: "Obtain the final version number",
    });
    await assert.rejects(
        restartedProcess.resume({
            objectiveId: objective.objective_id,
            expectedRevision: 1,
            assessedAt: "2026-09-17T09:06:00Z",
            actor: "agent:ember",
            decision: "complete",
            reason: "attempted completion decision",
            evidenceIds: ["evidence-verification-2"],
            priorEpisodeReconciliations: [
                {
                    episode_id: second.episode!.episode_id,
                    outcome: "still_running",
                    detail: "episode 2 remains observable and in progress",
                },
            ],
            nextStep: { owner: "unknown", description: "No further step" },
        }),
        /completion is not established for condition: verified/,
    );
    await restartedProcess.checkpoint({
        objectiveId: objective.objective_id,
        episodeId: second.episode!.episode_id,
        recordedAt: "2026-09-17T09:07:00Z",
        acceptanceConditionIds: ["verified"],
        progress: "condition_satisfied",
        summary: "Verified the draft against the final release revision",
        evidenceIds: ["evidence-final-verification"],
        assumptions: [],
        uncertainty: null,
        proposedNextStep: null,
    });
    await restartedProcess.finishEpisode({
        objectiveId: objective.objective_id,
        episodeId: second.episode!.episode_id,
        status: "completed",
        endedAt: "2026-09-17T09:08:00Z",
        detail: "bounded verification episode finished",
    });
    const completed = await restartedProcess.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T09:09:00Z",
        actor: "agent:ember",
        decision: "complete",
        reason: "all named success conditions are established by current checkpoints",
        evidenceIds: ["evidence-final-verification"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "unknown", description: "No further work remains" },
    });

    // Then
    const persisted = await restartedProcess.get(objective.objective_id);
    assert.equal(persisted?.objective_id, objective.objective_id);
    assert.equal(persisted?.episodes.length, 2);
    assert.equal(persisted?.checkpoints.length, 3);
    assert.equal(persisted?.episodes[0]?.runtime.provider_label, "codex");
    assert.equal(persisted?.episodes[1]?.runtime.provider_label, "claude-code");
    assert.equal(persisted?.lifecycle, "completed");
    assert.equal(completed.episode, null);
    await rm(directory, { recursive: true, force: true });
});

test("restart preserves an interrupted episode as uncertain rather than completed progress", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const firstProcess = new DurableObjectiveStore(statePath);
    const objective = await createdObjective(firstProcess);
    const interrupted = await firstProcess.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T08:05:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "drafting can begin",
        evidenceIds: ["evidence-repository-revision-1"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Draft the release note" },
        runtime: { kind: "specialist", runtime_id: "runtime-lost", provider_label: "codex", session_id: "thread-lost" },
    });

    // When
    const restartedProcess = new DurableObjectiveStore(statePath);
    const resumed = await restartedProcess.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T09:00:00Z",
        actor: "agent:ember",
        decision: "block",
        reason: "the prior write outcome is unknown and duplicate drafting is unsafe",
        evidenceIds: ["evidence-runtime-gap"],
        priorEpisodeReconciliations: [
            {
                episode_id: interrupted.episode!.episode_id,
                outcome: "outcome_unknown",
                detail: "the prior process disappeared without a terminal report or checkpoint",
            },
        ],
        nextStep: { owner: "ember", description: "Inspect the draft target before retrying" },
    });

    // Then
    assert.equal(resumed.episode, null);
    assert.equal(resumed.objective.lifecycle, "blocked");
    assert.equal(resumed.objective.episodes[0]?.episode_id, interrupted.episode?.episode_id);
    assert.equal(resumed.objective.episodes[0]?.status, "outcome_unknown");
    assert.match(resumed.objective.episodes[0]?.outcome_detail ?? "", /disappeared/);
    assert.equal(resumed.objective.checkpoints.length, 0);
    await rm(directory, { recursive: true, force: true });
});

test("concurrent episodes retain interleaved evidence and truthful state through abandonment", async () => {
    // Given
    const directory = await tempDir();
    const store = new DurableObjectiveStore(join(directory, "ember.json"));
    const objective = await createdObjective(store);
    const first = await store.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T08:05:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "drafting can begin",
        evidenceIds: ["evidence-current-1"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Draft the release note" },
        runtime: { kind: "specialist", runtime_id: "runtime-1", provider_label: "codex", session_id: null },
    });

    // When
    const second = await store.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T08:06:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "independent verification can run concurrently",
        evidenceIds: ["evidence-current-2"],
        priorEpisodeReconciliations: [
            {
                episode_id: first.episode!.episode_id,
                outcome: "still_running",
                detail: "the first runtime remains observable and responsive",
            },
        ],
        nextStep: { owner: "ember", description: "Verify the release inputs" },
        runtime: { kind: "cognition", runtime_id: "runtime-2", provider_label: "claude-code", session_id: null },
    });
    await Promise.all([
        store.checkpoint({
            objectiveId: objective.objective_id,
            episodeId: first.episode!.episode_id,
            recordedAt: "2026-09-17T08:08:00Z",
            acceptanceConditionIds: ["draft"],
            progress: "partial",
            summary: "The concurrent drafting episode produced an outline",
            evidenceIds: ["evidence-outline"],
            assumptions: [],
            uncertainty: null,
            proposedNextStep: "Finish the draft",
        }),
        store.checkpoint({
            objectiveId: objective.objective_id,
            episodeId: second.episode!.episode_id,
            recordedAt: "2026-09-17T08:15:00Z",
            acceptanceConditionIds: ["verified"],
            progress: "partial",
            summary: "The concurrent verification episode checked the inputs",
            evidenceIds: ["evidence-input-check"],
            assumptions: [],
            uncertainty: null,
            proposedNextStep: "Verify the completed draft",
        }),
    ]);
    await store.finishEpisode({
        objectiveId: objective.objective_id,
        episodeId: first.episode!.episode_id,
        status: "completed",
        endedAt: "2026-09-17T08:10:00Z",
        detail: "the earlier terminal report arrived after episode 2's later checkpoint",
    });
    const abandoned = await store.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T08:16:00Z",
        actor: "user:alice",
        decision: "abandon",
        reason: "the principal cancelled future pursuit",
        evidenceIds: ["evidence-user-cancellation"],
        priorEpisodeReconciliations: [
            {
                episode_id: second.episode!.episode_id,
                outcome: "still_running",
                detail: "the remote verification episode remains observable after cancellation",
            },
        ],
        nextStep: { owner: "unknown", description: "Reconcile the observable remote episode only" },
    });

    // Then
    const persisted = await store.get(objective.objective_id);
    assert.equal(persisted?.episodes[0]?.status, "completed");
    assert.equal(persisted?.episodes[0]?.ended_at, "2026-09-17T08:10:00Z");
    assert.equal(persisted?.episodes[1]?.status, "running");
    assert.equal(persisted?.checkpoints.length, 2);
    assert.equal(persisted?.updated_at, "2026-09-17T08:16:00Z");
    assert.equal(abandoned.objective.lifecycle, "abandoned");
    assert.deepEqual(
        new Set(persisted?.checkpoints.map((checkpoint) => checkpoint.episode_id)),
        new Set([first.episode!.episode_id, second.episode!.episode_id]),
    );
    await assert.rejects(
        store.resume({
            objectiveId: objective.objective_id,
            expectedRevision: 1,
            assessedAt: "2026-09-17T08:17:00Z",
            actor: "agent:ember",
            decision: "continue",
            reason: "invalid attempt to restart abandoned work",
            evidenceIds: ["evidence-late"],
            priorEpisodeReconciliations: [
                {
                    episode_id: second.episode!.episode_id,
                    outcome: "still_running",
                    detail: "the remote verification episode remains observable",
                },
            ],
            nextStep: { owner: "ember", description: "Start forbidden work" },
            runtime: { kind: "cognition", runtime_id: "runtime-3", provider_label: "codex", session_id: null },
        }),
        /terminal objective cannot resume/,
    );
    await rm(directory, { recursive: true, force: true });
});

test("objective history rejects backwards reconciliation and episode completion", async () => {
    // Given
    const directory = await tempDir();
    const store = new DurableObjectiveStore(join(directory, "ember.json"));
    const objective = await createdObjective(store);
    const episode = await store.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T10:00:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "work can begin",
        evidenceIds: ["evidence-current"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Draft the release note" },
        runtime: { kind: "cognition", runtime_id: "runtime-1", provider_label: "codex", session_id: null },
    });
    await store.checkpoint({
        objectiveId: objective.objective_id,
        episodeId: episode.episode!.episode_id,
        recordedAt: "2026-09-17T12:00:00Z",
        acceptanceConditionIds: ["draft"],
        progress: "partial",
        summary: "Drafting remains in progress",
        evidenceIds: ["evidence-draft"],
        assumptions: [],
        uncertainty: null,
        proposedNextStep: "Continue drafting",
    });

    // When / Then
    await assert.rejects(
        store.resume({
            objectiveId: objective.objective_id,
            expectedRevision: 1,
            assessedAt: "2026-09-17T09:00:00Z",
            actor: "agent:ember",
            decision: "block",
            reason: "invalid backwards reconciliation",
            evidenceIds: ["evidence-gap"],
            priorEpisodeReconciliations: [
                {
                    episode_id: episode.episode!.episode_id,
                    outcome: "outcome_unknown",
                    detail: "the runtime cannot be observed",
                },
            ],
            nextStep: { owner: "ember", description: "Reconcile" },
        }),
        /cannot predate the objective's latest durable event/,
    );
    await assert.rejects(
        store.finishEpisode({
            objectiveId: objective.objective_id,
            episodeId: episode.episode!.episode_id,
            status: "completed",
            endedAt: "2026-09-17T11:00:00Z",
            detail: "invalid completion before the checkpoint",
        }),
        /cannot predate its latest checkpoint/,
    );
    const persisted = await store.get(objective.objective_id);
    assert.equal(persisted?.episodes[0]?.status, "running");
    assert.equal(persisted?.updated_at, "2026-09-17T12:00:00Z");
    await rm(directory, { recursive: true, force: true });
});

test("resume can defer or abandon when fresh currentness invalidates the old plan", async () => {
    // Given
    const directory = await tempDir();
    const store = new DurableObjectiveStore(join(directory, "ember.json"));
    const deferredObjective = await createdObjective(store);

    // When
    const deferred = await store.resume({
        objectiveId: deferredObjective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T10:00:00Z",
        actor: "agent:ember",
        decision: "defer",
        reason: "the release candidate changed and needs a stable revision",
        evidenceIds: ["evidence-release-moving"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "external", description: "Wait for a stable release revision" },
    });
    const abandoned = await store.resume({
        objectiveId: deferredObjective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-17T11:00:00Z",
        actor: "user:alice",
        decision: "abandon",
        reason: "the principal cancelled the release",
        evidenceIds: ["evidence-user-cancellation"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "unknown", description: "No further pursuit is authorized" },
    });

    // Then
    assert.equal(deferred.objective.lifecycle, "deferred");
    assert.equal(abandoned.objective.lifecycle, "abandoned");
    assert.equal(abandoned.episode, null);
    await assert.rejects(
        store.resume({
            objectiveId: deferredObjective.objective_id,
            expectedRevision: 1,
            assessedAt: "2026-09-17T12:00:00Z",
            actor: "agent:ember",
            decision: "continue",
            reason: "try to reopen",
            evidenceIds: ["evidence-new"],
            priorEpisodeReconciliations: [],
            nextStep: { owner: "ember", description: "Resume" },
            runtime: { kind: "cognition", runtime_id: null, provider_label: null, session_id: null },
        }),
        /terminal objective cannot resume/,
    );
    await rm(directory, { recursive: true, force: true });
});
