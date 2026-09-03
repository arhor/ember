import { spawn } from "node:child_process";

export type EndogenousRestartScenarioKind = "reactivation" | "resolved" | "superseded" | "silence";

export interface EndogenousRestartScenario {
  id: string;
  description: string;
  kind: EndogenousRestartScenarioKind;
  expected_decision: "cognition" | "no_cognition";
  expected_selected_aliases: string[];
}

export interface EndogenousRestartReport {
  report_version: 1;
  scenario_id: string;
  execution_mode: "fixture" | "live";
  sanitized: true;
  passed: boolean;
  assertions: Array<{ assertion: string; expected: unknown; observed: unknown; passed: boolean }>;
}

interface PhaseResult {
  pid: number;
  lineage_id: string;
  runtime_id: string;
  decision?: string;
  selected_aliases?: string[];
  current_aliases?: string[];
  historical_aliases?: string[];
  gap_kind?: string;
  downtime_cognition?: string;
  provider_thread_mode?: string;
}

export async function runEndogenousRestartScenario(
  scenario: EndogenousRestartScenario,
  options: { statePath: string; workerPath: string; cwd: string; executionMode: "fixture" | "live"; codexCommand?: string; timeoutSeconds?: number },
): Promise<EndogenousRestartReport> {
  const prepared = await runPhase(options, ["prepare", scenario.kind, options.statePath]);
  const restarted = await runPhase(options, [
    "restart", scenario.kind, options.statePath, options.executionMode,
    options.codexCommand ?? "codex", String(options.timeoutSeconds ?? 120),
  ]);
  const checks = [
    check("complete Ember process restarted", true, prepared.pid !== restarted.pid),
    check("Ember runtime restarted", true, prepared.runtime_id !== restarted.runtime_id),
    check("lineage survived restart", true, prepared.lineage_id === restarted.lineage_id),
    check("recovery exposes clean operational gap", "known_clean_stop_interval", restarted.gap_kind),
    check("downtime cognition is bounded truthfully", "none_in_supported_runtime", restarted.downtime_cognition),
    check("post-restart opportunity decision", scenario.expected_decision, restarted.decision),
    check("post-restart selected durable reasons", scenario.expected_selected_aliases.slice().sort(), restarted.selected_aliases?.slice().sort()),
    check(
      "post-restart evaluator has no prior thread history",
      options.executionMode === "live" ? "ephemeral" : "deterministic_no_session",
      restarted.provider_thread_mode,
    ),
  ];
  if (scenario.kind === "resolved") checks.push(check("resolved concern remains historical", ["concern"], restarted.historical_aliases));
  if (scenario.kind === "superseded") checks.push(check("superseded consequence remains historical", ["old-consequence"], restarted.historical_aliases));
  return {
    report_version: 1,
    scenario_id: scenario.id,
    execution_mode: options.executionMode,
    sanitized: true,
    passed: checks.every(item => item.passed),
    assertions: checks,
  };
}

function check(assertion: string, expected: unknown, observed: unknown) {
  return { assertion, expected, observed, passed: JSON.stringify(expected) === JSON.stringify(observed) };
}

async function runPhase(options: { workerPath: string; cwd: string }, args: string[]): Promise<PhaseResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [options.workerPath, ...args], {
      cwd: options.cwd,
      env: { ...process.env, EMBER_TEST_NOW: args[0] === "prepare" ? "2026-09-03T00:03:00Z" : "2026-09-04T00:00:02Z" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (child.pid === undefined) return reject(new Error("failed to observe Ember worker pid"));
    const pid = child.pid;
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(`endogenous restart ${args[0]} phase exited ${code}: ${stderr.trim().slice(0, 4096)}`));
      try { resolve({ ...JSON.parse(stdout), pid }); } catch (error) { reject(error); }
    });
  });
}
