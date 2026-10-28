---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0033: Represent proactive contact as durable intent distinct from delivery

Migration record from [proactive-contact-intent](../proactive-contact-intent.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issue #226 defines durable semantic contact intent after completed cognition; #228
implements an intent store and Telegram handoff. C22 records required lifecycle and
correlation semantics without claiming all requirements are already implemented.

## Decision

Separate completed cognition, contact-decision occurrence, semantic intent, attention/
authority assessment, delivery handoff, send attempt, transport acceptance and awareness.
A contact intent is one current reason to offer a bounded representation to an intended
principal; it is not a message, authority grant, delivery or proof of awareness.

Require valid completed source. Semantically, persist contact_decision_id and evaluating
before deciding durable no_contact (bounded enumerated basis) or crash-consistent
create_intent plus pending intent. Replay resolves the same decision/result/intent;
unfinished evaluation becomes outcome_unknown and failures/cancellation cannot become
no_contact. Invalid/missing source is not_evaluated/invalid_source. No-contact creates
no synthetic empty intent; absence of decision and intent is not deliberate silence.

Preserve intent ID independent of provider/process/surface; purpose; principal/scope/
recipient constraints; source cognition/opportunity/evidence and derivation; immutable
surface-neutral representation/reference, digest, availability/classification;
currentness/urgency/expiry; declared satisfaction boundary; attributable lifecycle,
reconsideration, successor/next-owner and delivery correlation. Representation may
contain deliverable text, but inspection/projections disclose least-sufficient fields
and redact retained text unless necessary/permitted. No chat/message/SDK/tool/session
identity defines the semantic intent; delivery owns routing and transport mechanics.

Pending/deferred are live; defer names owner and bounded reconsideration. Suppressed,
satisfied, superseded and cancelled close the occurrence and never reopen in place.
Handed_off transfers responsibility to exactly one correlated delivery identity/digest,
not proof of send/success; satisfaction needs its declared evidence, potentially human
acknowledgement rather than transport acceptance. Release handoff to pending only with
definite no-attempt/no-possible-effect evidence and relinquished delivery ownership.

Revalidate recipient/scope, current/live grounding, truthful representation, urgency/
expiry/authority/attention and existing correlation before policy/handoff. Temporary
obstacle defers; changed material content/recipient/basis creates a named successor
with new identity/digest, not a patched retry. Equal text/grounding is not occurrence
identity; use stable replay/domain/predecessor provenance and preserve uncertainty.
Transport retries retain the same intent/delivery/representation and do not rerun thought.

Before superseding/cancelling handed-off work, commit a correlated no-further-send
fence checked before every first send/retry. Unattempted/definitely failed work may
withdraw retry and finish the transition; started/nonterminal becomes uncertain and
blocks successor handoff. Uncertain work stays fenced/blocked until stronger external
or attributable duplicate-aware policy resolves it. Confirmed prior delivery remains
historical effect and any successor correction needs fresh attention/currentness.
If both sides cannot be recovered crash-consistently, keep predecessor effectively
handed_off and successor ineligible. Cancellation does not recall/undo delivery.

Persist decision/intent before handoff, delivery correlation before effect, started
before transport. Recovery uses identities without rerunning cognition: missing
create_intent counterpart or missing correlated delivery blocks; adopt the unique
matching delivery only after fresh required revalidation; started becomes uncertain,
terminal intents never re-enter, and downtime creates no contact/satisfaction fiction.
Existing sidecar/delivery store, fresh agency revalidator and send fence implement
selected portions without prescribing a database, queue or runtime topology.

## Consequences

- Intent purpose survives transport changes without blind fallback or duplicate sends.
- Semantic terminal transitions require delivery fencing, not just changing an intent bit.
- **Acknowledged open implementation gap:** current ProactiveContactStore schema stores
  intents, policy decisions, handoff and delivery observations, not the semantic durable
  contact-decision/no_contact ledger described above. Repository inspection found no
  contact_decision_id/no_contact implementation. These remain requirements, not verified
  existing behavior; missing decisions cannot be called successful silence. This phase
  records the gap and does not implement package/schema changes.

## Implementation Plan

- **Affected paths:** [packages/core/src/agency/proactive-contact-store.ts](../../../packages/core/src/agency/proactive-contact-store.ts); [packages/core/src/runtime/interaction-boundary.ts](../../../packages/core/src/runtime/interaction-boundary.ts); [apps/telegram/src/surface.ts](../../../apps/telegram/src/surface.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Preserve lifecycle, fencing, eight restart rules and inspection redaction. Track a separate unresolved implementation obligation for durable contact-decision/no_contact history; no claim that intent-store tests verify it.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/proactive-contact-store.test.ts`; `tests/telegram-delivery-reconciliation.test.ts`; `tests/proactive-contact-evaluation.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.
- [x] The maintainer acknowledged the durable contact-decision/no_contact implementation gap and its agency/contact follow-up ownership; no existing test is claimed to verify that missing ledger.

## Alternatives Considered

- Store only a pending message: simpler queue but loses semantic reason, currentness,
  no-contact decision and separate awareness/satisfaction.
- Infer no-contact from no intent: mistakes not-run/failure/loss for deliberate silence.
- Supersede semantic intent and resend elsewhere without fencing: can repeat an
  uncertain old effect; keep identity, ownership and correlated delivery evidence.

## More Information

See the [ADR index](README.md) for governing accepted decisions and the
[migration plan](../../research/archive/adr-migration-plan.md) for source mapping and phase-review tasks.
The source references retain detailed evidence and unresolved representation choices.
Revisit when concrete behavior or measured operational pressure invalidates a constraint;
implementation changes must preserve accepted semantic authority/currentness/provenance
rather than treating richer runtime mechanics as permission.

### Migration verification — 2026-10-27

The combined run passed 210 deterministic tests across 24 files for the unchanged
implementation. A second review checked source invariants, evidence limits, original
headings/anchors, native metadata/template sections, sequential numeric identities,
source/index traceability, local links and protected-file integrity. No live model,
remote account or LangGraph install/benchmark was used. Tests verify selected existing
traces, not every semantic requirement: in particular they do not establish the missing
durable contact-decision/no_contact lifecycle recorded in ADR 0033. The maintainer accepted this record on 2026-10-27; source ownership is now transferred.

### Phase acceptance — 2026-10-27

The maintainer accepted M08, including historical qualification of the obsolete Codex
exact-token guidance and acknowledgement of the missing durable contact-decision/
no_contact ledger. That ledger remains open implementation work under M08-F02 in the
migration plan; this acceptance does not implement or verify it. Source paths, headings,
procedures and dated evidence remain available. No runtime, dependency, package or
original-skill changes are introduced by this documentation acceptance.

## Open implementation follow-up — 2026-10-28

The maintainer accepted the semantic contract with the known missing durable
contact-decision/no_contact lifecycle. The agency/contact boundary owns the following
runtime work (formerly M08-F02 in the archived migration record). It remains open;
this documentation reorganization changes no package code or runtime behavior.

- [ ] Design versioned contact-decision storage and stable replay correlation alongside
      current intent state, requiring valid completed source and bounded no_contact bases.
- [ ] Persist evaluating before decision; crash-consistently establish exactly one
      create_intent counterpart, or durable no_contact without a synthetic intent.
- [ ] Return established outcomes on replay; recover interrupted evaluation as unknown;
      block inconsistent correlations instead of recreating decisions or claiming silence.
- [ ] Add behavior tests for repeated no-contact, abort/failure, restart crash windows,
      source/replay correlation, missing counterparts and redacted operator inspection.
