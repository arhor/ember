import type {
    AvailableUserEvidence,
    CommitmentLifecycle,
    DelegatedReportEvidence,
    EmberAdoptionEvidence,
    EmberInferenceEvidence,
    EmberObservationEvidence,
    EmberState,
    Evidence,
    EvidenceId,
    ExternalClaimEvidence,
    FactMeaning,
    Meaning,
    MeaningId,
    PreferenceMeaning,
    UnavailableUserDetailEvidence,
} from "./model.ts";

import { contentDigest } from "../util.ts";
import { ValidationError } from "./errors.ts";
import { newId, nowUtc, validateState } from "./model.ts";

export function userEvidence(
    state: EmberState,
    principal: string,
    scope: string,
    payload: string,
    { timestamp = nowUtc() }: { timestamp?: string } = {},
): AvailableUserEvidence {
    requirePrincipal(state, principal);
    const evidence: AvailableUserEvidence = {
        evidenceId: newId("evidence"),
        sourceRole: "user_command",
        sourceActor: `user:${principal}`,
        assertedPrincipal: principal,
        occurredAt: timestamp,
        observedAt: timestamp,
        derivedFromEvidenceIds: [],
        scope,
        payloadMode: "retained_optional",
        availability: "available",
        payload,
        contentDigest: contentDigest(payload),
    };
    state.evidence.push(evidence);
    return evidence;
}

interface MeaningCommon {
    meaningId: MeaningId;
    slot: string;
    scope: string;
    content: string;
    sourceEvidenceIds: EvidenceId[];
    learnedAt: string;
    applicableFrom: string;
    applicableUntil: null;
    currentness: "current";
    supersedes: null;
    supersededBy: null;
    uncertainty: null;
}

function meaningCommon(slot: string, scope: string, content: string, sourceEvidenceId: EvidenceId): MeaningCommon {
    if (![slot, scope, content].every((value) => typeof value === "string" && value.trim())) {
        throw new ValidationError("owner, slot, scope, and content must be non-empty");
    }
    const at = nowUtc();
    return {
        meaningId: newId("meaning"),
        slot,
        scope,
        content,
        sourceEvidenceIds: [sourceEvidenceId],
        learnedAt: at,
        applicableFrom: at,
        applicableUntil: null,
        currentness: "current",
        supersedes: null,
        supersededBy: null,
        uncertainty: null,
    };
}

function ensureNoCurrent(state: EmberState, kind: Meaning["kind"], owner: string, slot: string, scope: string) {
    if (![owner, slot, scope].every((value) => typeof value === "string" && value.trim())) {
        throw new ValidationError("owner, slot, and scope must be non-empty");
    }
    if (
        state.meanings.some(
            (m) =>
                m.kind === kind &&
                m.owner === owner &&
                m.slot === slot &&
                m.scope === scope &&
                m.currentness === "current",
        )
    ) {
        throw new ValidationError("a current meaning already occupies this exact semantic slot");
    }
}

function attributedOwner(prefix: "external" | "delegate", label: string): `external:${string}` | `delegate:${string}` {
    if (typeof label !== "string" || !label.trim())
        throw new ValidationError(`${prefix} source label must be non-empty`);
    return `${prefix}:${label.trim()}` as `external:${string}` | `delegate:${string}`;
}

function resolveEvidenceIds(state: EmberState, ids: Array<EvidenceId | string>, scope: string): EvidenceId[] {
    const resolved = ids.map((id) => findEvidence(state, id));
    for (const evidence of resolved) {
        if (evidence.scope !== scope) throw new ValidationError("evidence derivation cannot cross scope");
    }
    return [...new Set(resolved.map((evidence) => evidence.evidenceId))];
}

