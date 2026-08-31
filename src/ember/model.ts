import { createHash, randomUUID } from "node:crypto";
import { ValidationError } from "./errors.ts";

declare const idBrand: unique symbol;
type Brand<Name extends string> = string & { readonly [idBrand]: Name };

export type LineageId = Brand<"LineageId">;
export type MeaningId = Brand<"MeaningId">;
export type EvidenceId = Brand<"EvidenceId">;
export type RuntimeId = Brand<"RuntimeId">;
export type CognitionId = Brand<"CognitionId">;
export type Currentness = "current" | "superseded" | "historical";
export type MeaningKind = "relationship" | "fact" | "preference" | "commitment" | "episode_meta";
export type SourceRole = "user_command" | "ember_adoption" | "ember_expression_via_provider" | "runtime_observation" | "fixture_fault";
export type CognitionStatus = "started" | "completed" | "failed" | "timed_out" | "cancellation_requested" | "outcome_unknown";
export type DeliveryStatus = "not_attempted" | "pending" | "displayed";
export type CognitionPurpose = "ordinary" | "explain";

export interface RuntimeContract {
  local_principal: string;
  topology: typeof TOPOLOGY;
}

export interface ConstitutiveBoundary {
  boundary_id: "minimal-continuity-v1";
  text: string;
}

export interface Lineage {
  lineage_id: LineageId;
  display_name: string;
  established_at: string;
  constitutive_boundaries: ConstitutiveBoundary[];
}

interface EvidenceBase {
  evidence_id: EvidenceId;
  source_role: SourceRole;
  source_actor: string;
  asserted_principal?: string;
  occurred_at: string;
  observed_at: string;
  derived_from_evidence_ids: EvidenceId[];
  scope: string;
  related_meaning_id?: MeaningId;
  cognition_id?: CognitionId;
  provider_label?: string;
}

export interface AvailableUserEvidence extends EvidenceBase {
  source_role: "user_command";
  source_actor: `user:${string}`;
  asserted_principal: string;
  derived_from_evidence_ids: [];
  payload_mode: "retained_optional";
  availability: "available";
  payload: string;
  content_digest: `sha256:${string}`;
  unavailable_reason?: never;
}

export interface UnavailableUserDetailEvidence extends EvidenceBase {
  source_role: "user_command";
  source_actor: `user:${string}`;
  asserted_principal: string;
  derived_from_evidence_ids: [];
  payload_mode: "retained_optional";
  availability: "unavailable";
  related_meaning_id: MeaningId;
  unavailable_reason: string;
  payload?: never;
  content_digest?: never;
}

export interface EmberAdoptionEvidence extends EvidenceBase {
  source_role: "ember_adoption";
  source_actor: "ember";
  asserted_principal: string;
  derived_from_evidence_ids: [EvidenceId];
  payload_mode: "descriptor_only";
}

export interface EmberExpressionEvidence extends EvidenceBase {
  source_role: "ember_expression_via_provider";
  source_actor: "ember";
  asserted_principal: string;
  derived_from_evidence_ids: [];
  payload_mode: "descriptor_only";
  cognition_id: CognitionId;
  provider_label: string;
}

export interface RuntimeObservationEvidence extends EvidenceBase {
  source_role: "runtime_observation";
  source_actor: "runtime";
  payload_mode: "descriptor_only";
}

export interface FixtureFaultEvidence extends EvidenceBase {
  source_role: "fixture_fault";
  source_actor: "runtime";
  asserted_principal: string;
  derived_from_evidence_ids: [EvidenceId];
  payload_mode: "descriptor_only";
  related_meaning_id: MeaningId;
}

export type Evidence =
  | AvailableUserEvidence
  | UnavailableUserDetailEvidence
  | EmberAdoptionEvidence
  | EmberExpressionEvidence
  | RuntimeObservationEvidence
  | FixtureFaultEvidence;

interface MeaningBase {
  meaning_id: MeaningId;
  kind: MeaningKind;
  owner: string;
  slot: string;
  scope: string;
  content: string;
  source_evidence_ids: EvidenceId[];
  epistemic_role: "user_testimony" | "ember_commitment";
  learned_at: string;
  applicable_from: string;
  applicable_until: string | null;
  currentness: Currentness;
  prospective_lifecycle: "none" | "live";
  supersedes: MeaningId | null;
  superseded_by: MeaningId | null;
  uncertainty: string | null;
}

export interface RelationshipMeaning extends MeaningBase {
  kind: "relationship";
  owner: `relationship:${string}`;
  currentness: "current";
  prospective_lifecycle: "none";
  supersedes: null;
  superseded_by: null;
}

