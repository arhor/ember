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
    evidenceId: EvidenceId;
    sourceRole: "user_command";
    sourceActor: `user:${string}`;
    assertedPrincipal: string;
    occurredAt: string;
    observedAt: string;
    derivedFromEvidenceIds: readonly [];
    scope: string;
    payloadMode: "retained_optional";
    availability: "available";
    payload: string;
    contentDigest: `sha256:${string}`;
}

export interface EmberAdoptionEvidence {
    evidenceId: EvidenceId;
    sourceRole: "ember_adoption";
    sourceActor: "ember";
    assertedPrincipal: string;
    occurredAt: string;
    observedAt: string;
    derivedFromEvidenceIds: readonly [EvidenceId];
    scope: string;
    payloadMode: "descriptor_only";
}

export type Evidence = UserEvidence | EmberAdoptionEvidence;

interface MeaningBase {
    meaningId: MeaningId;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    sourceEvidenceIds: readonly EvidenceId[];
    epistemicRole: string;
    learnedAt: string;
    applicableFrom: string;
    applicableUntil: string | null;
    currentness: Currentness;
    uncertainty: string | null;
}

export interface RelationshipMeaning extends MeaningBase {
    kind: "relationship";
    owner: `relationship:${string}`;
    prospectiveLifecycle: "none";
    supersedes: null;
    supersededBy: null;
}

export interface FactMeaning extends MeaningBase {
    kind: "fact";
    owner: `user:${string}`;
    prospectiveLifecycle: "none";
    supersedes: MeaningId | null;
    supersededBy: MeaningId | null;
}

export interface PreferenceMeaning extends MeaningBase {
    kind: "preference";
    owner: `user:${string}`;
    prospectiveLifecycle: "none";
    supersedes: MeaningId | null;
    supersededBy: MeaningId | null;
}

export interface CommitmentMeaning extends MeaningBase {
    kind: "commitment";
    owner: "ember";
    prospectiveLifecycle: "live";
    supersedes: null;
    supersededBy: null;
}

export interface EpisodeMetaMeaning extends MeaningBase {
    kind: "episode_meta";
    prospectiveLifecycle: "none";
    supersedes: null;
    supersededBy: null;
}

export type Meaning = RelationshipMeaning | FactMeaning | PreferenceMeaning | CommitmentMeaning | EpisodeMetaMeaning;

export interface PersistentState {
    schemaVersion: 1;
    revision: number;
    runtimeContract: {
        localPrincipal: string;
        topology: "single-principal-single-writer";
    };
    lineage: {
        lineageId: LineageId;
        displayName: string;
        establishedAt: string;
        constitutiveBoundaries: readonly {
            boundaryId: "minimal-continuity-v1";
            text: string;
        }[];
    };
    evidence: readonly Evidence[];
    meanings: readonly Meaning[];
    operations: {
        runtimeEpisodes: readonly unknown[];
        cognitionEpisodes: readonly unknown[];
    };
}

export interface CliInput {
    text: string;
    scope: string;
    surface: "cli";
}

export interface ProjectionMeaning {
    meaningId: MeaningId;
    kind: MeaningKind;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    sourceEvidenceIds: readonly EvidenceId[];
    currentness: Currentness;
}

export interface Projection {
    purpose: "ordinary" | "explain";
    lineage: {
        lineageId: LineageId;
        displayName: string;
    };
    selection: {
        meaning_ids: readonly MeaningId[];
        meanings: readonly ProjectionMeaning[];
    };
    input: CliInput;
}

export interface ProviderRequest {
    contractVersion: 1;
    cognitionId: CognitionId;
    projection: Projection;
    input: Pick<CliInput, "text">;
}

export interface ProviderResult {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: readonly MeaningId[];
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
        evidenceId: evidenceId(id),
        sourceRole: "user_command",
        sourceActor: "user:user-1",
        assertedPrincipal: "user-1",
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [],
        scope,
        payloadMode: "retained_optional",
        availability: "available",
        payload,
        contentDigest: digest(payload),
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
        evidenceId: evidenceId("evidence-commitment-adoption"),
        sourceRole: "ember_adoption",
        sourceActor: "ember",
        assertedPrincipal: "user-1",
        occurredAt: learned,
        observedAt: learned,
        derivedFromEvidenceIds: [commitmentRequest.evidenceId],
        scope: "project:ember/docs",
        payloadMode: "descriptor_only",
    };
    const episode = userEvidence(
        "evidence-episode",
        "relationship:user-1",
        "The first continuity experiment received a nickname",
        learned,
    );
    const base = (source: EvidenceId, epistemicRole: string) => ({
        sourceEvidenceIds: [source],
        epistemicRole: epistemicRole,
        learnedAt: learned,
        applicableFrom: learned,
        applicableUntil: null,
        currentness: "current" as const,
        uncertainty: null,
    });
    return {
        schemaVersion: 1,
        revision: 0,
        runtimeContract: { localPrincipal: "user-1", topology: "single-principal-single-writer" },
        lineage: {
            lineageId: lineageId("lineage-evaluation"),
            displayName: "Ember",
            establishedAt: learned,
            constitutiveBoundaries: [
                {
                    boundaryId: "minimal-continuity-v1",
                    text: "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.",
                },
            ],
        },
        evidence: [relationship, fact, preference, commitmentRequest, commitmentAdoption, episode],
        meanings: [
            {
                ...base(relationship.evidenceId, "user_testimony"),
                meaningId: meaningId("meaning-relationship"),
                kind: "relationship",
                owner: "relationship:user-1",
                slot: "relationship",
                scope: "relationship:user-1",
                content: "Continuing collaborators",
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            },
            {
                ...base(fact.evidenceId, "user_testimony"),
                meaningId: meaningId("meaning-fact"),
                kind: "fact",
                owner: "user:user-1",
                slot: "home-server",
                scope: "relationship:user-1",
                content: "Home server is a Raspberry Pi 5",
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            },
            {
                ...base(preference.evidenceId, "user_testimony"),
                meaningId: meaningId("meaning-preference-a"),
                kind: "preference",
                owner: "user:user-1",
                slot: "docs-rationale-detail",
                scope: "project:ember/docs",
                content: "Prefer concise architectural rationale",
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            },
            {
                ...base(commitmentAdoption.evidenceId, "ember_commitment"),
                meaningId: meaningId("meaning-commitment"),
                kind: "commitment",
                owner: "ember",
                slot: "restart-provenance-check",
                scope: "project:ember/docs",
                content: "Check restart reconstruction preserves provenance",
                prospectiveLifecycle: "live",
                supersedes: null,
                supersededBy: null,
            },
            {
                ...base(episode.evidenceId, "user_testimony"),
                meaningId: meaningId("meaning-episode"),
                kind: "episode_meta",
                owner: "relationship:user-1",
                slot: "first-continuity-experiment",
                scope: "relationship:user-1",
                content: "The first continuity experiment received a nickname",
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            },
        ],
        operations: { runtimeEpisodes: [], cognitionEpisodes: [] },
    };
}