function rememberAttributedFact(
    state: EmberState,
    principal: string,
    owner: FactMeaning["owner"],
    slot: string,
    scope: string,
    text: string,
    epistemicRole: FactMeaning["epistemicRole"],
    evidence: Evidence,
): MeaningId {
    requirePrincipal(state, principal);
    ensureNoCurrent(state, "fact", owner, slot, scope);
    const common = meaningCommon(slot, scope, text, evidence.evidenceId);
    const meaning: FactMeaning = {
        ...common,
        kind: "fact",
        owner,
        epistemicRole: epistemicRole,
        prospectiveLifecycle: "none",
    };
    state.evidence.push(evidence);
    state.meanings.push(meaning);
    validateState(state);
    return meaning.meaningId;
}

export function rememberExternalClaim(
    state: EmberState,
    principal: string,
    source: string,
    slot: string,
    scope: string,
    text: string,
): MeaningId {
    const owner = attributedOwner("external", source) as `external:${string}`;
    const at = nowUtc();
    const evidence: ExternalClaimEvidence = {
        evidenceId: newId("evidence"),
        sourceRole: "external_claim",
        sourceActor: owner,
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [],
        scope,
        payloadMode: "descriptor_only",
    };
    return rememberAttributedFact(state, principal, owner, slot, scope, text, "external_claim", evidence);
}

