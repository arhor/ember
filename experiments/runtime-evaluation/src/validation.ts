import { createHash } from "node:crypto";
import {
  evidenceId,
  lineageId,
  meaningId,
  type EmberAdoptionEvidence,
  type Evidence,
  type Meaning,
  type PersistentState,
  type UserEvidence,
} from "./model.ts";

const KINDS = new Set(["relationship", "fact", "preference", "commitment", "episode_meta"]);
const CURRENTNESS = new Set(["current", "superseded", "historical"]);

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function parsePersistentState(text: string): PersistentState {
  const value: unknown = JSON.parse(text);
  if (!record(value)) throw new Error("state must be an object");
  if (value.schema_version !== 1) throw new Error("unsupported schema_version");
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) {
    throw new Error("revision must be a non-negative safe integer");
  }

  const contract = value.runtime_contract;
  if (
    !record(contract) || !nonempty(contract.local_principal) ||
    contract.topology !== "single-principal-single-writer"
  ) {
    throw new Error("runtime_contract is invalid");
  }
  const lineage = value.lineage;
  if (
    !record(lineage) || !nonempty(lineage.lineage_id) || !nonempty(lineage.display_name) ||
    !nonempty(lineage.established_at) || !Array.isArray(lineage.constitutive_boundaries)
  ) {
    throw new Error("lineage is invalid");
  }
  lineageId(lineage.lineage_id);

  if (!Array.isArray(value.evidence) || !Array.isArray(value.meanings)) {
    throw new Error("state collections are invalid");
  }
  const evidence = value.evidence.map(validateEvidence);
  const evidenceIds = new Set(evidence.map((item) => item.evidence_id));
  if (evidenceIds.size !== evidence.length) throw new Error("evidence IDs must be unique");
  for (const item of evidence) {
    if (
      item.source_role === "ember_adoption" &&
      !item.derived_from_evidence_ids.every((id) => evidenceIds.has(id))
    ) {
      throw new Error("adoption source evidence does not exist");
    }
  }

  const meanings = value.meanings.map(validateMeaning);
  for (const meaning of meanings) {
    if (!meaning.source_evidence_ids.every((id) => evidenceIds.has(id))) {
      throw new Error("meaning source evidence does not exist");
    }
  }
  const operations = value.operations;
  if (
    !record(operations) || !Array.isArray(operations.runtime_episodes) ||
    !Array.isArray(operations.cognition_episodes)
  ) {
    throw new Error("operations are invalid");
  }

  return {
    schema_version: 1,
    revision: Number(value.revision),
    runtime_contract: {
      local_principal: contract.local_principal,
      topology: "single-principal-single-writer",
    },
    lineage: {
      lineage_id: lineageId(lineage.lineage_id),
      display_name: lineage.display_name,
      established_at: lineage.established_at,
      constitutive_boundaries: lineage.constitutive_boundaries.map((boundary) => {
        if (
          !record(boundary) || boundary.boundary_id !== "minimal-continuity-v1" ||
          !nonempty(boundary.text)
        ) {
          throw new Error("constitutive boundary is invalid");
        }
        return { boundary_id: "minimal-continuity-v1" as const, text: boundary.text };
      }),
    },
    evidence,
    meanings,
    operations: {
      runtime_episodes: operations.runtime_episodes,
      cognition_episodes: operations.cognition_episodes,
    },
  };
}

function validateEvidence(value: unknown): Evidence {
  if (!record(value) || !nonempty(value.evidence_id) || !nonempty(value.source_role)) {
    throw new Error("evidence identity or role is invalid");
  }
  const id = evidenceId(value.evidence_id);
  if (
    !nonempty(value.source_actor) || !nonempty(value.asserted_principal) ||
    !nonempty(value.occurred_at) || !nonempty(value.observed_at) || !nonempty(value.scope) ||
    !Array.isArray(value.derived_from_evidence_ids) ||
    !value.derived_from_evidence_ids.every(nonempty)
  ) {
    throw new Error("evidence provenance fields are invalid");
  }

  if (value.source_role === "user_command") {
    if (
      value.source_actor !== `user:${value.asserted_principal}` ||
      value.derived_from_evidence_ids.length !== 0 || value.payload_mode !== "retained_optional" ||
      value.availability !== "available" || typeof value.payload !== "string" ||
      !nonempty(value.content_digest) || value.content_digest !== digest(value.payload)
    ) {
      throw new Error("user evidence is invalid");
    }
    const result: UserEvidence = {
      evidence_id: id,
      source_role: "user_command",
      source_actor: value.source_actor as `user:${string}`,
      asserted_principal: value.asserted_principal,
      occurred_at: value.occurred_at,
      observed_at: value.observed_at,
      derived_from_evidence_ids: [],
      scope: value.scope,
      payload_mode: "retained_optional",
      availability: "available",
      payload: value.payload,
      content_digest: value.content_digest as `sha256:${string}`,
    };
    return result;
  }

  if (value.source_role === "ember_adoption") {
    if (
      value.source_actor !== "ember" || value.derived_from_evidence_ids.length !== 1 ||
      value.payload_mode !== "descriptor_only"
    ) {
      throw new Error("Ember adoption evidence is invalid");
    }
    const result: EmberAdoptionEvidence = {
      evidence_id: id,
      source_role: "ember_adoption",
      source_actor: "ember",
      asserted_principal: value.asserted_principal,
      occurred_at: value.occurred_at,
      observed_at: value.observed_at,
      derived_from_evidence_ids: [evidenceId(value.derived_from_evidence_ids[0])],
      scope: value.scope,
      payload_mode: "descriptor_only",
    };
    return result;
  }

  throw new Error("unsupported evidence role");
}

