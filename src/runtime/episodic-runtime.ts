import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { createCodexOpportunityEvaluator } from "../agency/codex-opportunity-evaluator.ts";
import {
  findCognitionOpportunity,
  runCognitionOpportunity,
  type CognitionOpportunityEvaluator,
} from "../agency/cognition-opportunity.ts";
import { ValidationError } from "../core/errors.ts";
import { isRfc3339Utc, type EmberState } from "../core/model.ts";
import {
  inspectSpecialistEpisode,
  recordSpecialistProcessLoss,
  runCodexSpecialist,
  type SpecialistEpisodeRecord,
  type SpecialistEpisodeSpec,
} from "../delegation/codex-specialist.ts";
import { StateStore } from "../persistence/state-store.ts";
import { startRuntime, stopRuntime } from "./runtime.ts";

export interface EpisodicRuntimeConfig {
  config_version: 1;
  state_path: string;
  records_directory: string;
  principal: string;
  active_scope: string;
  node_path: string;
  runtime_entrypoint: string;
  codex_command: string;
  codex_arguments: string[];
  opportunity_timeout_seconds: number;
  systemd_run_command: string;
  systemctl_command: string;
  stop_timeout_seconds: number;
}

export interface WakeIntent {
  record_version: 1;
  wake_id: string;
  principal: string;
  active_scope: string;
  mechanism: "external_timing";
  due_at: string;
  created_at: string;
}

export interface RuntimeObservation {
  record_version: 1;
  observed_at: string;
  kind: string;
  detail?: string;
  opportunity_id?: string;
  decision?: string | null;
  evaluator_failure?: string | null;
}

export interface CommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export type UnitState = "active" | "inactive" | "failed" | "not_found" | "unknown";

export interface RuntimeStatus {
  config_path: string;
  wakes: Array<{
    wake_id: string;
    due_at: string;
    status: "pending" | "dispatching" | "completed" | "failed";
    decision: string | null;
    evaluator_failure: string | null;
    failure_detail: string | null;
    timer_unit: string;
    timer_state: UnitState;
    service_unit: string;
    service_state: UnitState;
  }>;
  specialists: Array<{
    episode_id: string;
    status: "prepared" | "launching" | "launch_failed" | "launched" | "running" | "completed" | "failed" | "lost";
    service_unit: string;
    unit_state: UnitState;
    runtime_state: string | null;
    report_state: string | null;
    retry_state: string | null;
  }>;
}

interface WorkerOptions {
  signal?: AbortSignal;
  evaluator?: CognitionOpportunityEvaluator;
  now?: () => string;
}

interface SpecialistWorkerOptions {
  signal?: AbortSignal;
  now?: () => string;
  runSpecialist?: typeof runCodexSpecialist;
}

export class EpisodicRecordStore {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async createWake(intent: WakeIntent) {
    validateWakeIntent(intent);
    await writeExclusiveJson(this.wakeFile(intent.wake_id, "intent"), intent);
  }

  async readWake(wakeId: string): Promise<WakeIntent> {
    const intent = (await readJson(this.wakeFile(wakeId, "intent"))) as WakeIntent;
    validateWakeIntent(intent);
    return intent;
  }

  async observeWake(wakeId: string, observation: RuntimeObservation) {
    validateObservation(observation);
    await writeExclusiveJson(this.wakeFile(wakeId, observation.kind), observation);
  }

  async wakeObservation(wakeId: string, kind: string): Promise<RuntimeObservation | null> {
    validateRecordKind(kind);
    const value = (await readOptionalJson(this.wakeFile(wakeId, kind))) as RuntimeObservation | null;
    if (value !== null) validateObservation(value);
    return value;
  }

  async listWakeIds() {
    return listDirectories(join(this.root, "wakes"));
  }

  async createSpecialistSpec(spec: SpecialistEpisodeSpec) {
    validateSpecialistIdentity(spec);
    await writeExclusiveJson(this.specialistFile(spec.episode_id, "spec"), spec);
  }

  async readSpecialistSpec(episodeId: string): Promise<SpecialistEpisodeSpec> {
    const spec = (await readJson(this.specialistFile(episodeId, "spec"))) as SpecialistEpisodeSpec;
    validateSpecialistIdentity(spec);
    return spec;
  }

  async observeSpecialist(episodeId: string, observation: RuntimeObservation) {
    validateObservation(observation);
    await writeExclusiveJson(this.specialistFile(episodeId, observation.kind), observation);
  }