export function rememberDirectObservation(
    state: EmberState,
    principal: string,
    slot: string,
    scope: string,
    text: string,
): MeaningId {
    const at = nowUtc();
    const evidence: EmberObservationEvidence = {
        evidenceId: newId("evidence"),
        sourceRole: "ember_observation",
        sourceActor: "ember",
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [],
        scope,
        payloadMode: "descriptor_only",
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
        evidenceId: newId("evidence"),
        sourceRole: "delegated_report",
        sourceActor: owner,
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: resolveEvidenceIds(state, derivedFrom, scope),
        scope,
        payloadMode: "descriptor_only",
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
    if (derived.length === 0)
        throw new ValidationError("Ember inference requires at least one source evidence occurrence");
    const at = nowUtc();
    const evidence: EmberInferenceEvidence = {
        evidenceId: newId("evidence"),
        sourceRole: "ember_inference",
        sourceActor: "ember",
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: derived as [EvidenceId, ...EvidenceId[]],
        scope,
        payloadMode: "descriptor_only",
    };
    return rememberAttributedFact(state, principal, "ember", slot, scope, text, "ember_inference", evidence);
}

export function rememberRelationship(
    state: EmberState,
    principal: string,
    owner: string,
    scope: string,
    text: string,
): MeaningId {
    if (owner !== `relationship:${principal}`)
        throw new ValidationError("relationship owner must match relationship:<principal>");
    ensureNoCurrent(state, "relationship", owner, "relationship", scope);
    const ev = userEvidence(state, principal, scope, text);
    const m: Meaning = {
        ...meaningCommon("relationship", scope, text, ev.evidenceId),
        kind: "relationship",
        owner: `relationship:${principal}`,
        epistemicRole: "user_testimony",
        prospectiveLifecycle: "none",
    };
    state.meanings.push(m);
    validateState(state);
    return m.meaningId;
}

export function rememberFact(
    state: EmberState,
    principal: string,
    owner: string,
    slot: string,
    scope: string,
    text: string,
): MeaningId {
    requireUserOwner(principal, owner);
    ensureNoCurrent(state, "fact", owner, slot, scope);
    const ev = userEvidence(state, principal, scope, text);
    const m: FactMeaning = {
        ...meaningCommon(slot, scope, text, ev.evidenceId),
        kind: "fact",
        owner: `user:${principal}`,
        epistemicRole: "user_testimony",
        prospectiveLifecycle: "none",
    };
    state.meanings.push(m);
    validateState(state);
    return m.meaningId;
}

export function rememberPreference(
    state: EmberState,
    principal: string,
    owner: string,
    slot: string,
    scope: string,
    text: string,
): MeaningId {
    requireUserOwner(principal, owner);
    ensureNoCurrent(state, "preference", owner, slot, scope);
    const ev = userEvidence(state, principal, scope, text);
    const m: PreferenceMeaning = {
        ...meaningCommon(slot, scope, text, ev.evidenceId),
        kind: "preference",
        owner: `user:${principal}`,
        epistemicRole: "user_testimony",
        prospectiveLifecycle: "none",
    };
    state.meanings.push(m);
    validateState(state);
    return m.meaningId;
}

export function rememberEpisode(
    state: EmberState,
    principal: string,
    slot: string,
    owner: string,
    scope: string,
    summary: string,
): MeaningId {
    if (!["ember", `relationship:${principal}`].includes(owner))
        throw new ValidationError("episode owner must be ember or relationship:<principal>");
    ensureNoCurrent(state, "episode_meta", owner, slot, scope);
    const ev = userEvidence(state, principal, scope, summary);
    const m: Meaning = {
        ...meaningCommon(slot, scope, summary, ev.evidenceId),
        kind: "episode_meta",
        owner: owner as "ember" | `relationship:${string}`,
        epistemicRole: "user_testimony",
        prospectiveLifecycle: "none",
    };
    state.meanings.push(m);
    validateState(state);
    return m.meaningId;
}

export function undertake(state: EmberState, principal: string, slot: string, scope: string, text: string): MeaningId {
    ensureNoCurrent(state, "commitment", "ember", slot, scope);
    const request = userEvidence(state, principal, scope, text);
    const at = nowUtc();
    const adoption: EmberAdoptionEvidence = {
        evidenceId: newId("evidence"),
        sourceRole: "ember_adoption",
        sourceActor: "ember",
        assertedPrincipal: principal,
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [request.evidenceId],
        scope,
        payloadMode: "descriptor_only",
    };
    state.evidence.push(adoption);
    const m: Meaning = {
        ...meaningCommon(slot, scope, text, adoption.evidenceId),
        kind: "commitment",
        owner: "ember",
        epistemicRole: "ember_commitment",
        prospectiveLifecycle: "live",
    };
    state.meanings.push(m);
    validateState(state);
    return m.meaningId;
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
    if (!(outcome === "fulfilled" || outcome === "cancelled"))
        throw new ValidationError("commitment transition must be fulfilled or cancelled");
    if (typeof evidenceText !== "string" || !evidenceText.trim())
        throw new ValidationError("commitment transition evidence must be non-empty");
    const commitment = findMeaning(state, commitmentId);
    if (commitment.kind !== "commitment")
        throw new ValidationError("only a commitment can receive a commitment transition");
    if (commitment.currentness !== "current" || commitment.prospectiveLifecycle !== "live")
        throw new ValidationError("only a live current commitment can be discharged");
    const evidence = userEvidence(state, principal, commitment.scope, evidenceText, { timestamp });
    commitment.sourceEvidenceIds.push(evidence.evidenceId);
    commitment.currentness = "historical";
    commitment.prospectiveLifecycle = outcome;
    commitment.applicableUntil = timestamp;
    validateState(state);
    return evidence.evidenceId;
}

export function supersede(
    state: EmberState,
    principal: string,
    meaningId: MeaningId | string,
    text: string,
    { reason = null }: { reason?: string | null } = {},
): MeaningId {
    const old = findMeaning(state, meaningId);
    if (old.kind !== "fact" && old.kind !== "preference")
        throw new ValidationError("only fact and preference correction/supersession is supported");
    if (old.currentness !== "current" || old.supersededBy !== null)
        throw new ValidationError("only a current, unsuperseded meaning can be superseded");
    if (old.epistemicRole !== "user_testimony")
        throw new ValidationError("only user-testimony fact or preference supersession is supported in v1");
    requireUserOwner(principal, old.owner);
    const payload = reason === null ? text : `Correction: ${text}\nReason: ${reason}`;
    const ev = userEvidence(state, principal, old.scope, payload);
    const common = meaningCommon(old.slot, old.scope, text, ev.evidenceId);
    const next: FactMeaning | PreferenceMeaning =
        old.kind === "fact"
            ? {
                  ...common,
                  kind: "fact",
                  owner: old.owner,
                  epistemicRole: "user_testimony",
                  prospectiveLifecycle: "none",
                  supersedes: old.meaningId,
              }
            : {
                  ...common,
                  kind: "preference",
                  owner: old.owner,
                  epistemicRole: "user_testimony",
                  prospectiveLifecycle: "none",
                  supersedes: old.meaningId,
              };
    old.currentness = "superseded";
    old.supersededBy = next.meaningId;
    state.meanings.push(next);
    validateState(state);
    return next.meaningId;
}

export function attachDetail(
    state: EmberState,
    principal: string,
    episodeId: MeaningId | string,
    detail: string,
): EvidenceId {
    if (typeof detail !== "string" || !detail.trim()) throw new ValidationError("optional detail must be non-empty");
    const episode = findMeaning(state, episodeId);
    if (episode.kind !== "episode_meta")
        throw new ValidationError("optional detail can be attached only to episode_meta");
    if (state.evidence.some((e) => e.relatedMeaningId === episode.meaningId))
        throw new ValidationError("episode already has optional detail evidence");
    const ev = userEvidence(state, principal, episode.scope, detail);
    ev.relatedMeaningId = episode.meaningId;
    validateState(state);
    return ev.evidenceId;
}

export function withholdDetail(
    state: EmberState,
    principal: string,
    evidenceId: EvidenceId | string,
    { reason = "fixture detail payload unavailable" }: { reason?: string | undefined } = {},
): EvidenceId {
    requirePrincipal(state, principal);
    const index = state.evidence.findIndex((e) => e.evidenceId === evidenceId);
    if (index < 0) throw new ValidationError(`evidence does not exist: ${evidenceId}`);
    const ev = state.evidence[index]!;
    if (ev.relatedMeaningId === undefined)
        throw new ValidationError("fixture fault can withhold only attached episode detail");
    if (ev.sourceRole !== "user_command" || ev.payloadMode !== "retained_optional" || ev.availability !== "available")
        throw new ValidationError("detail evidence is not currently available");
    if (reason.toLowerCase().includes("delet"))
        throw new ValidationError("privacy deletion semantics are unsupported by fixture fault");
    if (!reason.trim() || reason.includes(ev.payload))
        throw new ValidationError("unavailability reason must not reveal detail");

    const { payload: _payload, contentDigest: _contentDigest, availability: _availability, ...retained } = ev;
    const unavailable: UnavailableUserDetailEvidence = {
        ...retained,
        availability: "unavailable",
        relatedMeaningId: ev.relatedMeaningId,
        unavailableReason: reason,
    };
    state.evidence[index] = unavailable;
    const at = nowUtc();
    const fault: Evidence = {
        evidenceId: newId("evidence"),
        sourceRole: "fixture_fault",
        sourceActor: "runtime",
        assertedPrincipal: principal,
        occurredAt: at,
        observedAt: at,
        derivedFromEvidenceIds: [ev.evidenceId],
        scope: ev.scope,
        payloadMode: "descriptor_only",
        relatedMeaningId: ev.relatedMeaningId,
    };
    state.evidence.push(fault);
    validateState(state);
    return fault.evidenceId;
}

export function findMeaning(state: EmberState, id: MeaningId | string): Meaning {
    const value = state.meanings.find((m) => m.meaningId === id);
    if (!value) throw new ValidationError(`meaning does not exist: ${id}`);
    return value;
}

export function findEvidence(state: EmberState, id: EvidenceId | string): Evidence {
    const value = state.evidence.find((e) => e.evidenceId === id);
    if (!value) throw new ValidationError(`evidence does not exist: ${id}`);
    return value;
}

export function requirePrincipal(state: EmberState, principal: string) {
    if (principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
}

function requireUserOwner(principal: string, owner: string): asserts owner is `user:${string}` {
    if (owner !== `user:${principal}`)
        throw new ValidationError("fact or preference owner must match user:<principal>");
}
