import { createHash } from "node:crypto";

declare const idBrand: unique symbol;

type Brand<Name extends string> = string & { readonly [idBrand]: Name };

export type LineageId = Brand<"LineageId">;
export type MeaningId = Brand<"MeaningId">;
export type EvidenceId = Brand<"EvidenceId">;
export type CognitionId = Brand<"CognitionId">;
export type Currentness = "current" | "superseded" | "historical";
export type MeaningKind = "relationship" | "fact" | "preference" | "commitment" | "episode_meta";

export interface UserEvidence {
    evidence_id: EvidenceId;
    source_role: "user_command";
    source_actor: `user:${string}`;
    asserted_principal: string;
    occurred_at: string;
    observed_at: string;
    derived_from_evidence_ids: readonly [];
    scope: string;
    payload_mode: "retained_optional";
    availability: "available";
    payload: string;
    content_digest: `sha256:${string}`;
}

export interface EmberAdoptionEvidence {
    evidence_id: EvidenceId;
    source_role: "ember_adoption";
    source_actor: "ember";
    asserted_principal: string;
    occurred_at: string;
    observed_at: string;
    derived_from_evidence_ids: readonly [EvidenceId];
    scope: string;
    payload_mode: "descriptor_only";
}

export type Evidence = UserEvidence | EmberAdoptionEvidence;

interface MeaningBase {
    meaning_id: MeaningId;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    source_evidence_ids: readonly EvidenceId[];
    epistemic_role: string;
    learned_at: string;
    applicable_from: string;
    applicable_until: string | null;
    currentness: Currentness;
    uncertainty: string | null;
}

export interface RelationshipMeaning extends MeaningBase {
    kind: "relationship";
    owner: `relationship:${string}`;
    prospective_lifecycle: "none";
    supersedes: null;
    superseded_by: null;
}

export interface FactMeaning extends MeaningBase {
    kind: "fact";
    owner: `user:${string}`;
    prospective_lifecycle: "none";
    supersedes: MeaningId | null;
    superseded_by: MeaningId | null;
}

export interface PreferenceMeaning extends MeaningBase {
    kind: "preference";
    owner: `user:${string}`;
    prospective_lifecycle: "none";
    supersedes: MeaningId | null;
    superseded_by: MeaningId | null;
}

export interface CommitmentMeaning extends MeaningBase {
    kind: "commitment";
    owner: "ember";
    prospective_lifecycle: "live";
    supersedes: null;
    superseded_by: null;
}

export interface EpisodeMetaMeaning extends MeaningBase {
    kind: "episode_meta";
    prospective_lifecycle: "none";
    supersedes: null;
    superseded_by: null;
}

export type Meaning = RelationshipMeaning | FactMeaning | PreferenceMeaning | CommitmentMeaning | EpisodeMetaMeaning;

export interface PersistentState {
    schema_version: 1;
    revision: number;
    runtime_contract: {
        local_principal: string;
        topology: "single-principal-single-writer";
    };
    lineage: {
        lineage_id: LineageId;
        display_name: string;
        established_at: string;
        constitutive_boundaries: readonly {
            boundary_id: "minimal-continuity-v1";
            text: string;
        }[];
    };
    evidence: readonly Evidence[];
    meanings: readonly Meaning[];
    operations: {
        runtime_episodes: readonly unknown[];
        cognition_episodes: readonly unknown[];
    };
}

export interface CliInput {
    text: string;
    scope: string;
    surface: "cli";
}

export interface ProjectionMeaning {
    meaning_id: MeaningId;
    kind: MeaningKind;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    source_evidence_ids: readonly EvidenceId[];
    currentness: Currentness;
}

export interface Projection {
    purpose: "ordinary" | "explain";
    lineage: {
        lineage_id: LineageId;
        display_name: string;
    };
    selection: {
        meaning_ids: readonly MeaningId[];
        meanings: readonly ProjectionMeaning[];
    };
    input: CliInput;
}

export interface ProviderRequest {
    contract_version: 1;
    cognition_id: CognitionId;
    projection: Projection;
    input: Pick<CliInput, "text">;
}

export interface ProviderResult {
    contract_version: 1;
    reply: string;
    used_meaning_ids: readonly MeaningId[];
}

function branded<Name extends string>(value: string, prefix: string): Brand<Name> {
    if (!value.startsWith(prefix)) throw new Error(`expected ${prefix} identifier`);
    return value as Brand<Name>;
}

export const lineageId = (value: string): LineageId => branded<"LineageId">(value, "lineage-");
export const meaningId = (value: string): MeaningId => branded<"MeaningId">(value, "meaning-");
export const evidenceId = (value: string): EvidenceId => branded<"EvidenceId">(value, "evidence-");
export const cognitionId = (value: string): CognitionId => branded<"CognitionId">(value, "cognition-");