export interface FactMeaning extends MeaningBase {
  kind: "fact";
  owner: `user:${string}`;
  currentness: "current" | "superseded";
  prospective_lifecycle: "none";
}

export interface PreferenceMeaning extends MeaningBase {
  kind: "preference";
  owner: `user:${string}`;
  currentness: "current" | "superseded";
  prospective_lifecycle: "none";
}

export interface CommitmentMeaning extends MeaningBase {
  kind: "commitment";
  owner: "ember";
  currentness: "current";
  prospective_lifecycle: "live";
  supersedes: null;
  superseded_by: null;
  epistemic_role: "ember_commitment";
}

export interface EpisodeMetaMeaning extends MeaningBase {
  kind: "episode_meta";
  owner: "ember" | `relationship:${string}`;
  currentness: "current";
  prospective_lifecycle: "none";
  supersedes: null;
  superseded_by: null;
}

export type Meaning = RelationshipMeaning | FactMeaning | PreferenceMeaning | CommitmentMeaning | EpisodeMetaMeaning;

export interface RecoveryAccount {
  previous_runtime: RuntimeId | null;
  current_runtime: RuntimeId;
  gap_kind: "initial_start" | "known_clean_stop_interval" | "uncertain_interruption_boundary";
  last_durable_observation_at: string | null;
  clean_stop_at: string | null;
  restart_at: string;
  ember_cognition_during_interval: "not_applicable" | "none_in_supported_runtime" | "unknown_after_last_durable_observation";
  external_changes_during_interval: "unknown";
}

export interface RuntimeEpisode {
  runtime_id: RuntimeId;
  principal: string;
  active_scope: string;
  started_at: string;
  last_durable_observation_at: string;
  clean_stop_at: string | null;
  stop_reason: string | null;
  recovery_account: RecoveryAccount;
}

export interface CognitionEpisode {
  cognition_id: CognitionId;
  runtime_id: RuntimeId;
  principal: string;
  active_scope: string;
  provider_label: string;
  purpose: CognitionPurpose;
  started_at: string;
  last_durable_observation_at: string;
  status: CognitionStatus;
  selected_meaning_ids: MeaningId[];
  selected_evidence_ids: EvidenceId[];
  used_meaning_ids: MeaningId[];
  input_evidence_id: EvidenceId;
  expression_evidence_id: EvidenceId | null;
  delivery_status: DeliveryStatus;
  external_provider_thread_id?: string | null;
  provider_termination?: {
    reason: "timeout" | "explicit_cancellation" | "output_limit";
    direct_child_exit_observed: boolean;
  } | null;
}

export interface EmberState {
  schema_version: 1;
  revision: number;
  runtime_contract: RuntimeContract;
  lineage: Lineage;
  evidence: Evidence[];
  meanings: Meaning[];
  operations: {
    runtime_episodes: RuntimeEpisode[];
    cognition_episodes: CognitionEpisode[];
  };
}

export const SCHEMA_VERSION = 1;
export const TOPOLOGY = "single-principal-single-writer" as const;
export const CONSTITUTIVE_TEXT = "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.";
const TOP_FIELDS = ["evidence", "lineage", "meanings", "operations", "revision", "runtime_contract", "schema_version"];
const KINDS = new Set(["relationship", "fact", "preference", "commitment", "episode_meta"]);
const ROLES = new Set(["user_command", "ember_adoption", "ember_expression_via_provider", "runtime_observation", "fixture_fault"]);
const CURRENTNESS = new Set(["current", "superseded", "historical"]);

type IdPrefix = "lineage" | "meaning" | "evidence" | "runtime" | "cognition";
export function newId(prefix: "lineage"): LineageId;
export function newId(prefix: "meaning"): MeaningId;
export function newId(prefix: "evidence"): EvidenceId;
export function newId(prefix: "runtime"): RuntimeId;
export function newId(prefix: "cognition"): CognitionId;
export function newId(prefix: IdPrefix): LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId {
  return `${prefix}-${randomUUID()}` as LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId;
}

export function nowUtc(): string {
  const fixed = process.env.EMBER_TEST_NOW;
  if (fixed) {
    requireTimestamp(fixed, "EMBER_TEST_NOW");
    return fixed;
  }
  return new Date().toISOString();
}

