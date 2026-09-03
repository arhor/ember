import { ValidationError } from "./errors.ts";
import {
  contentDigest,
  newId,
  nowUtc,
  validateState,
  type AvailableUserEvidence,
  type CommitmentLifecycle,
  type DelegatedReportEvidence,
  type EmberAdoptionEvidence,
  type EmberInferenceEvidence,
  type EmberObservationEvidence,
  type EmberState,
  type Evidence,
  type EvidenceId,
  type ExternalClaimEvidence,
  type FactMeaning,
  type Meaning,
  type MeaningId,
  type PreferenceMeaning,
  type UnavailableUserDetailEvidence,
} from "./model.ts";

export function userEvidence(
  state: EmberState,
  principal: string,
  scope: string,
  payload: string,
  { timestamp = nowUtc() }: { timestamp?: string } = {},
): AvailableUserEvidence {
  requirePrincipal(state, principal);
  const evidence: AvailableUserEvidence = {
    evidence_id: newId("evidence"),
    source_role: "user_command",
    source_actor: `user:${principal}`,
    asserted_principal: principal,
    occurred_at: timestamp,
    observed_at: timestamp,
    derived_from_evidence_ids: [],
    scope,
    payload_mode: "retained_optional",
    availability: "available",
    payload,
    content_digest: contentDigest(payload),
  };
  state.evidence.push(evidence);
  return evidence;
}

interface MeaningCommon {
  meaning_id: MeaningId;
  slot: string;
  scope: string;
  content: string;
  source_evidence_ids: EvidenceId[];
  learned_at: string;
  applicable_from: string;
  applicable_until: null;
  currentness: "current";
  supersedes: null;
  superseded_by: null;
  uncertainty: null;
}

function meaningCommon(
  slot: string,
  scope: string,
  content: string,
  sourceEvidenceId: EvidenceId,
): MeaningCommon {
  if (![slot, scope, content].every(value => typeof value === "string" && value.trim())) {
    throw new ValidationError("owner, slot, scope, and content must be non-empty");
  }
  const at = nowUtc();
  return {
    meaning_id: newId("meaning"),
    slot,
    scope,
    content,
    source_evidence_ids: [sourceEvidenceId],
    learned_at: at,
    applicable_from: at,
    applicable_until: null,
    currentness: "current",
    supersedes: null,
    superseded_by: null,
    uncertainty: null,
  };
}

function ensureNoCurrent(state: EmberState, kind: Meaning["kind"], owner: string, slot: string, scope: string) {
  if (![owner, slot, scope].every(value => typeof value === "string" && value.trim())) {
    throw new ValidationError("owner, slot, and scope must be non-empty");
  }
  if (state.meanings.some(m => m.kind === kind && m.owner === owner && m.slot === slot && m.scope === scope && m.currentness === "current")) {
    throw new ValidationError("a current meaning already occupies this exact semantic slot");
  }
}

function attributedOwner(prefix: "external" | "delegate", label: string): `external:${string}` | `delegate:${string}` {
  if (typeof label !== "string" || !label.trim()) throw new ValidationError(`${prefix} source label must be non-empty`);
  return `${prefix}:${label.trim()}` as `external:${string}` | `delegate:${string}`;
}

function resolveEvidenceIds(state: EmberState, ids: Array<EvidenceId | string>, scope: string): EvidenceId[] {
  const resolved = ids.map(id => findEvidence(state, id));
  for (const evidence of resolved) {
    if (evidence.scope !== scope) throw new ValidationError("evidence derivation cannot cross scope");
  }
  return [...new Set(resolved.map(evidence => evidence.evidence_id))];
}

function rememberAttributedFact(
  state: EmberState,
  principal: string,
  owner: FactMeaning["owner"],
  slot: string,
  scope: string,
  text: string,
  epistemicRole: FactMeaning["epistemic_role"],
  evidence: Evidence,
): MeaningId {
  requirePrincipal(state, principal);
  ensureNoCurrent(state, "fact", owner, slot, scope);
  const common = meaningCommon(slot, scope, text, evidence.evidence_id);
  const meaning: FactMeaning = {
    ...common,
    kind: "fact",
    owner,
    epistemic_role: epistemicRole,
    prospective_lifecycle: "none",
  };
  state.evidence.push(evidence);
  state.meanings.push(meaning);
  validateState(state);
  return meaning.meaning_id;
}

