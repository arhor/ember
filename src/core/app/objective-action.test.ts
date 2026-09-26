import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { CapabilityJsonValue } from "../capabilities/execution.ts";

import { tempDir } from "../../../tests/support.ts";
import { DurableObjectiveStore } from "../../objectives/durable-objective.ts";
import { actionProposalConfirmation, ActionProposalStore } from "../capabilities/action-proposal.ts";
import { createCapabilityExecutionFirewall } from "../capabilities/execution.ts";
import {
    calendarTargetFingerprint,
    createApprovedGoogleCalendarEventCapability,
} from "../integrations/google-calendar/create.ts";
import { ObjectiveActionCoordinator } from "./objective-action.ts";

const config = {
    config_version: 1 as const,
    enabled: true,
    setup_lineage_id: "lineage-objective",
    principal: "alice",
    scope: "private",
    surfaces: ["local_cli" as const],
    authority_source_id: "authority:gcal:test",
    calendar_id: "alice@example.test",
    calendar_label: "Personal",
    timezone: "Europe/Warsaw",
    client_id: "client",
    client_secret_file: "/secret/client",
    refresh_token_file: "/secret/refresh",
};
const event = {
    title: "Dentist",
    start: "2026-09-18T08:00:00Z",
    end: "2026-09-18T09:00:00Z",
    timezone: "Europe/Warsaw",
};
const context = {
    cognitionId: "cognition-objective-effect" as never,
    principal: "alice",
    scope: "private",
    surface: "local_cli",
    validatedRevision: 1,
};

test("an approved objective action executes and reintegrates after restart without duplicate effect", async (t) => {
    const directory = await tempDir();
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "ember.json");
    const objectives = new DurableObjectiveStore(statePath);
    const actions = new ActionProposalStore(statePath);
    const coordinator = new ObjectiveActionCoordinator(objectives, actions);
    const objective = await objectives.create({
        purpose: "Put the appointment on the calendar",
        successConditions: [{ conditionId: "calendar-event", description: "The exact event exists" }],
        principal: "alice",
        scope: "private",
        sourceEvidenceId: "evidence-request",
        occurrenceId: "occurrence-request",
        occurredAt: "2026-09-16T10:00:00Z",
        observedAt: "2026-09-16T10:00:01Z",
        currentnessBasis: ["the appointment and configured calendar remain current"],
        nextStep: { owner: "ember", description: "Prepare the exact calendar action" },
    });
    const episode1 = await objectives.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-16T10:01:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "the appointment remains current",
        evidenceIds: ["evidence-current-1"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Create an approval proposal" },
        runtime: { kind: "cognition", runtime_id: "runtime-1", provider_label: "codex", session_id: null },
    });
    const proposal = await coordinator.createProposal({
        objectiveId: objective.objective_id,
        objectiveRevision: 1,
        episodeId: episode1.episode!.episode_id,
        stepId: "create-calendar-event",
        acceptanceConditionIds: ["calendar-event"],
        capability: "googleCalendarCreateEvent",
        principal: "alice",
        scope: "private",
        purpose: objective.purpose,
        consequence: "Creates one private event without attendee notifications",
        payload: event as CapabilityJsonValue,
        target: { label: config.calendar_label, fingerprint: calendarTargetFingerprint(config) },
        sourceIds: ["evidence-request"],
        createdAt: "2026-09-16T10:02:00Z",
        expiresAt: "2026-09-16T11:00:00Z",
    });
    await objectives.finishEpisode({
        objectiveId: objective.objective_id,
        episodeId: episode1.episode!.episode_id,
        status: "completed",
        endedAt: "2026-09-16T10:03:00Z",
        detail: "the proposal was persisted; no effect was attempted",
    });
    await objectives.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-16T10:03:01Z",
        actor: "agent:ember",
        decision: "block",
        reason: "the exact action awaits the principal's decision",
        evidenceIds: [proposal.proposal_id],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "principal", description: `Decide ${proposal.proposal_id}` },
    });
    const presented = await actions.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "telegram",
        presentedAt: "2026-09-16T10:04:00Z",
    });
    await actions.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        scope: "private",
        surface: "telegram",
        presentationId: presented.presentations.at(-1)!.presentation_id,
        decidedAt: "2026-09-16T10:05:00Z",
        authoritySourceId: "telegram:alice:decision",
        materialConfirmation: actionProposalConfirmation(proposal),
    });

    const restartedObjectives = new DurableObjectiveStore(statePath);
    const restartedActions = new ActionProposalStore(statePath);
    const restartedCoordinator = new ObjectiveActionCoordinator(restartedObjectives, restartedActions);
    const episode2 = await restartedObjectives.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-16T10:06:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "the objective, exact proposal, approval, and calendar target remain current",
        evidenceIds: [proposal.proposal_id, "evidence-calendar-current"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Execute the exact approved effect" },
        runtime: { kind: "capability", runtime_id: "runtime-2", provider_label: "fresh-provider", session_id: null },
    });
    let submissions = 0;
    const effect = createApprovedGoogleCalendarEventCapability(config, restartedActions, {
        now: () => new Date("2026-09-16T10:07:00Z"),
        readSecret: async () => "secret",
        revalidateObjective: (proposalId) => restartedCoordinator.revalidate(proposalId),
        fetch: async (input, init) => {
            const url = String(input);
            if (url.includes("/calendar/v3/") && init?.method === "POST") {
                submissions += 1;
                return json({
                    summary: event.title,
                    start: { dateTime: event.start, timeZone: event.timezone },
                    end: { dateTime: event.end, timeZone: event.timezone },
                });
            }
            if (!url.includes("/calendar/v3/")) return json({ access_token: "token" });
            return json({}, { status: 404 });
        },
    });
    const result = await createCapabilityExecutionFirewall([effect], context).execute(effect.name, {
        proposalId: proposal.proposal_id,
        event,
    });
    assert.equal(result.outcome, "succeeded");
    assert.equal(submissions, 1);
    await restartedCoordinator.reintegrate({
        objectiveId: objective.objective_id,
        episodeId: episode2.episode!.episode_id,
        proposalId: proposal.proposal_id,
        recordedAt: "2026-09-16T10:08:00Z",
        confirmedProgress: "condition_satisfied",
        summary: "The approved calendar effect was confirmed by the action ledger",
        proposedNextStep: null,
    });

    const replay = await createCapabilityExecutionFirewall([effect], {
        ...context,
        cognitionId: "cognition-replay" as never,
    }).execute(effect.name, { proposalId: proposal.proposal_id, event });
    assert.equal(replay.outcome, "authority_denied");
    assert.equal(submissions, 1);
    assert.equal(
        (await restartedObjectives.get(objective.objective_id))?.checkpoints[0]?.progress,
        "condition_satisfied",
    );
});