  async specialistObservation(episodeId: string, kind: string): Promise<RuntimeObservation | null> {
    validateRecordKind(kind);
    const value = (await readOptionalJson(this.specialistFile(episodeId, kind))) as RuntimeObservation | null;
    if (value !== null) validateObservation(value);
    return value;
  }

  async listSpecialistIds() {
    return listDirectories(join(this.root, "specialists"));
  }

  specialistRecordPath(episodeId: string) {
    return this.specialistFile(episodeId, "episode");
  }

  private wakeFile(wakeId: string, name: string) {
    validateOpaqueId(wakeId, "wake id");
    validateRecordKind(name);
    return join(this.root, "wakes", wakeId, `${name}.json`);
  }

  private specialistFile(episodeId: string, name: string) {
    validateOpaqueId(episodeId, "specialist episode id");
    validateRecordKind(name);
    return join(this.root, "specialists", episodeId, `${name}.json`);
  }
}

export class SystemdUserSupervisor {
  readonly config: EpisodicRuntimeConfig;
  readonly configPath: string;
  readonly runner: CommandRunner;

  constructor(config: EpisodicRuntimeConfig, configPath: string, runner: CommandRunner = runCommand) {
    validateConfig(config);
    requireAbsolute(configPath, "runtime config path");
    this.config = config;
    this.configPath = configPath;
    this.runner = runner;
  }

  async scheduleWake(intent: WakeIntent) {
    validateWakeIntent(intent);
    const unit = wakeUnitName(intent.wake_id);
    await this.run(this.config.systemd_run_command, [
      "--user",
      "--collect",
      `--unit=${unit}`,
      `--on-calendar=${systemdCalendarTimestamp(intent.due_at)}`,
      "--property=Type=exec",
      "--property=Restart=no",
      ...this.wakeWorkerCommand(intent.wake_id),
    ]);
  }

  async startWakeNow(intent: WakeIntent) {
    validateWakeIntent(intent);
    const unit = wakeUnitName(intent.wake_id);
    await this.run(this.config.systemd_run_command, [
      "--user",
      "--collect",
      `--unit=${unit}`,
      "--property=Type=exec",
      "--property=Restart=no",
      ...this.wakeWorkerCommand(intent.wake_id),
    ]);
  }

  async startSpecialist(episodeId: string) {
    validateOpaqueId(episodeId, "specialist episode id");
    const unit = specialistUnitName(episodeId);
    await this.run(this.config.systemd_run_command, [
      "--user",
      "--collect",
      `--unit=${unit}`,
      "--property=Type=exec",
      "--property=Restart=no",
      "--property=KillMode=mixed",
      `--property=TimeoutStopSec=${this.config.stop_timeout_seconds}s`,
      this.config.node_path,
      this.config.runtime_entrypoint,
      "run-specialist",
      "--config",
      this.configPath,
      "--episode-id",
      episodeId,
    ]);
  }

  async unitState(unit: string): Promise<UnitState> {
    const result = await this.runner(this.config.systemctl_command, [
      "--user",
      "show",
      unit,
      "--property=LoadState",
      "--property=ActiveState",
      "--value",
    ]);
    const values = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (values.includes("not-found")) return "not_found";
    if (values.includes("failed")) return "failed";
    if (values.includes("active") || values.includes("activating") || values.includes("reloading")) return "active";
    if (values.includes("inactive") || values.includes("deactivating")) return "inactive";
    if (result.code !== 0 && /not found|not-found|could not be found/i.test(result.stderr)) return "not_found";
    return "unknown";
  }

  async installReconciliationUnit(unitDirectory: string) {
    requireAbsolute(unitDirectory, "systemd user unit directory");
    await mkdir(unitDirectory, { recursive: true });
    const unitPath = join(unitDirectory, "ember-reconcile.service");
    const content = renderReconciliationUnit(this.config, this.configPath);
    await writeAtomic(unitPath, content, 0o600);
    await this.run(this.config.systemctl_command, ["--user", "daemon-reload"]);
    await this.run(this.config.systemctl_command, ["--user", "enable", "--now", "ember-reconcile.service"]);
    return unitPath;
  }

  private wakeWorkerCommand(wakeId: string) {
    validateOpaqueId(wakeId, "wake id");
    return [
      this.config.node_path,
      this.config.runtime_entrypoint,
      "run-wake",
      "--config",
      this.configPath,
      "--wake-id",
      wakeId,
    ];
  }