export function describeMeaning(meaning: Meaning): string {
    switch (meaning.kind) {
        case "relationship":
            return `relationship:${meaning.owner}`;
        case "fact":
            return `fact:${meaning.slot}`;
        case "preference":
            return `preference:${meaning.slot}`;
        case "commitment":
            return `commitment:${meaning.slot}`;
        case "episode_meta":
            return `episode:${meaning.slot}`;
        default:
            return assertNever(meaning);
    }
}

function assertNever(value: never): never {
    throw new Error(`unhandled semantic variant: ${JSON.stringify(value)}`);
}

function digest(payload: string): `sha256:${string}` {
    return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

function userEvidence(id: string, scope: string, payload: string, at: string): UserEvidence {
    return {
        evidence_id: evidenceId(id),
        source_role: "user_command",
        source_actor: "user:user-1",
        asserted_principal: "user-1",
        occurred_at: at,
        observed_at: at,
        derived_from_evidence_ids: [],
        scope,
        payload_mode: "retained_optional",
        availability: "available",
        payload,
        content_digest: digest(payload),
    };
}

export function fixtureState(): PersistentState {
    const learned = "2026-08-29T10:00:00.000Z";
    const relationship = userEvidence(
        "evidence-relationship",
        "relationship:user-1",
        "Continuing collaborators",
        learned,
    );
    const fact = userEvidence("evidence-fact", "relationship:user-1", "Home server is a Raspberry Pi 5", learned);
    const preference = userEvidence(
        "evidence-preference-a",
        "project:ember/docs",
        "Prefer concise architectural rationale",
        learned,
    );
    const commitmentRequest = userEvidence(
        "evidence-commitment-request",
        "project:ember/docs",
        "Check restart reconstruction preserves provenance",
        learned,
    );
    const commitmentAdoption: EmberAdoptionEvidence = {
        evidence_id: evidenceId("evidence-commitment-adoption"),
        source_role: "ember_adoption",
        source_actor: "ember",
        asserted_principal: "user-1",
        occurred_at: learned,
        observed_at: learned,
        derived_from_evidence_ids: [commitmentRequest.evidence_id],
        scope: "project:ember/docs",
        payload_mode: "descriptor_only",
    };
    const episode = userEvidence(
        "evidence-episode",
        "relationship:user-1",
        "The first continuity experiment received a nickname",
        learned,
    );
    const base = (source: EvidenceId, epistemicRole: string) => ({
        source_evidence_ids: [source],
        epistemic_role: epistemicRole,
        learned_at: learned,
        applicable_from: learned,
        applicable_until: null,
        currentness: "current" as const,
        uncertainty: null,
    });
    return {
        schema_version: 1,
        revision: 0,
        runtime_contract: { local_principal: "user-1", topology: "single-principal-single-writer" },
        lineage: {
            lineage_id: lineageId("lineage-evaluation"),
            display_name: "Ember",
            established_at: learned,
            constitutive_boundaries: [
                {
                    boundary_id: "minimal-continuity-v1",
                    text: "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.",
                },
            ],
        },
        evidence: [relationship, fact, preference, commitmentRequest, commitmentAdoption, episode],
        meanings: [
            {
                ...base(relationship.evidence_id, "user_testimony"),
                meaning_id: meaningId("meaning-relationship"),
                kind: "relationship",
                owner: "relationship:user-1",
                slot: "relationship",
                scope: "relationship:user-1",
                content: "Continuing collaborators",
                prospective_lifecycle: "none",
                supersedes: null,
                superseded_by: null,
            },
            {
                ...base(fact.evidence_id, "user_testimony"),
                meaning_id: meaningId("meaning-fact"),
                kind: "fact",
                owner: "user:user-1",
                slot: "home-server",
                scope: "relationship:user-1",
                content: "Home server is a Raspberry Pi 5",
                prospective_lifecycle: "none",
                supersedes: null,
                superseded_by: null,
            },
            {
                ...base(preference.evidence_id, "user_testimony"),
                meaning_id: meaningId("meaning-preference-a"),
                kind: "preference",
                owner: "user:user-1",
                slot: "docs-rationale-detail",
                scope: "project:ember/docs",
                content: "Prefer concise architectural rationale",
                prospective_lifecycle: "none",
                supersedes: null,
                superseded_by: null,
            },
            {
                ...base(commitmentAdoption.evidence_id, "ember_commitment"),
                meaning_id: meaningId("meaning-commitment"),
                kind: "commitment",
                owner: "ember",
                slot: "restart-provenance-check",
                scope: "project:ember/docs",
                content: "Check restart reconstruction preserves provenance",
                prospective_lifecycle: "live",
                supersedes: null,
                superseded_by: null,
            },
            {
                ...base(episode.evidence_id, "user_testimony"),
                meaning_id: meaningId("meaning-episode"),
                kind: "episode_meta",
                owner: "relationship:user-1",
                slot: "first-continuity-experiment",
                scope: "relationship:user-1",
                content: "The first continuity experiment received a nickname",
                prospective_lifecycle: "none",
                supersedes: null,
                superseded_by: null,
            },
        ],
        operations: { runtime_episodes: [], cognition_episodes: [] },
    };
}
