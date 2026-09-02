import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  createSpecialistEpisode,
  reconcileInterruptedSpecialist,
  type SpecialistEpisodeRecord,
  type SpecialistReport,
} from "./codex-specialist.ts";
import {
  inspectSpecialistReintegration,
  reintegrateSpecialistResult,
} from "./specialist-reintegration.ts";
import { tempDir } from "../../tests/support.ts";

const CURRENT_CHECKPOINT = {
  objective_revision: "objective-1",
  context_revision: "context-1",
  objective_status: "current" as const,
};

function specialistReport(overrides: Partial<SpecialistReport> = {}): SpecialistReport {
  return {
    contract_version: 1,
    summary: "Specialist reports the bounded objective complete.",
    objective_disposition: "completed",
    artifacts_changed: ["result.txt"],
    artifacts_inspected: ["README.md"],
    checks: [{ command: "node --test", outcome: "passed" }],
    known_effects: ["result.txt changed in the selected workspace"],
    possible_effects: [],
    blockers: [],
    requested_follow_up: [],
    expansion_requests: [],
    ...overrides,
  };
}

async function recordFixture(options: {
  episodeId?: string;
  contextRevision?: string;
  contextProvenance?: string;
  report?: SpecialistReport;
} = {}) {
  const root = await tempDir();
  const workspace = resolve(root, "workspace");
  const recordPath = join(root, `${options.episodeId ?? "episode-65"}.json`);
  const report = options.report ?? specialistReport();
  await mkdir(workspace);
  const spec = createSpecialistEpisode({
    episode_id: options.episodeId ?? "episode-65",
    objective: "Produce the bounded specialist result for issue 65.",
    acceptance: ["The result remains attributable and current before integration"],
    context_projection: [{
      content: "current bounded context",
      provenance: options.contextProvenance ?? "evidence:user-command-65",
      scope: "project:ember",
      currentness: "current",
    }],
    authority_envelope: {
      principal: "user-1",
      grant: "Perform bounded repository work only",
      provenance: "current user authority for issue 65",
      currentness: "current",
      permitted_actions: ["inspect and modify the selected workspace"],
      prohibited_actions: ["act outside the selected workspace"],
      escalation_conditions: ["broader authority is needed"],
    },
    runtime_capability: {
      filesystem: { scope: "selected_workspace", mode: "read_write" },
      network_reach: "not_established",
      tools: ["workspace tools"],
      credentials: "allowlisted_runtime_auth",
    },
    workspace: {
      path: workspace,
      expected_identity: "issue-65 fixture",
      preserve_existing_changes: true,
    },
    runtime_policy: {
      command: process.execPath,
      argument_prefix: [],
      sandbox: "workspace-write",
      network: "no_additional_grant",
      configuration: "isolated",
      environment: "allowlisted_runtime_auth",
      timeout_seconds: 5,
      stdout_limit_bytes: 1024 * 1024,
      session_mode: "ephemeral",
    },
    currentness_basis: {
      objective_revision: "objective-1",
      context_revision: options.contextRevision ?? "context-1",
    },
  });
  const effectsPossible = report.possible_effects.length > 0;
  const record: SpecialistEpisodeRecord = {
    record_version: 3,
    specification: spec,
    runtime_state: "exited",
    report_state: report.objective_disposition === "completed" ? "reported_success" : "reported_failure",
    ember_disposition: "unresolved",
    report,
    report_provenance: {
      source_role: "specialist_report",
      source: "codex_specialist",
      episode_id: spec.episode_id,
    },
    recovery: effectsPossible
      ? {
          effect_state: "effects_possible",
          continued_work_state: "unknown",
          retry_state: "prohibited_pending_reconciliation",
          reconciliation_required: "Independently reconcile possible effects before relying on the result.",
        }
      : {
          effect_state: "effects_known",
          continued_work_state: "not_applicable",
          retry_state: "not_applicable",
          reconciliation_required: null,
        },
    known_effects: [],
    possible_effects: [],
    observations: [
      { observed_at: "2026-09-02T14:00:00.000Z", kind: "report_received" },
      { observed_at: "2026-09-02T14:00:01.000Z", kind: "child_exit_observed" },
    ],
  };
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return { root, recordPath, record };
}

test("current specialist success should require and persist an Ember-owned reintegration decision", async () => {
  const fixture = await recordFixture();

  const pending = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    now: () => "2026-09-02T15:00:00.000Z",
  });

  assert.equal(pending.latest_decision?.outcome, "withheld");
  assert.equal(pending.latest_decision?.resulting_disposition, "unresolved");
  assert.equal(pending.latest_decision?.canonical_mutation.eligibility, "not_eligible");
  assert.deepEqual(pending.latest_decision?.report_provenance, fixture.record.report_provenance);

  const accepted = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "accepted",
      reason: "Ember evaluated the current objective, attributed report, and known workspace effect as sufficient.",
    },
    now: () => "2026-09-02T15:01:00.000Z",
  });

  assert.equal(accepted.latest_decision?.outcome, "integrated");
  assert.equal(accepted.record.ember_disposition, "accepted");
  assert.equal(accepted.latest_decision?.canonical_mutation.eligibility, "eligible_after_ember_decision");
  assert.equal(accepted.audit?.history.length, 2);
  assert.equal((await inspectSpecialistReintegration(fixture.recordPath)).latest_decision?.decision_id, accepted.latest_decision?.decision_id);
});