export function rememberExternalClaim(state: EmberState, principal: string, source: string, slot: string, scope: string, text: string): MeaningId {
  const owner = attributedOwner("external", source) as `external:${string}`;
  const at = nowUtc();
  const evidence: ExternalClaimEvidence = {
    evidence_id: newId("evidence"),
    source_role: "external_claim",
    source_actor: owner,
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: [],
    scope,
    payload_mode: "descriptor_only",
  };
  return rememberAttributedFact(state, principal, owner, slot, scope, text, "external_claim", evidence);
}

export function rememberDirectObservation(state: EmberState, principal: string, slot: string, scope: string, text: string): MeaningId {
  const at = nowUtc();
  const evidence: EmberObservationEvidence = {
    evidence_id: newId("evidence"),
    source_role: "ember_observation",
    source_actor: "ember",
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: [],
    scope,
    payload_mode: "descriptor_only",
  };
  return rememberAttributedFact(state, principal, "ember", slot, scope, text, "direct_observation", evidence);
}

export function rememberDelegatedReport(
  state: EmberState,
  principal: string,
  delegate: string,
  slot: string,
  scope: string,
  text: string,
  derivedFrom: Array<EvidenceId | string> = [],
): MeaningId {
  const owner = attributedOwner("delegate", delegate) as `delegate:${string}`;
  const at = nowUtc();
  const evidence: DelegatedReportEvidence = {
    evidence_id: newId("evidence"),
    source_role: "delegated_report",
    source_actor: owner,
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: resolveEvidenceIds(state, derivedFrom, scope),
    scope,
    payload_mode: "descriptor_only",
  };
  return rememberAttributedFact(state, principal, owner, slot, scope, text, "delegated_report", evidence);
}

export function rememberInference(
  state: EmberState,
  principal: string,
  slot: string,
  scope: string,
  text: string,
  derivedFrom: Array<EvidenceId | string>,
): MeaningId {
  const derived = resolveEvidenceIds(state, derivedFrom, scope);
  if (derived.length === 0) throw new ValidationError("Ember inference requires at least one source evidence occurrence");
  const at = nowUtc();
  const evidence: EmberInferenceEvidence = {
    evidence_id: newId("evidence"),
    source_role: "ember_inference",
    source_actor: "ember",
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: derived as [EvidenceId, ...EvidenceId[]],
    scope,
    payload_mode: "descriptor_only",
  };
  return rememberAttributedFact(state, principal, "ember", slot, scope, text, "ember_inference", evidence);
}

export function rememberRelationship(state: EmberState, principal: string, owner: string, scope: string, text: string): MeaningId {
  if (owner !== `relationship:${principal}`) throw new ValidationError("relationship owner must match relationship:<principal>");
  ensureNoCurrent(state, "relationship", owner, "relationship", scope);
  const ev = userEvidence(state, principal, scope, text);
  const m: Meaning = {
    ...meaningCommon("relationship", scope, text, ev.evidence_id),
    kind: "relationship",
    owner: `relationship:${principal}`,
    epistemic_role: "user_testimony",
    prospective_lifecycle: "none",
  };
  state.meanings.push(m);
  validateState(state);
  return m.meaning_id;
}

export function rememberFact(state: EmberState, principal: string, owner: string, slot: string, scope: string, text: string): MeaningId {
  requireUserOwner(principal, owner);
  ensureNoCurrent(state, "fact", owner, slot, scope);
  const ev = userEvidence(state, principal, scope, text);
  const m: FactMeaning = {
    ...meaningCommon(slot, scope, text, ev.evidence_id),
    kind: "fact",
    owner: `user:${principal}`,
    epistemic_role: "user_testimony",
    prospective_lifecycle: "none",
  };
  state.meanings.push(m);
  validateState(state);
  return m.meaning_id;
}