export function contentDigest(payload: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

export function cloneState<T>(state: T): T {
  return structuredClone(state);
}

export function initialState(name: string, principal: string, timestamp = nowUtc()): EmberState {
  const state: EmberState = {
    schema_version: 1,
    revision: 0,
    runtime_contract: { local_principal: principal, topology: TOPOLOGY },
    lineage: {
      lineage_id: newId("lineage"),
      display_name: name,
      established_at: timestamp,
      constitutive_boundaries: [{ boundary_id: "minimal-continuity-v1", text: CONSTITUTIVE_TEXT }],
    },
    evidence: [],
    meanings: [],
    operations: { runtime_episodes: [], cognition_episodes: [] },
  };
  validateState(state);
  return state;
}

type Dynamic = Record<string, any>;
const isObject = (value: unknown): value is Dynamic => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const exactKeys = (object: unknown, keys: readonly string[]) => isObject(object) && JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort());
const safeInteger = (value: unknown): value is number => Number.isSafeInteger(value);
const validId = (value: unknown, prefix: string) => nonempty(value) && value.startsWith(prefix);

export function isRfc3339Utc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const millisecond = Number(fraction.slice(0, 3).padEnd(3, "0"));
  const instant = new Date(0);
  instant.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  instant.setUTCHours(parts[3], parts[4], parts[5], millisecond);
  return instant.getUTCFullYear() === parts[0] && instant.getUTCMonth() === parts[1] - 1 && instant.getUTCDate() === parts[2] && instant.getUTCHours() === parts[3] && instant.getUTCMinutes() === parts[4] && instant.getUTCSeconds() === parts[5] && instant.getUTCMilliseconds() === millisecond;
}

const timestamp = isRfc3339Utc;
function requireTimestamp(value: unknown, path: string): asserts value is string {
  if (!timestamp(value)) throw new ValidationError(`${path} must be RFC 3339 UTC`);
}
function sameSlot(a: Dynamic, b: Dynamic) {
  return ["kind", "owner", "slot", "scope"].every(key => a[key] === b[key]);
}