test("late successful specialist result should be withheld as stale against current Ember state", async () => {
  const fixture = await recordFixture();

  const inspection = await reintegrateSpecialistResult(fixture.recordPath, {
    objective_revision: "objective-2",
    context_revision: "context-2",
    objective_status: "superseded",
  }, {
    decision: {
      disposition: "accepted",
      reason: "The old result looked technically successful.",
    },
  });

  assert.equal(inspection.latest_decision?.outcome, "withheld");
  assert.equal(inspection.record.ember_disposition, "stale");
  assert.match(inspection.latest_decision?.reason ?? "", /historical specialist success/);
  assert.deepEqual(inspection.latest_decision?.report_provenance, fixture.record.report_provenance);
});

test("partial specialist result should not establish completion but may be integrated as qualified evidence", async () => {
  const fixture = await recordFixture({
    report: specialistReport({
      summary: "Specialist changed one artifact before becoming blocked.",
      objective_disposition: "blocked",
      artifacts_changed: ["partial.txt"],
      checks: [],
      known_effects: ["partial.txt was created"],
      blockers: ["A required current input was unavailable"],
    }),
  });

  const refusedCompletion = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "accepted",
      reason: "Treat the partial work as complete.",
    },
  });

  assert.equal(refusedCompletion.latest_decision?.result_shape, "partial");
  assert.equal(refusedCompletion.latest_decision?.outcome, "withheld");
  assert.equal(refusedCompletion.record.ember_disposition, "unresolved");

  const qualified = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "qualified",
      reason: "Ember preserves the attributable partial artifact as useful evidence without claiming objective completion.",
    },
  });

  assert.equal(qualified.latest_decision?.outcome, "integrated");
  assert.equal(qualified.record.ember_disposition, "qualified");
});

test("ambiguous-effect success should remain withheld until effects are independently reconciled", async () => {
  const fixture = await recordFixture({
    report: specialistReport({
      possible_effects: ["A descendant process may still write another file."],
    }),
  });

  const withheld = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "accepted",
      reason: "The specialist reported success.",
    },
  });

  assert.equal(withheld.latest_decision?.result_shape, "ambiguous_effect");
  assert.equal(withheld.latest_decision?.outcome, "withheld");
  assert.equal(withheld.latest_decision?.canonical_mutation.eligibility, "not_eligible");
  assert.match(withheld.latest_decision?.reason ?? "", /independent reconciliation/);

  await reconcileInterruptedSpecialist(fixture.recordPath, {
    effects_absent: true,
    continued_work: "stopped",
    detail: "Current workspace inspection found no unaccounted effect and no specialist work remains active.",
  });
  const accepted = await reintegrateSpecialistResult(fixture.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "accepted",
      reason: "Ember independently reconciled the possible effects and the current objective still matches.",
    },
  });

  assert.equal(accepted.latest_decision?.outcome, "integrated");
  assert.equal(accepted.record.ember_disposition, "accepted");
});

test("specialist attempts derived from the same evidence should remain one correlated source group", async () => {
  const primary = await recordFixture({ episodeId: "episode-65-a" });
  const repeated = await recordFixture({ episodeId: "episode-65-b" });

  const inspection = await reintegrateSpecialistResult(primary.recordPath, CURRENT_CHECKPOINT, {
    decision: {
      disposition: "accepted",
      reason: "Ember accepts the result on its merits rather than by majority vote.",
    },
    corroboratingRecordPaths: [repeated.recordPath],
  });

  assert.deepEqual(inspection.latest_decision?.corroboration.considered_episode_ids, ["episode-65-a", "episode-65-b"]);
  assert.equal(inspection.latest_decision?.corroboration.source_groups.length, 1);
  assert.deepEqual(inspection.latest_decision?.corroboration.source_groups[0]?.episode_ids, ["episode-65-a", "episode-65-b"]);
  assert.equal(inspection.latest_decision?.corroboration.independence, "not_established");
});

test("changed relevant context should remain withheld until Ember records a current-context re-evaluation", async () => {
  const fixture = await recordFixture();
  const changedCheckpoint = {
    objective_revision: "objective-1",
    context_revision: "context-2",
    objective_status: "current" as const,
  };

  const withheld = await reintegrateSpecialistResult(fixture.recordPath, changedCheckpoint, {
    decision: {
      disposition: "accepted",
      reason: "Accept after checking the changed requirement.",
    },
  });

  assert.equal(withheld.latest_decision?.outcome, "withheld");
  assert.equal(withheld.record.ember_disposition, "requires_re_evaluation");

  const accepted = await reintegrateSpecialistResult(fixture.recordPath, changedCheckpoint, {
    decision: {
      disposition: "accepted",
      reason: "The result remains applicable after Ember's semantic re-evaluation.",
      current_context_re_evaluation: "The changed context does not alter the requested artifact or acceptance constraints.",
    },
  });

  assert.equal(accepted.latest_decision?.outcome, "integrated");
  assert.equal(accepted.record.ember_disposition, "accepted");
  assert.equal(accepted.record.currentness_evaluation?.resolution?.disposition, "accepted");
});