export function rememberPreference(state: EmberState, principal: string, owner: string, slot: string, scope: string, text: string): MeaningId {
  requireUserOwner(principal, owner);
  ensureNoCurrent(state, "preference", owner, slot, scope);
  const ev = userEvidence(state, principal, scope, text);
  const m: PreferenceMeaning = {
    ...meaningCommon(slot, scope, text, ev.evidence_id),
    kind: "preference",
    owner: `user:${principal}`,
    epistemic_role: "user_testimony",
    prospective_lifecycle: "none",
  };
  state.meanings.push(m);
  validateState(state);
  return m.meaning_id;
}

export function rememberEpisode(state: EmberState, principal: string, slot: string, owner: string, scope: string, summary: string): MeaningId {
  if (!["ember", `relationship:${principal}`].includes(owner)) throw new ValidationError("episode owner must be ember or relationship:<principal>");
  ensureNoCurrent(state, "episode_meta", owner, slot, scope);
  const ev = userEvidence(state, principal, scope, summary);
  const m: Meaning = {
    ...meaningCommon(slot, scope, summary, ev.evidence_id),
    kind: "episode_meta",
    owner: owner as "ember" | `relationship:${string}`,
    epistemic_role: "user_testimony",
    prospective_lifecycle: "none",
  };
  state.meanings.push(m);
  validateState(state);
  return m.meaning_id;
}

export function undertake(state: EmberState, principal: string, slot: string, scope: string, text: string): MeaningId {
  ensureNoCurrent(state, "commitment", "ember", slot, scope);
  const request = userEvidence(state, principal, scope, text);
  const at = nowUtc();
  const adoption: EmberAdoptionEvidence = {
    evidence_id: newId("evidence"),
    source_role: "ember_adoption",
    source_actor: "ember",
    asserted_principal: principal,
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: [request.evidence_id],
    scope,
    payload_mode: "descriptor_only",
  };
  state.evidence.push(adoption);
  const m: Meaning = {
    ...meaningCommon(slot, scope, text, adoption.evidence_id),
    kind: "commitment",
    owner: "ember",
    epistemic_role: "ember_commitment",
    prospective_lifecycle: "live",
  };
  state.meanings.push(m);
  validateState(state);
  return m.meaning_id;
}

export function transitionCommitment(
  state: EmberState,
  principal: string,
  commitmentId: MeaningId | string,
  outcome: Exclude<CommitmentLifecycle, "live">,
  evidenceText: string,
  { timestamp = nowUtc() }: { timestamp?: string } = {},
): EvidenceId {
  requirePrincipal(state, principal);
  if (!(outcome === "fulfilled" || outcome === "cancelled")) throw new ValidationError("commitment transition must be fulfilled or cancelled");
  if (typeof evidenceText !== "string" || !evidenceText.trim()) throw new ValidationError("commitment transition evidence must be non-empty");
  const commitment = findMeaning(state, commitmentId);
  if (commitment.kind !== "commitment") throw new ValidationError("only a commitment can receive a commitment transition");
  if (commitment.currentness !== "current" || commitment.prospective_lifecycle !== "live") throw new ValidationError("only a live current commitment can be discharged");
  const evidence = userEvidence(state, principal, commitment.scope, evidenceText, { timestamp });
  commitment.source_evidence_ids.push(evidence.evidence_id);
  commitment.currentness = "historical";
  commitment.prospective_lifecycle = outcome;
  commitment.applicable_until = timestamp;
  validateState(state);
  return evidence.evidence_id;
}