test("an uncertain objective effect remains uncertain progress", async (t) => {
    const directory = await tempDir();
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "ember.json");
    const objectives = new DurableObjectiveStore(statePath);
    const actions = new ActionProposalStore(statePath);
    const coordinator = new ObjectiveActionCoordinator(objectives, actions);
    const objective = await objectives.create({
        purpose: "Perform one consequential step",
        successConditions: [{ conditionId: "effect", description: "The effect is confirmed" }],
        principal: "alice",
        scope: "private",
        sourceEvidenceId: "request",
        occurrenceId: "occurrence",
        occurredAt: "2026-09-16T10:00:00Z",
        observedAt: "2026-09-16T10:00:01Z",
        currentnessBasis: ["the requested effect remains current"],
        nextStep: { owner: "ember", description: "Prepare the effect" },
    });
    const episode = await objectives.resume({
        objectiveId: objective.objective_id,
        expectedRevision: 1,
        assessedAt: "2026-09-16T10:01:00Z",
        actor: "agent:ember",
        decision: "continue",
        reason: "the request remains current",
        evidenceIds: ["current"],
        priorEpisodeReconciliations: [],
        nextStep: { owner: "ember", description: "Attempt the effect" },
        runtime: { kind: "capability", runtime_id: null, provider_label: null, session_id: null },
    });
    const proposal = await coordinator.createProposal({
        objectiveId: objective.objective_id,
        objectiveRevision: 1,
        episodeId: episode.episode!.episode_id,
        stepId: "effect-step",
        acceptanceConditionIds: ["effect"],
        capability: "testEffect",
        principal: "alice",
        scope: "private",
        purpose: objective.purpose,
        consequence: "A consequential test effect",
        payload: { value: 1 },
        target: { label: "Test", fingerprint: `sha256:${"a".repeat(64)}` },
        sourceIds: ["request"],
        createdAt: "2026-09-16T10:02:00Z",
        expiresAt: "2026-09-16T11:00:00Z",
    });
    const shown = await actions.present({
        proposalId: proposal.proposal_id,
        principal: "alice",
        scope: "private",
        surface: "local_cli",
        presentedAt: "2026-09-16T10:03:00Z",
    });
    await actions.decide({
        proposalId: proposal.proposal_id,
        decision: "approved",
        principal: "alice",
        payloadDigest: proposal.payload_digest,
        scope: "private",
        surface: "local_cli",
        presentationId: shown.presentations[0]!.presentation_id,
        decidedAt: "2026-09-16T10:04:00Z",
        authoritySourceId: "cli:alice",
        materialConfirmation: actionProposalConfirmation(proposal),
    });
    await actions.beginAttempt(proposal.proposal_id, "2026-09-16T10:05:00Z", { kind: "test" });
    await actions.markSubmitted(proposal.proposal_id);
    await actions.completeAttempt(proposal.proposal_id, "outcome_unknown", "2026-09-16T10:06:00Z", {
        status: "outcome_unknown",
    });

    const checkpoint = await coordinator.reintegrate({
        objectiveId: objective.objective_id,
        episodeId: episode.episode!.episode_id,
        proposalId: proposal.proposal_id,
        recordedAt: "2026-09-16T10:07:00Z",
        summary: "The submitted effect could not be confirmed after restart",
        proposedNextStep: "Reconcile external state before any retry",
    });
    assert.equal(checkpoint.progress, "uncertain");
    assert.match(checkpoint.uncertainty ?? "", /retry is unsafe/);
});

function json(value: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(value), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}