function validateMeaning(value: unknown): Meaning {
  if (
    !record(value) || !nonempty(value.meaning_id) || !nonempty(value.kind) ||
    !KINDS.has(value.kind)
  ) {
    throw new Error("meaning identity or kind is invalid");
  }
  if (
    !nonempty(value.owner) || !nonempty(value.slot) || !nonempty(value.scope) ||
    !nonempty(value.content)
  ) {
    throw new Error("meaning routing fields are invalid");
  }
  if (!Array.isArray(value.source_evidence_ids) || !value.source_evidence_ids.every(nonempty)) {
    throw new Error("meaning source evidence is invalid");
  }
  if (
    !nonempty(value.epistemic_role) || !nonempty(value.learned_at) ||
    !nonempty(value.applicable_from)
  ) {
    throw new Error("meaning temporal fields are invalid");
  }
  if (value.applicable_until !== null && !nonempty(value.applicable_until)) {
    throw new Error("meaning applicable_until is invalid");
  }
  if (!nonempty(value.currentness) || !CURRENTNESS.has(value.currentness)) {
    throw new Error("meaning currentness is invalid");
  }
  if (
    !("uncertainty" in value) ||
    (value.uncertainty !== null && typeof value.uncertainty !== "string")
  ) {
    throw new Error("meaning uncertainty is invalid");
  }
  if (!nonempty(value.prospective_lifecycle)) {
    throw new Error("meaning prospective lifecycle is invalid");
  }
  const supersedes = optionalMeaningId(value.supersedes);
  const supersededBy = optionalMeaningId(value.superseded_by);
  const common = {
    meaning_id: meaningId(value.meaning_id),
    owner: value.owner,
    slot: value.slot,
    scope: value.scope,
    content: value.content,
    source_evidence_ids: value.source_evidence_ids.map(evidenceId),
    epistemic_role: value.epistemic_role,
    learned_at: value.learned_at,
    applicable_from: value.applicable_from,
    applicable_until: value.applicable_until,
    currentness: value.currentness as Meaning["currentness"],
    uncertainty: value.uncertainty,
  };
  switch (value.kind) {
    case "relationship":
      if (
        !value.owner.startsWith("relationship:") || value.prospective_lifecycle !== "none" ||
        supersedes || supersededBy
      ) {
        throw new Error("relationship meaning is invalid");
      }
      return {
        ...common,
        kind: "relationship",
        owner: value.owner as `relationship:${string}`,
        prospective_lifecycle: "none",
        supersedes: null,
        superseded_by: null,
      };
    case "fact":
    case "preference":
      if (!value.owner.startsWith("user:") || value.prospective_lifecycle !== "none") {
        throw new Error(`${value.kind} meaning is invalid`);
      }
      return {
        ...common,
        kind: value.kind,
        owner: value.owner as `user:${string}`,
        prospective_lifecycle: "none",
        supersedes,
        superseded_by: supersededBy,
      };
    case "commitment":
      if (
        value.owner !== "ember" || value.prospective_lifecycle !== "live" || supersedes ||
        supersededBy
      ) {
        throw new Error("commitment meaning is invalid");
      }
      return {
        ...common,
        kind: "commitment",
        owner: "ember",
        prospective_lifecycle: "live",
        supersedes: null,
        superseded_by: null,
      };
    case "episode_meta":
      if (value.prospective_lifecycle !== "none" || supersedes || supersededBy) {
        throw new Error("episode meaning is invalid");
      }
      return {
        ...common,
        kind: "episode_meta",
        prospective_lifecycle: "none",
        supersedes: null,
        superseded_by: null,
      };
    default:
      throw new Error("unsupported meaning kind");
  }
}

function optionalMeaningId(value: unknown) {
  if (value === null) return null;
  if (!nonempty(value)) throw new Error("supersession link is invalid");
  return meaningId(value);
}

function digest(payload: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}