  private async run(command: string, args: string[]) {
    const result = await this.runner(command, args);
    if (result.code !== 0) {
      throw new Error(`${command} failed with ${result.code ?? result.signal ?? "unknown"}: ${result.stderr.trim()}`);
    }
    return result;
  }
}

export async function loadEpisodicRuntimeConfig(path: string): Promise<EpisodicRuntimeConfig> {
  requireAbsolute(path, "runtime config path");
  const value = JSON.parse(await readFile(path, "utf8")) as EpisodicRuntimeConfig;
  validateConfig(value);
  return value;
}

export async function scheduleWake(
  config: EpisodicRuntimeConfig,
  configPath: string,
  dueAt: string,
  { now = () => new Date().toISOString(), runner }: { now?: () => string; runner?: CommandRunner } = {},
) {
  validateConfig(config);
  if (!isRfc3339Utc(dueAt)) throw new ValidationError("wake due time must be RFC 3339 UTC");
  const createdAt = now();
  if (!isRfc3339Utc(createdAt)) throw new ValidationError("wake creation time must be RFC 3339 UTC");
  const wakeId = `wake-${randomUUID()}`;
  const intent: WakeIntent = {
    record_version: 1,
    wake_id: wakeId,
    principal: config.principal,
    active_scope: config.active_scope,
    mechanism: "external_timing",
    due_at: dueAt,
    created_at: createdAt,
  };
  const records = new EpisodicRecordStore(config.records_directory);
  await records.createWake(intent);
  const supervisor = new SystemdUserSupervisor(config, configPath, runner);
  if (Date.parse(dueAt) <= Date.parse(createdAt)) await supervisor.startWakeNow(intent);
  else await supervisor.scheduleWake(intent);
  return intent;
}

export async function startSpecialistEpisode(
  config: EpisodicRuntimeConfig,
  configPath: string,
  spec: SpecialistEpisodeSpec,
  { now = () => new Date().toISOString(), runner }: { now?: () => string; runner?: CommandRunner } = {},
) {
  validateConfig(config);
  validateSpecialistIdentity(spec);
  const records = new EpisodicRecordStore(config.records_directory);
  await records.createSpecialistSpec(spec);
  await records.observeSpecialist(spec.episode_id, observation("launch_attempted", now()));
  const supervisor = new SystemdUserSupervisor(config, configPath, runner);
  try {
    await supervisor.startSpecialist(spec.episode_id);
    await records.observeSpecialist(spec.episode_id, observation("launch_accepted", now()));
  } catch (error) {
    await records.observeSpecialist(spec.episode_id, observation("launch_failed", now(), errorMessage(error)));
    throw error;
  }
  return spec.episode_id;
}

export async function runWakeWorker(config: EpisodicRuntimeConfig, wakeId: string, options: WorkerOptions = {}) {
  validateConfig(config);
  const now = options.now ?? (() => new Date().toISOString());
  const records = new EpisodicRecordStore(config.records_directory);
  const intent = await records.readWake(wakeId);
  if (intent.principal !== config.principal || intent.active_scope !== config.active_scope) {
    throw new ValidationError("wake intent principal/scope differs from runtime configuration");
  }
  if (
    (await records.wakeObservation(wakeId, "dispatching")) ||
    (await records.wakeObservation(wakeId, "completed")) ||
    (await records.wakeObservation(wakeId, "failed"))
  ) {
    return { status: "already_dispatched" as const };
  }

  const store = new StateStore(config.state_path);
  const lease = await store.acquireWriteLease();
  let state: EmberState | null = null;
  let runtimeId: ReturnType<typeof startRuntime>["runtimeId"] | null = null;
  let cleanStopped = false;
  try {
    state = await store.load();
    if (state.runtime_contract.local_principal !== config.principal) {
      throw new ValidationError("runtime config principal differs from continuity state");
    }
    const started = startRuntime(state, config.principal, config.active_scope);
    runtimeId = started.runtimeId;
    state = await store.commit(state.revision, started.state);
    await records.observeWake(wakeId, observation("dispatching", now()));

    const evaluator =
      options.evaluator ??
      createCodexOpportunityEvaluator({
        command: config.codex_command,
        arguments_: config.codex_arguments,
        timeoutSeconds: config.opportunity_timeout_seconds,
        signal: options.signal,
      });
    const result = await runCognitionOpportunity(store, state, {
      runtimeId,
      principal: config.principal,
      scope: config.active_scope,
      mechanism: "external_timing",
      evaluator,
    });
    state = result.state;
    const occurrence = findCognitionOpportunity(state, result.opportunityId);
    state = await store.commit(state.revision, stopRuntime(state, runtimeId, { reason: "episodic_wake_complete" }));
    cleanStopped = true;
    await records.observeWake(wakeId, {
      ...observation("completed", now()),
      opportunity_id: result.opportunityId,
      decision: occurrence.decision,
      evaluator_failure: result.evaluatorFailure,
    });
    return {
      status: "completed" as const,
      opportunityId: result.opportunityId,
      decision: occurrence.decision,
      evaluatorFailure: result.evaluatorFailure,
    };
  } catch (error) {
    if (state !== null && runtimeId !== null && !cleanStopped) {
      try {
        state = await store.commit(state.revision, stopRuntime(state, runtimeId, { reason: "episodic_wake_failed" }));
      } catch {}
    }
    if (await records.wakeObservation(wakeId, "dispatching")) {
      await records.observeWake(wakeId, observation("failed", now(), errorMessage(error))).catch(() => {});
    }
    throw error;
  } finally {
    await store.releaseWriteLease(lease);
  }
}

