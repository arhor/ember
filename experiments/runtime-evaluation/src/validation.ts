import { evidenceId, lineageId, meaningId, type Meaning, type PersistentState } from "./model.ts";

const KINDS = new Set(["relationship", "fact", "preference", "commitment", "episode_meta"]);
const CURRENTNESS = new Set(["current", "superseded", "historical"]);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function parsePersistentState(text: string): PersistentState {
  const value: unknown = JSON.parse(text);
  if (!record(value)) throw new Error("state must be an object");
  if (value.schema_version !== 1) throw new Error("unsupported schema_version");
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw new Error("revision must be a non-negative safe integer");

  const contract = value.runtime_contract;
  if (!record(contract) || !nonempty(contract.local_principal) || contract.topology !== "single-principal-single-writer") {
    throw new Error("runtime_contract is invalid");
  }
  const lineage = value.lineage;
  if (!record(lineage) || !nonempty(lineage.lineage_id) || !nonempty(lineage.display_name) || !nonempty(lineage.established_at) || !Array.isArray(lineage.constitutive_boundaries)) {
    throw new Error("lineage is invalid");
  }
  lineageId(lineage.lineage_id);

  if (!Array.isArray(value.evidence) || !Array.isArray(value.meanings)) throw new Error("state collections are invalid");
  const meanings = value.meanings.map(validateMeaning);
  const operations = value.operations;
  if (!record(operations) || !Array.isArray(operations.runtime_episodes) || !Array.isArray(operations.cognition_episodes)) {
    throw new Error("operations are invalid");
  }

  return {
    schema_version: 1,
    revision: Number(value.revision),
    runtime_contract: { local_principal: contract.local_principal, topology: "single-principal-single-writer" },
    lineage: {
      lineage_id: lineageId(lineage.lineage_id),
      display_name: lineage.display_name,
      established_at: lineage.established_at,
      constitutive_boundaries: lineage.constitutive_boundaries.map((boundary) => {
        if (!record(boundary) || boundary.boundary_id !== "minimal-continuity-v1" || !nonempty(boundary.text)) throw new Error("constitutive boundary is invalid");
        return { boundary_id: "minimal-continuity-v1" as const, text: boundary.text };
      }),
    },
    evidence: value.evidence,
    meanings,
    operations: { runtime_episodes: operations.runtime_episodes, cognition_episodes: operations.cognition_episodes },
  };
}

function validateMeaning(value: unknown): Meaning {
  if (!record(value) || !nonempty(value.meaning_id) || !nonempty(value.kind) || !KINDS.has(value.kind)) throw new Error("meaning identity or kind is invalid");
  if (!nonempty(value.owner) || !nonempty(value.slot) || !nonempty(value.scope) || !nonempty(value.content)) throw new Error("meaning routing fields are invalid");
  if (!Array.isArray(value.source_evidence_ids) || !value.source_evidence_ids.every(nonempty)) throw new Error("meaning source evidence is invalid");
  if (!nonempty(value.epistemic_role) || !nonempty(value.learned_at) || !nonempty(value.applicable_from)) throw new Error("meaning temporal fields are invalid");
  if (value.applicable_until !== null && !nonempty(value.applicable_until)) throw new Error("meaning applicable_until is invalid");
  if (!nonempty(value.currentness) || !CURRENTNESS.has(value.currentness)) throw new Error("meaning currentness is invalid");
  if (!("uncertainty" in value) || (value.uncertainty !== null && typeof value.uncertainty !== "string")) throw new Error("meaning uncertainty is invalid");
  if (!nonempty(value.prospective_lifecycle)) throw new Error("meaning prospective lifecycle is invalid");
  const supersedes = optionalMeaningId(value.supersedes);
  const supersededBy = optionalMeaningId(value.superseded_by);
  const common = {
    meaning_id: meaningId(value.meaning_id), owner: value.owner, slot: value.slot, scope: value.scope, content: value.content,
    source_evidence_ids: value.source_evidence_ids.map(evidenceId), epistemic_role: value.epistemic_role,
    learned_at: value.learned_at, applicable_from: value.applicable_from, applicable_until: value.applicable_until,
    currentness: value.currentness as Meaning["currentness"], uncertainty: value.uncertainty,
  };
  switch (value.kind) {
    case "relationship":
      if (!value.owner.startsWith("relationship:") || value.prospective_lifecycle !== "none" || supersedes || supersededBy) throw new Error("relationship meaning is invalid");
      return { ...common, kind: "relationship", owner: value.owner as `relationship:${string}`, prospective_lifecycle: "none", supersedes: null, superseded_by: null };
    case "fact":
    case "preference":
      if (!value.owner.startsWith("user:") || value.prospective_lifecycle !== "none") throw new Error(`${value.kind} meaning is invalid`);
      return { ...common, kind: value.kind, owner: value.owner as `user:${string}`, prospective_lifecycle: "none", supersedes, superseded_by: supersededBy };
    case "commitment":
      if (value.owner !== "ember" || value.prospective_lifecycle !== "live" || supersedes || supersededBy) throw new Error("commitment meaning is invalid");
      return { ...common, kind: "commitment", owner: "ember", prospective_lifecycle: "live", supersedes: null, superseded_by: null };
    case "episode_meta":
      if (value.prospective_lifecycle !== "none" || supersedes || supersededBy) throw new Error("episode meaning is invalid");
      return { ...common, kind: "episode_meta", prospective_lifecycle: "none", supersedes: null, superseded_by: null };
    default: throw new Error("unsupported meaning kind");
  }
}

function optionalMeaningId(value: unknown) {
  if (value === null) return null;
  if (!nonempty(value)) throw new Error("supersession link is invalid");
  return meaningId(value);
}