export function validateState(state: unknown): asserts state is EmberState {
  const errors: string[] = [];
  const require = (condition: unknown, message: string) => { if (!condition) errors.push(message); };
  require(isObject(state), "state must be an object");
  if (!isObject(state)) throw new ValidationError("state must be an object");
  require(exactKeys(state, TOP_FIELDS), "top-level fields do not match schema v1");
  require(safeInteger(state.schema_version) && state.schema_version === 1, "unsupported schema_version");
  require(safeInteger(state.revision) && state.revision >= 0, "revision must be non-negative safe integer");

  const contract = isObject(state.runtime_contract) ? state.runtime_contract : {};
  require(isObject(state.runtime_contract), "runtime_contract must be an object");
  require(exactKeys(contract, ["local_principal", "topology"]), "runtime_contract contains unsupported fields");
  const principal = contract.local_principal;
  require(nonempty(principal), "runtime_contract.local_principal must be non-empty");
  require(contract.topology === TOPOLOGY, "unsupported runtime topology");

  const lineage = isObject(state.lineage) ? state.lineage : {};
  require(isObject(state.lineage), "lineage must be an object");
  require(exactKeys(lineage, ["lineage_id", "display_name", "established_at", "constitutive_boundaries"]), "lineage contains unsupported fields");
  require(validId(lineage.lineage_id, "lineage-"), "lineage_id must be stable lineage ID");
  require(nonempty(lineage.display_name), "lineage display_name must be non-empty");
  require(timestamp(lineage.established_at), "lineage.established_at must be RFC 3339 UTC");
  require(Array.isArray(lineage.constitutive_boundaries) && lineage.constitutive_boundaries.length === 1, "exactly one constitutive boundary is required");
  if (Array.isArray(lineage.constitutive_boundaries) && lineage.constitutive_boundaries.length === 1) {
    require(JSON.stringify(lineage.constitutive_boundaries[0]) === JSON.stringify({ boundary_id: "minimal-continuity-v1", text: CONSTITUTIVE_TEXT }), "constitutive boundary must match the approved fixture");
  }

  require(Array.isArray(state.evidence), "evidence must be a list");
  require(Array.isArray(state.meanings), "meanings must be a list");
  const operations = isObject(state.operations) ? state.operations : {};
  require(isObject(state.operations), "operations must be an object");
  require(exactKeys(operations, ["runtime_episodes", "cognition_episodes"]), "operations contains unsupported fields");
  require(Array.isArray(operations.runtime_episodes), "runtime_episodes must be a list");
  require(Array.isArray(operations.cognition_episodes), "cognition_episodes must be a list");

  const evidence: Dynamic[] = Array.isArray(state.evidence) ? state.evidence : [];
  const meanings: Dynamic[] = Array.isArray(state.meanings) ? state.meanings : [];
  const runtimes: Dynamic[] = Array.isArray(operations.runtime_episodes) ? operations.runtime_episodes : [];
  const cognitions: Dynamic[] = Array.isArray(operations.cognition_episodes) ? operations.cognition_episodes : [];
  const allIds: string[] = nonempty(lineage.lineage_id) ? [lineage.lineage_id, "minimal-continuity-v1"] : ["minimal-continuity-v1"];
  const evById = new Map<string, Dynamic>();
  const meaningById = new Map<string, Dynamic>();
  const runtimeById = new Map<string, Dynamic>();
  const cognitionById = new Map<string, Dynamic>();

  const evAllowed = new Set(["evidence_id", "source_role", "source_actor", "asserted_principal", "occurred_at", "observed_at", "derived_from_evidence_ids", "scope", "payload_mode", "availability", "payload", "content_digest", "unavailable_reason", "related_meaning_id", "cognition_id", "provider_label"]);
  evidence.forEach((raw, index) => {
    const path = `evidence[${index}]`;
    const ev = isObject(raw) ? raw : {};
    require(isObject(raw), `${path} must be an object`);
    require(Object.keys(ev).every(k => evAllowed.has(k)), `${path} contains unsupported fields`);
    require(validId(ev.evidence_id, "evidence-"), `${path}.evidence_id is invalid`);
    if (nonempty(ev.evidence_id)) { allIds.push(ev.evidence_id); evById.set(ev.evidence_id, ev); }
    require(ROLES.has(ev.source_role), `${path}.source_role is unsupported`);
    require(nonempty(ev.source_actor), `${path}.source_actor must be non-empty`);
    require(nonempty(ev.scope), `${path}.scope must be non-empty`);
    require(timestamp(ev.occurred_at), `${path}.occurred_at must be RFC 3339 UTC`);
    require(timestamp(ev.observed_at), `${path}.observed_at must be RFC 3339 UTC`);
    if (timestamp(ev.occurred_at) && timestamp(ev.observed_at)) require(Date.parse(ev.occurred_at) <= Date.parse(ev.observed_at), `${path} occurrence must not follow observation`);
    require(Array.isArray(ev.derived_from_evidence_ids) && ev.derived_from_evidence_ids.every(nonempty), `${path}.derived_from_evidence_ids must be IDs`);
    if ("related_meaning_id" in ev) require(nonempty(ev.related_meaning_id), `${path}.related_meaning_id must be an ID`);
    if ("cognition_id" in ev) require(nonempty(ev.cognition_id), `${path}.cognition_id must be an ID`);
    if ("provider_label" in ev) require(nonempty(ev.provider_label), `${path}.provider_label must be non-empty`);
    require(["retained_optional", "descriptor_only"].includes(ev.payload_mode), `${path}.payload_mode is invalid`);
    if (ev.payload_mode === "retained_optional") {
      require(["available", "unavailable"].includes(ev.availability), `${path}.availability is invalid`);
      if (ev.availability === "available") {
        require(typeof ev.payload === "string", `${path}.payload must be retained while available`);
        require(!("unavailable_reason" in ev), `${path}.unavailable_reason is invalid while available`);
        if (typeof ev.payload === "string") require(ev.content_digest === contentDigest(ev.payload), `${path}.content_digest does not match payload`);
      } else {
        require(!("payload" in ev) && !("content_digest" in ev), `${path} leaks unavailable payload or digest`);
        require(nonempty(ev.unavailable_reason), `${path}.unavailable_reason is required`);
      }
    } else if (ev.payload_mode === "descriptor_only") {
      for (const f of ["availability", "payload", "content_digest", "unavailable_reason"]) require(!(f in ev), `${path} descriptor-only evidence contains ${f}`);
    }
    const derived = Array.isArray(ev.derived_from_evidence_ids) ? ev.derived_from_evidence_ids : [];
    if (ev.source_role === "user_command") {
      require(ev.asserted_principal === principal, `${path} principal does not match runtime contract`);
      require(ev.source_actor === `user:${principal}`, `${path} user actor does not match principal`);
      require(derived.length === 0, `${path} user command cannot derive from another occurrence`);
      require(ev.payload_mode === "retained_optional", `${path} user command must use retained-optional payload`);
    } else if ("asserted_principal" in ev) require(ev.asserted_principal === principal, `${path} asserted principal does not match runtime contract`);
    if (ev.source_role === "ember_adoption") {
      require(ev.source_actor === "ember", `${path} adoption must be Ember-owned evidence`);
      require(derived.length === 1, `${path} adoption needs exactly one requesting occurrence`);
      require(ev.payload_mode === "descriptor_only", `${path} adoption must be descriptor-only`);
    }
    if (ev.source_role === "ember_expression_via_provider") {
      require(ev.payload_mode === "descriptor_only", `${path} provider expression must be descriptor-only`);
      require(ev.source_actor === "ember", `${path} provider expression actor must be Ember`);
      require(nonempty(ev.cognition_id), `${path} provider expression needs cognition_id`);
      require(nonempty(ev.provider_label), `${path} provider expression needs provider_label`);
      require(derived.length === 0, `${path} provider expression cannot derive new evidence`);
      require(!("related_meaning_id" in ev), `${path} provider expression cannot attach detail`);
    }
    if (["runtime_observation", "fixture_fault"].includes(ev.source_role)) {
      require(ev.source_actor === "runtime", `${path} runtime evidence actor must be runtime`);
      require(ev.payload_mode === "descriptor_only", `${path} runtime evidence must be descriptor-only`);
    }
    if (ev.source_role === "fixture_fault") {
      require(derived.length === 1, `${path} fixture fault needs exactly one affected occurrence`);
      require(nonempty(ev.related_meaning_id), `${path} fixture fault needs related episode meaning`);
    }
  });

  const slots = new Map<string, string>();
  const meaningFields = ["meaning_id", "kind", "owner", "slot", "scope", "content", "source_evidence_ids", "epistemic_role", "learned_at", "applicable_from", "applicable_until", "currentness", "prospective_lifecycle", "supersedes", "superseded_by", "uncertainty"];
  meanings.forEach((raw, index) => {
    const path = `meanings[${index}]`;
    const m = isObject(raw) ? raw : {};
    require(isObject(raw), `${path} must be an object`);
    require(exactKeys(m, meaningFields), `${path} fields do not match schema v1`);
    require(validId(m.meaning_id, "meaning-"), `${path}.meaning_id is invalid`);
    if (nonempty(m.meaning_id)) { allIds.push(m.meaning_id); meaningById.set(m.meaning_id, m); }
    require(KINDS.has(m.kind), `${path}.kind is unsupported`);
    for (const f of ["owner", "slot", "scope", "content", "epistemic_role"]) require(nonempty(m[f]), `${path}.${f} must be non-empty`);
    require(Array.isArray(m.source_evidence_ids) && m.source_evidence_ids.length > 0 && m.source_evidence_ids.every(nonempty), `${path} needs source evidence`);
    require(timestamp(m.learned_at), `${path}.learned_at must be RFC 3339 UTC`);
    require(timestamp(m.applicable_from), `${path}.applicable_from must be RFC 3339 UTC`);
    if (m.applicable_until !== null) require(timestamp(m.applicable_until), `${path}.applicable_until must be RFC 3339 UTC`);
    require(CURRENTNESS.has(m.currentness), `${path}.currentness is invalid`);
    require("uncertainty" in m, `${path}.uncertainty must be explicit`);
    if (m.kind === "relationship") {
      require(m.owner === `relationship:${principal}`, `${path} relationship owner is invalid`);
      require(m.slot === "relationship", `${path} relationship slot must be fixed`);
      require(m.currentness === "current", `${path} relationship must remain current in v1`);
      require(m.prospective_lifecycle === "none", `${path} relationship lifecycle is unsupported`);
    } else if (["fact", "preference"].includes(m.kind)) {
      require(m.owner === `user:${principal}`, `${path} ${m.kind} owner must be the supported user`);
      require(["current", "superseded"].includes(m.currentness), `${path} ${m.kind} currentness is invalid`);
      require(m.prospective_lifecycle === "none", `${path} ${m.kind} prospective lifecycle is invalid`);
      require(m.applicable_until === null, `${path} ${m.kind} applicability interval cannot be rewritten in v1`);
    } else if (m.kind === "commitment") {
      require(m.owner === "ember", `${path} commitment owner must be Ember`);
      require(m.prospective_lifecycle === "live", `${path} commitment discharge is unsupported without a named transition`);
      require(m.currentness === "current", `${path} live commitment must be current`);
      require(m.applicable_until === null, `${path} live commitment cannot have applicability end`);
    } else if (m.kind === "episode_meta") {
      require(["ember", `relationship:${principal}`].includes(m.owner), `${path} episode owner is invalid`);
      require(m.currentness === "current", `${path} episode meta must be current`);
      require(m.prospective_lifecycle === "none", `${path} episode meta lifecycle is invalid`);
    }
    if (m.currentness === "current") {
      const key = JSON.stringify([m.kind, m.owner, m.slot, m.scope]);
      require(!slots.has(key), `duplicate current meaning for ${key}`);
      slots.set(key, m.meaning_id);
      require(m.superseded_by === null, `${path} current meaning cannot have a successor`);
    }
    if (m.currentness === "superseded") require(nonempty(m.superseded_by), `${path} superseded meaning needs a successor`);
    if (!["fact", "preference"].includes(m.kind)) require(m.supersedes === null && m.superseded_by === null, `${path} kind does not support supersession`);
  });

  const recoveryFields = ["previous_runtime", "current_runtime", "gap_kind", "last_durable_observation_at", "clean_stop_at", "restart_at", "ember_cognition_during_interval", "external_changes_during_interval"];
  const runtimeFields = ["runtime_id", "principal", "active_scope", "started_at", "last_durable_observation_at", "clean_stop_at", "stop_reason", "recovery_account"];
  runtimes.forEach((raw, index) => {
    const p = `runtime_episodes[${index}]`;
    const r = isObject(raw) ? raw : {};
    require(isObject(raw), `${p} must be an object`);
    require(exactKeys(r, runtimeFields), `${p} fields do not match schema v1`);
    require(validId(r.runtime_id, "runtime-"), `${p}.runtime_id is invalid`);
    if (nonempty(r.runtime_id)) { allIds.push(r.runtime_id); runtimeById.set(r.runtime_id, r); }
    require(r.principal === principal, `${p}.principal mismatch`);
    require(nonempty(r.active_scope), `${p}.active_scope must be explicit`);
    require(timestamp(r.started_at), `${p}.started_at must be RFC 3339 UTC`);
    require(timestamp(r.last_durable_observation_at), `${p}.last_durable_observation_at must be RFC 3339 UTC`);
    if (timestamp(r.started_at) && timestamp(r.last_durable_observation_at)) require(Date.parse(r.started_at) <= Date.parse(r.last_durable_observation_at), `${p} durable observation precedes runtime start`);
    if (r.clean_stop_at !== null) {
      require(timestamp(r.clean_stop_at), `${p}.clean_stop_at must be RFC 3339 UTC`);
      if (timestamp(r.last_durable_observation_at) && timestamp(r.clean_stop_at)) require(Date.parse(r.last_durable_observation_at) <= Date.parse(r.clean_stop_at), `${p} clean stop precedes durable observation`);
      require(nonempty(r.stop_reason), `${p}.stop_reason required for clean stop`);
    } else require(r.stop_reason === null, `${p}.stop_reason without clean stop`);
    require(isObject(r.recovery_account), `${p}.recovery_account must be an object`);
    if (isObject(r.recovery_account)) require(exactKeys(r.recovery_account, recoveryFields), `${r.runtime_id} recovery account fields do not match schema v1`);
  });

  const cognitionFields = ["cognition_id", "runtime_id", "principal", "active_scope", "provider_label", "purpose", "started_at", "last_durable_observation_at", "status", "selected_meaning_ids", "selected_evidence_ids", "used_meaning_ids", "input_evidence_id", "expression_evidence_id", "delivery_status"];
  const cognitionFieldsWithOperationalEvidence = [...cognitionFields, "external_provider_thread_id", "provider_termination"];
  cognitions.forEach((raw, index) => {
    const p = `cognition_episodes[${index}]`;
    const c = isObject(raw) ? raw : {};
    require(isObject(raw), `${p} must be an object`);
    require(exactKeys(c, cognitionFields) || exactKeys(c, cognitionFieldsWithOperationalEvidence), `${p} fields do not match schema v1`);
    require(validId(c.cognition_id, "cognition-"), `${p}.cognition_id is invalid`);
    if (nonempty(c.cognition_id)) { allIds.push(c.cognition_id); cognitionById.set(c.cognition_id, c); }
    require(nonempty(c.runtime_id), `${p}.runtime_id must be an ID`);
    require(c.principal === principal, `${p}.principal mismatch`);
    require(nonempty(c.active_scope), `${p}.active_scope must be explicit`);
    require(["ordinary", "explain"].includes(c.purpose), `${p}.purpose is invalid`);
    require(nonempty(c.provider_label), `${p}.provider_label is required`);
    require(timestamp(c.started_at), `${p}.started_at must be RFC 3339 UTC`);
    require(timestamp(c.last_durable_observation_at), `${p}.last_durable_observation_at must be RFC 3339 UTC`);
    require(["started", "completed", "failed", "timed_out", "cancellation_requested", "outcome_unknown"].includes(c.status), `${p}.status is invalid`);
    if ("external_provider_thread_id" in c && c.external_provider_thread_id !== null) require(typeof c.external_provider_thread_id === "string" && c.external_provider_thread_id.length > 0 && c.external_provider_thread_id.length <= 512 && !/[\u0000-\u001f\u007f]/.test(c.external_provider_thread_id), `${p}.external_provider_thread_id is invalid`);
    if ("provider_termination" in c && c.provider_termination !== null) {
      require(isObject(c.provider_termination) && exactKeys(c.provider_termination, ["reason", "direct_child_exit_observed"]), `${p}.provider_termination is invalid`);
      if (isObject(c.provider_termination)) {
        require(["timeout", "explicit_cancellation", "output_limit"].includes(c.provider_termination.reason), `${p}.provider_termination.reason is invalid`);
        require(typeof c.provider_termination.direct_child_exit_observed === "boolean", `${p}.provider_termination.direct_child_exit_observed is invalid`);
      }
    }
    for (const f of ["selected_meaning_ids", "selected_evidence_ids", "used_meaning_ids"]) require(Array.isArray(c[f]) && c[f].every(nonempty), `${p}.${f} must be an ID list`);
    require(nonempty(c.input_evidence_id), `${p}.input_evidence_id is required`);
    require(["not_attempted", "pending", "displayed"].includes(c.delivery_status), `${p}.delivery_status is invalid`);
    if (c.status === "completed") {
      require(nonempty(c.expression_evidence_id), `${p} completed cognition needs expression evidence`);
      require(["pending", "displayed"].includes(c.delivery_status), `${p} completed cognition needs delivery state`);
    } else {
      require(c.expression_evidence_id === null, `${p} incomplete cognition cannot claim expression`);
      require(c.delivery_status === "not_attempted", `${p} incomplete cognition cannot claim delivery`);
      require(Array.isArray(c.used_meaning_ids) && c.used_meaning_ids.length === 0, `${p} incomplete cognition cannot claim used meanings`);
    }
  });

  if (errors.length) throw new ValidationError([...new Set(errors)].join("; "));
  require(allIds.length === new Set(allIds).size, "all canonical IDs must be unique");

  for (const [id, ev] of evById) {
    for (const parent of ev.derived_from_evidence_ids) require(evById.has(parent), `${id} derives from absent evidence ${parent}`);
    if (ev.related_meaning_id !== undefined) require(meaningById.has(ev.related_meaning_id), `${id} relates to absent meaning ${ev.related_meaning_id}`);
    if (ev.cognition_id !== undefined) require(cognitionById.has(ev.cognition_id), `${id} refers to absent cognition ${ev.cognition_id}`);
    if (ev.payload_mode === "retained_optional" && ev.availability === "unavailable") {
      const related = meaningById.get(ev.related_meaning_id);
      const cited = meanings.some(m => m.source_evidence_ids.includes(id));
      const faults = evidence.filter(f => f.source_role === "fixture_fault" && JSON.stringify(f.derived_from_evidence_ids) === JSON.stringify([id]) && f.related_meaning_id === ev.related_meaning_id);
      require(ev.source_role === "user_command", `${id} unavailable evidence must be attached user detail`);
      require(related?.kind === "episode_meta", `${id} unavailable evidence must relate to episode_meta`);
      if (related) require(ev.scope === related.scope, `${id} unavailable detail scope mismatch`);
      require(!cited, `${id} governing evidence cannot degrade locally`);
      require(faults.length === 1, `${id} unavailable detail needs exactly one fixture-fault occurrence`);
    }
  }

  for (const [id, m] of meaningById) {
    for (const ref of m.source_evidence_ids) require(evById.has(ref), `${id} cites absent evidence ${ref}`);
    if (m.supersedes !== null) {
      const prior = meaningById.get(m.supersedes);
      require(!!prior, `${id} supersedes absent meaning`);
      if (prior) {
        require(prior.superseded_by === id, `${id} predecessor link is not reciprocal`);
        require(sameSlot(m, prior), `${id} crosses kind, owner, slot, or scope`);
        require(prior.currentness === "superseded", `${id} predecessor is not superseded`);
      }
    }
    if (m.superseded_by !== null) {
      const later = meaningById.get(m.superseded_by);
      require(!!later, `${id} successor is absent`);
      if (later) {
        require(later.supersedes === id, `${id} successor link is not reciprocal`);
        require(sameSlot(m, later), `${id} successor crosses semantic slot`);
      }
    }
    const refs = m.source_evidence_ids.map((ref: string) => evById.get(ref));
    if (m.kind === "commitment") {
      const adoptions = refs.filter((ev: Dynamic | undefined) => ev?.source_role === "ember_adoption");
      require(adoptions.length >= 1, `${id} commitment needs Ember adoption evidence`);
      for (const a of adoptions) require(a!.derived_from_evidence_ids.length === 1 && evById.get(a!.derived_from_evidence_ids[0])?.source_role === "user_command", `${id} adoption must derive from user request`);
      require(m.epistemic_role === "ember_commitment", `${id} commitment epistemic role is invalid`);
    } else {
      require(m.epistemic_role === "user_testimony", `${id} epistemic role is invalid for supported promotion path`);
      require(refs.every((ev: Dynamic | undefined) => ev?.source_role === "user_command"), `${id} supported remembered meaning must cite user-command evidence`);
    }
  }

  for (const id of meaningById.keys()) {
    const seen = new Set<string>();
    let cursor: string | null = id;
    while (cursor !== null) {
      require(!seen.has(cursor), `supersession cycle contains ${cursor}`);
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = meaningById.get(cursor)?.supersedes ?? null;
    }
  }

  for (const [id, c] of cognitionById) {
    for (const mid of c.selected_meaning_ids) require(meaningById.has(mid), `${id} selected absent meaning ${mid}`);
    require(c.used_meaning_ids.every((mid: string) => c.selected_meaning_ids.includes(mid)), `${id} used a meaning outside its selection`);
    for (const eid of c.selected_evidence_ids) require(evById.has(eid), `${id} selected absent evidence ${eid}`);
    require(evById.get(c.input_evidence_id)?.source_role === "user_command", `${id} input evidence has wrong role`);
    require(evById.get(c.input_evidence_id)?.scope === c.active_scope, `${id} input evidence scope mismatch`);
    const runtime = runtimeById.get(c.runtime_id);
    require(!!runtime, `${id} owning runtime is absent`);
    if (runtime) require(c.active_scope === runtime.active_scope, `${id} scope differs from owning runtime`);
    if (c.expression_evidence_id) {
      const expression = evById.get(c.expression_evidence_id);
      require(expression?.source_role === "ember_expression_via_provider", `${id} expression evidence has wrong role`);
      require(expression?.cognition_id === id, `${id} expression back-reference mismatch`);
      require(expression?.scope === c.active_scope, `${id} expression scope mismatch`);
      require(expression?.provider_label === c.provider_label, `${id} provider label mismatch`);
    }
  }

  const expressionRefs = cognitions.map(c => c.expression_evidence_id).filter(Boolean);
  for (const [id, ev] of evById) if (ev.source_role === "ember_expression_via_provider") require(expressionRefs.filter(x => x === id).length === 1, `${id} provider expression must belong to exactly one completed cognition`);
  validateRuntimeChain(runtimes, runtimeById, require);
  if (errors.length) throw new ValidationError([...new Set(errors)].join("; "));
}