export async function runSpecialistWorker(
  config: EpisodicRuntimeConfig,
  episodeId: string,
  options: SpecialistWorkerOptions = {},
) {
  validateConfig(config);
  const now = options.now ?? (() => new Date().toISOString());
  const records = new EpisodicRecordStore(config.records_directory);
  const spec = await records.readSpecialistSpec(episodeId);
  if (await records.specialistObservation(episodeId, "worker_started")) {
    const existing = await readOptionalSpecialist(records.specialistRecordPath(episodeId));
    if (existing && ["exited", "lost"].includes(existing.runtime_state)) return existing;
    throw new Error("specialist worker has already started; refusing duplicate execution");
  }
  await records.observeSpecialist(episodeId, observation("worker_started", now()));
  const run = options.runSpecialist ?? runCodexSpecialist;
  try {
    const result = await run(spec, {
      recordPath: records.specialistRecordPath(episodeId),
      signal: options.signal,
      now,
    });
    await records.observeSpecialist(episodeId, observation("worker_completed", now()));
    return result;
  } catch (error) {
    await records.observeSpecialist(episodeId, observation("worker_failed", now(), errorMessage(error))).catch(() => {});
    throw error;
  }
}

export async function reconcileEpisodicRuntime(
  config: EpisodicRuntimeConfig,
  configPath: string,
  { runner, now = () => new Date().toISOString() }: { runner?: CommandRunner; now?: () => string } = {},
) {
  validateConfig(config);
  const records = new EpisodicRecordStore(config.records_directory);
  const supervisor = new SystemdUserSupervisor(config, configPath, runner);
  const repairedWakes: string[] = [];
  const startedDueWakes: string[] = [];
  const ambiguousWakes: string[] = [];
  const lostSpecialists: string[] = [];
  const observedAt = now();
  if (!isRfc3339Utc(observedAt)) throw new ValidationError("reconciliation timestamp must be RFC 3339 UTC");

  for (const wakeId of await records.listWakeIds()) {
    const completed = await records.wakeObservation(wakeId, "completed");
    const failed = await records.wakeObservation(wakeId, "failed");
    if (completed || failed) continue;
    if (await records.wakeObservation(wakeId, "dispatching")) {
      ambiguousWakes.push(wakeId);
      continue;
    }
    const intent = await records.readWake(wakeId);
    if (Date.parse(intent.due_at) <= Date.parse(observedAt)) {
      const serviceState = await supervisor.unitState(`${wakeUnitName(wakeId)}.service`);
      if (serviceState === "not_found") {
        await supervisor.startWakeNow(intent);
        startedDueWakes.push(wakeId);
      } else if (serviceState !== "active") {
        ambiguousWakes.push(wakeId);
      }
      continue;
    }
    const timerState = await supervisor.unitState(`${wakeUnitName(wakeId)}.timer`);
    if (timerState === "not_found") {
      await supervisor.scheduleWake(intent);
      repairedWakes.push(wakeId);
    }
  }

  for (const episodeId of await records.listSpecialistIds()) {
    const recordPath = records.specialistRecordPath(episodeId);
    const record = await readOptionalSpecialist(recordPath);
    if (!record || ["exited", "lost"].includes(record.runtime_state)) continue;
    const unitState = await supervisor.unitState(`${specialistUnitName(episodeId)}.service`);
    if (unitState === "not_found" || unitState === "inactive" || unitState === "failed") {
      if (["not_started", "running", "cancellation_requested", "timed_out"].includes(record.runtime_state)) {
        await recordSpecialistProcessLoss(
          recordPath,
          `systemd unit ${specialistUnitName(episodeId)} is ${unitState} during runtime reconciliation`,
          { now: () => observedAt },
        );
        lostSpecialists.push(episodeId);
      }
    }
  }

  return { repairedWakes, startedDueWakes, ambiguousWakes, lostSpecialists };
}