export function supersede(
  state: EmberState,
  principal: string,
  meaningId: MeaningId | string,
  text: string,
  { reason = null }: { reason?: string | null } = {},
): MeaningId {
  const old = findMeaning(state, meaningId);
  if (old.kind !== "fact" && old.kind !== "preference") throw new ValidationError("only fact and preference correction/supersession is supported");
  if (old.currentness !== "current" || old.superseded_by !== null) throw new ValidationError("only a current, unsuperseded meaning can be superseded");
  if (old.epistemic_role !== "user_testimony") throw new ValidationError("only user-testimony fact or preference supersession is supported in v1");
  requireUserOwner(principal, old.owner);
  const payload = reason === null ? text : `Correction: ${text}\nReason: ${reason}`;
  const ev = userEvidence(state, principal, old.scope, payload);
  const common = meaningCommon(old.slot, old.scope, text, ev.evidence_id);
  const next: FactMeaning | PreferenceMeaning = old.kind === "fact"
    ? { ...common, kind: "fact", owner: old.owner, epistemic_role: "user_testimony", prospective_lifecycle: "none", supersedes: old.meaning_id }
    : { ...common, kind: "preference", owner: old.owner, epistemic_role: "user_testimony", prospective_lifecycle: "none", supersedes: old.meaning_id };
  old.currentness = "superseded";
  old.superseded_by = next.meaning_id;
  state.meanings.push(next);
  validateState(state);
  return next.meaning_id;
}

export function attachDetail(state: EmberState, principal: string, episodeId: MeaningId | string, detail: string): EvidenceId {
  if (typeof detail !== "string" || !detail.trim()) throw new ValidationError("optional detail must be non-empty");
  const episode = findMeaning(state, episodeId);
  if (episode.kind !== "episode_meta") throw new ValidationError("optional detail can be attached only to episode_meta");
  if (state.evidence.some(e => e.related_meaning_id === episode.meaning_id)) throw new ValidationError("episode already has optional detail evidence");
  const ev = userEvidence(state, principal, episode.scope, detail);
  ev.related_meaning_id = episode.meaning_id;
  validateState(state);
  return ev.evidence_id;
}

export function withholdDetail(
  state: EmberState,
  principal: string,
  evidenceId: EvidenceId | string,
  { reason = "fixture detail payload unavailable" }: { reason?: string } = {},
): EvidenceId {
  requirePrincipal(state, principal);
  const index = state.evidence.findIndex(e => e.evidence_id === evidenceId);
  if (index < 0) throw new ValidationError(`evidence does not exist: ${evidenceId}`);
  const ev = state.evidence[index];
  if (ev.related_meaning_id === undefined) throw new ValidationError("fixture fault can withhold only attached episode detail");
  if (ev.payload_mode !== "retained_optional" || ev.availability !== "available") throw new ValidationError("detail evidence is not currently available");
  if (reason.toLowerCase().includes("delet")) throw new ValidationError("privacy deletion semantics are unsupported by fixture fault");
  if (!reason.trim() || reason.includes(ev.payload)) throw new ValidationError("unavailability reason must not reveal detail");

  const { payload: _payload, content_digest: _contentDigest, availability: _availability, ...retained } = ev;
  const unavailable: UnavailableUserDetailEvidence = {
    ...retained,
    availability: "unavailable",
    related_meaning_id: ev.related_meaning_id,
    unavailable_reason: reason,
  };
  state.evidence[index] = unavailable;
  const at = nowUtc();
  const fault: Evidence = {
    evidence_id: newId("evidence"),
    source_role: "fixture_fault",
    source_actor: "runtime",
    asserted_principal: principal,
    occurred_at: at,
    observed_at: at,
    derived_from_evidence_ids: [ev.evidence_id],
    scope: ev.scope,
    payload_mode: "descriptor_only",
    related_meaning_id: ev.related_meaning_id,
  };
  state.evidence.push(fault);
  validateState(state);
  return fault.evidence_id;
}

export function findMeaning(state: EmberState, id: MeaningId | string): Meaning {
  const value = state.meanings.find(m => m.meaning_id === id);
  if (!value) throw new ValidationError(`meaning does not exist: ${id}`);
  return value;
}

export function findEvidence(state: EmberState, id: EvidenceId | string): Evidence {
  const value = state.evidence.find(e => e.evidence_id === id);
  if (!value) throw new ValidationError(`evidence does not exist: ${id}`);
  return value;
}

export function requirePrincipal(state: EmberState, principal: string) {
  if (principal !== state.runtime_contract.local_principal) throw new ValidationError("asserted principal does not match initialized local principal");
}

function requireUserOwner(principal: string, owner: string): asserts owner is `user:${string}` {
  if (owner !== `user:${principal}`) throw new ValidationError("fact or preference owner must match user:<principal>");
}