function validateRuntimeChain(runtimes: Dynamic[], byId: Map<string, Dynamic>, require: (condition: unknown, message: string) => void) {
  if (!runtimes.length) return;
  let roots = 0;
  const successors = new Map([...byId.keys()].map(k => [k, [] as string[]]));
  for (const r of runtimes) {
    const a = r.recovery_account;
    if (!isObject(a)) continue;
    require(a.current_runtime === r.runtime_id, `${r.runtime_id} recovery current_runtime mismatch`);
    require(a.restart_at === r.started_at, `${r.runtime_id} recovery restart_at mismatch`);
    require(a.external_changes_during_interval === "unknown", `${r.runtime_id} recovery must keep external changes unknown`);
    let expected: [string, string | null, string | null, string];
    if (a.previous_runtime === null) {
      roots++;
      expected = ["initial_start", null, null, "not_applicable"];
    } else {
      const p = byId.get(a.previous_runtime);
      require(!!p, `${r.runtime_id} recovery refers to absent previous runtime`);
      if (!p) continue;
      successors.get(p.runtime_id)!.push(r.runtime_id);
      expected = p.clean_stop_at === null
        ? ["uncertain_interruption_boundary", p.last_durable_observation_at, null, "unknown_after_last_durable_observation"]
        : ["known_clean_stop_interval", p.last_durable_observation_at, p.clean_stop_at, "none_in_supported_runtime"];
      if (timestamp(p.last_durable_observation_at) && timestamp(r.started_at)) require(Date.parse(p.last_durable_observation_at) <= Date.parse(r.started_at), `${r.runtime_id} restart precedes prior durable boundary`);
      if (p.clean_stop_at && timestamp(r.started_at)) require(Date.parse(p.clean_stop_at) <= Date.parse(r.started_at), `${r.runtime_id} restart precedes prior clean stop`);
    }
    require(JSON.stringify([a.gap_kind, a.last_durable_observation_at, a.clean_stop_at, a.ember_cognition_during_interval]) === JSON.stringify(expected), `${r.runtime_id} recovery account overstates or contradicts surviving lifecycle evidence`);
  }
  require(roots === 1, "runtime recovery chain must contain exactly one initial start");
  require([...successors.values()].every(items => items.length <= 1), "runtime recovery chain cannot fork in supported topology");
  for (const id of byId.keys()) {
    const seen = new Set<string>();
    let cursor: string | null = id;
    while (cursor !== null) {
      require(!seen.has(cursor), `runtime recovery chain contains cycle at ${cursor}`);
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = byId.get(cursor)?.recovery_account?.previous_runtime ?? null;
    }
  }
}