export async function inspectEpisodicRuntime(
  config: EpisodicRuntimeConfig,
  configPath: string,
  { runner }: { runner?: CommandRunner } = {},
): Promise<RuntimeStatus> {
  validateConfig(config);
  const records = new EpisodicRecordStore(config.records_directory);
  const supervisor = new SystemdUserSupervisor(config, configPath, runner);
  const wakes: RuntimeStatus["wakes"] = [];
  for (const wakeId of await records.listWakeIds()) {
    const intent = await records.readWake(wakeId);
    const status = await wakeStatus(records, wakeId);
    const completed = await records.wakeObservation(wakeId, "completed");
    const failed = await records.wakeObservation(wakeId, "failed");
    const timerUnit = `${wakeUnitName(wakeId)}.timer`;
    const serviceUnit = `${wakeUnitName(wakeId)}.service`;
    wakes.push({
      wake_id: wakeId,
      due_at: intent.due_at,
      status,
      decision: completed?.decision ?? null,
      evaluator_failure: completed?.evaluator_failure ?? null,
      failure_detail: failed?.detail ?? null,
      timer_unit: timerUnit,
      timer_state: await supervisor.unitState(timerUnit),
      service_unit: serviceUnit,
      service_state: await supervisor.unitState(serviceUnit),
    });
  }

  const specialists: RuntimeStatus["specialists"] = [];
  for (const episodeId of await records.listSpecialistIds()) {
    const record = await readOptionalSpecialist(records.specialistRecordPath(episodeId));
    const serviceUnit = `${specialistUnitName(episodeId)}.service`;
    specialists.push({
      episode_id: episodeId,
      status: await specialistStatus(records, episodeId, record),
      service_unit: serviceUnit,
      unit_state: await supervisor.unitState(serviceUnit),
      runtime_state: record?.runtime_state ?? null,
      report_state: record?.report_state ?? null,
      retry_state: record?.recovery.retry_state ?? null,
    });
  }

  return { config_path: configPath, wakes, specialists };
}

export function renderReconciliationUnit(config: EpisodicRuntimeConfig, configPath: string) {
  validateConfig(config);
  requireAbsolute(configPath, "runtime config path");
  return [
    "[Unit]",
    "Description=Ember episodic runtime reconciliation",
    "After=default.target",
    "",
    "[Service]",
    "Type=oneshot",
    "Restart=no",
    `ExecStart=${systemdQuote(config.node_path)} ${systemdQuote(config.runtime_entrypoint)} reconcile --config ${systemdQuote(configPath)}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

export function wakeUnitName(wakeId: string) {
  validateOpaqueId(wakeId, "wake id");
  return `ember-wake-${wakeId}`;
}

export function specialistUnitName(episodeId: string) {
  validateOpaqueId(episodeId, "specialist episode id");
  return `ember-specialist-${episodeId}`;
}

async function wakeStatus(
  records: EpisodicRecordStore,
  wakeId: string,
): Promise<RuntimeStatus["wakes"][number]["status"]> {
  if (await records.wakeObservation(wakeId, "completed")) return "completed";
  if (await records.wakeObservation(wakeId, "failed")) return "failed";
  if (await records.wakeObservation(wakeId, "dispatching")) return "dispatching";
  return "pending";
}

async function specialistStatus(
  records: EpisodicRecordStore,
  episodeId: string,
  record: SpecialistEpisodeRecord | null,
): Promise<RuntimeStatus["specialists"][number]["status"]> {
  if (record?.runtime_state === "lost") return "lost";
  if (record?.runtime_state === "exited") return "completed";
  if (await records.specialistObservation(episodeId, "worker_failed")) return "failed";
  if (await records.specialistObservation(episodeId, "worker_started")) return "running";
  if (await records.specialistObservation(episodeId, "launch_failed")) return "launch_failed";
  if (await records.specialistObservation(episodeId, "launch_accepted")) return "launched";
  if (await records.specialistObservation(episodeId, "launch_attempted")) return "launching";
  return "prepared";
}

async function readOptionalSpecialist(path: string): Promise<SpecialistEpisodeRecord | null> {
  try {
    return await inspectSpecialistEpisode(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

function observation(kind: string, observedAt: string, detail?: string): RuntimeObservation {
  const value: RuntimeObservation = {
    record_version: 1,
    observed_at: observedAt,
    kind,
    ...(detail ? { detail: detail.slice(0, 32_768) } : {}),
  };
  validateObservation(value);
  return value;
}

function validateConfig(value: EpisodicRuntimeConfig) {
  if (!value || typeof value !== "object" || value.config_version !== 1) {
    throw new ValidationError("episodic runtime config_version must be 1");
  }
  for (const [name, path] of [
    ["state_path", value.state_path],
    ["records_directory", value.records_directory],
    ["node_path", value.node_path],
    ["runtime_entrypoint", value.runtime_entrypoint],
    ["codex_command", value.codex_command],
    ["systemd_run_command", value.systemd_run_command],
    ["systemctl_command", value.systemctl_command],
  ] as const) {
    requireAbsolute(path, name);
  }
  if (typeof value.principal !== "string" || !value.principal.trim()) {
    throw new ValidationError("runtime principal must be non-empty");
  }
  if (typeof value.active_scope !== "string" || !value.active_scope.trim()) {
    throw new ValidationError("runtime active_scope must be non-empty");
  }
  if (!Array.isArray(value.codex_arguments) || !value.codex_arguments.every((item) => typeof item === "string")) {
    throw new ValidationError("codex_arguments must be a string list");
  }
  if (!Number.isFinite(value.opportunity_timeout_seconds) || value.opportunity_timeout_seconds <= 0) {
    throw new ValidationError("opportunity_timeout_seconds must be positive");
  }
  if (!Number.isFinite(value.stop_timeout_seconds) || value.stop_timeout_seconds <= 0) {
    throw new ValidationError("stop_timeout_seconds must be positive");
  }
}

function validateWakeIntent(value: WakeIntent) {
  if (!value || value.record_version !== 1) throw new ValidationError("wake intent record_version must be 1");
  validateOpaqueId(value.wake_id, "wake id");
  if (!isRfc3339Utc(value.due_at) || !isRfc3339Utc(value.created_at)) {
    throw new ValidationError("wake timestamps must be RFC 3339 UTC");
  }
  if (value.mechanism !== "external_timing") throw new ValidationError("wake mechanism must be external_timing");
  if (typeof value.principal !== "string" || !value.principal) {
    throw new ValidationError("wake principal must be non-empty");
  }
  if (typeof value.active_scope !== "string" || !value.active_scope) {
    throw new ValidationError("wake active scope must be non-empty");
  }
}

function validateSpecialistIdentity(spec: SpecialistEpisodeSpec) {
  if (!spec || spec.contract_version !== 2) throw new ValidationError("specialist spec contract_version must be 2");
  validateOpaqueId(spec.episode_id, "specialist episode id");
}

function validateObservation(value: RuntimeObservation) {
  if (!value || value.record_version !== 1 || typeof value.kind !== "string" || !isRfc3339Utc(value.observed_at)) {
    throw new ValidationError("runtime observation is invalid");
  }
  validateRecordKind(value.kind);
}

function validateRecordKind(value: string) {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(value)) throw new ValidationError("runtime record kind is invalid");
}

function validateOpaqueId(value: string, label: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,160}$/.test(value)) {
    throw new ValidationError(`${label} must contain only opaque unit-safe characters`);
  }
}

function requireAbsolute(value: string, label: string) {
  if (typeof value !== "string" || !isAbsolute(value) || /[\0\r\n]/.test(value)) {
    throw new ValidationError(`${label} must be a safe absolute path`);
  }
}

function systemdCalendarTimestamp(value: string) {
  if (!isRfc3339Utc(value)) throw new ValidationError("systemd calendar timestamp must originate from RFC 3339 UTC");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ValidationError("systemd calendar timestamp is invalid");
  const roundedUp = Math.ceil(parsed / 1000) * 1000;
  const normalized = new Date(roundedUp).toISOString();
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 19)} UTC`;
}

function systemdQuote(value: string) {
  return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

async function writeExclusiveJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

async function writeAtomic(path: string, content: string, mode: number) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode });
  await rename(temporary, path);
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function readOptionalJson(path: string) {
  try {
    return await readJson(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

async function listDirectories(path: string) {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
}

export async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown) {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}
