---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0038: Separate machine setup, lineage selection, and conversational onboarding

Migration record from [setup-and-onboarding-semantics](../../guides/setup-and-onboarding.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Epic #250/#252–#256 separates machine readiness from continuing-agent lineage and
ordinary progressive onboarding. A new installation is not a new agent, and setup
rerun is not reset. C27 records semantic boundaries plus the current bootstrap limits;
host commands, secret entry, config layout and procedures remain source references.

## Decision

Separate host bootstrap, provider secrets/login, setup progress, canonical continuity,
ordinary memory, temporary onboarding work and surface configuration. Explicitly choose
restore existing, create new, or use existing; path absence/presence never decides identity.
Restore import/attachment, validation/loadability, intended continuation and fork/stale/
missing-history uncertainty are different facts. Current restore attaches an already-local
store with accompanying sidecars, not general archive migration; explicit continuity-risk
acknowledgement records operator choice, not proof ambiguity vanished. Preserve semantic
IDs/provenance/currentness through any supported representation normalization/migration.

Create new lineage only deliberately with minimal reviewed bootstrap, no inherited
biography/name/relationship/memory from reused host/provider config. Lineage-derived
agent actor is stable attribution, not a chosen display name. Verify a bounded real
provider invocation before model-led onboarding: no canonical principal/meaning, host
paths or secrets in the disposable probe; validate response against empty permitted IDs,
record only normalized operational outcome, discard reply/session/raw diagnostics.
Verification proves usable invocation then, not future availability/identity/quality or
action authority. Failed setup cannot damage already committed continuity.

Trusted host code owns preflight, explicit provider config, typed structured mutations,
secret entry/provider auth and observable results. Models may propose/explain bounded
operations but cannot run arbitrary shell or assert host success. Never request reusable
secrets in ordinary model-visible conversation; no prompt/canonical/context/log/repository
secret storage. Provider-owned login remains external. Keep Calendar PKCE/exact-state/
0600 refresh-token/memory-only access-token and bounded activation read in trusted-host
setup, not normal conversation; credential reach is not consequential authority.

Rerun inspects/reconciles before mutation, preserving healthy state/bindings. Replacement,
new-lineage-in-place, removals or overwrites need explicit consequential intent. Current
setup does not overwrite canonical state or silently retarget path/principal/lineage;
provider changes require confirmation and fresh verification. Config/state/sidecar alias
collisions fail. Validate the configured principal/lineage/establishment-time binding
under canonical lease before runtime start, not just an earlier unlocked read.

Once verified continuity exists, onboarding is ordinary conversation with temporary
purpose. Allow skip/defer/resume/partial completion/rerun/topic interruption; normal
requests take priority and optional integrations do not gate ordinary use. Durable
learned names/preferences/self/relationship meaning use the ordinary proposal/adoption/
correction path, never direct profile writes. No wizard percentage makes lineage legitimate.
Temporary work is bound to lineage/principal/relationship scope and absent on restore/use
existing is not proof newborn onboarding should be synthesized. Current sidecar topic
states open/deferred/declined/resolved and closed evidence prevent automatic rebirth.

Plain first run uses the same bootstrap verification/activation then ordinary composed
application; do not fabricate greeting/user turn or separate onboarding cognition.
Progress evaluator supplies typed legal transitions with exact supporting span in the
current user input, topic uniqueness and same ordinary user evidence; provider reply
cannot mutate progress. Failure preserves prior work and remains diagnostic separately
from successful reply. Reflection uses ordinary bounded memory generation/adoption,
not onboarding authority. Re-read work each turn; closure stops automatic reflection
immediately, including CLI/Telegram/provider changes, without erasing adopted meaning.

Track probe, continuity activation and cancellation separately. Requested, verified,
failed, timed-out, cancellation-requested and unknown cannot collapse; partial host
writes/effects survive later failures. Setup durable config and cooperative lease,
pending intended lineage before activation, post-write cancellation reconciliation,
and surviving-store checks prevent duplicate creation or false ready messages. Missing
store after possibly executed/available creation is not automatically recreated.
Interrupted consequential steps require reconciliation before retry; canonical state
already committed is not rolled back by setup failure. Restart reconstructs host and
canonical truth independently, resumes only current temporary work and invents no
background progress. Typed optional integrations remain operator-owned; Telegram setup
is outside conversational CLI bootstrap, keeping apps siblings and secrets/services host-local.

Unresolved fork identity, universal auth thresholds, broad migration/successor rules,
provider defaults and generic plugin/secret-manager/daemon choices remain unselected.
Current implementation-specific commands/paths/topic names are revisable beneath these
boundaries rather than newly universal semantic requirements.

## Consequences

- Host readiness and progressive learning can evolve without defining lineage by a wizard.
- Restore and partial cancellation can remain uncertain; truthful recovery may require
  operator intervention rather than implicit reset or blind retry.
- Source procedures remain necessary for concrete command/path/secret handling; canonical
  memory and temporary onboarding work retain different lifecycles and scopes.

## Implementation Plan

- **Affected paths:** [packages/core/src/app/bootstrap.ts](../../../packages/core/src/app/bootstrap.ts); [packages/core/src/host/setup.ts](../../../packages/core/src/host/setup.ts); [packages/core/src/composition/setup.ts](../../../packages/core/src/composition/setup.ts); [packages/core/src/onboarding-work.ts](../../../packages/core/src/onboarding-work.ts); [packages/core/src/onboarding/progress-evaluator.ts](../../../packages/core/src/onboarding/progress-evaluator.ts); [packages/core/src/persistence/onboarding-work-store.ts](../../../packages/core/src/persistence/onboarding-work-store.ts); [apps/cli/src/setup.ts](../../../apps/cli/src/setup.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Preserve all nineteen source invariants, explicit intent/restore/create distinctions, command/secret/config/recovery procedures, progressive-work evidence and unresolved fork semantics.

### Verification

- [x] Targeted deterministic tests pass: `tests/setup.test.ts`; `tests/onboarding.test.ts`; `tests/setup-onboarding-evaluation.test.ts`; `packages/core/src/ai/onboarding-progress.test.ts`; `packages/core/src/host/setup-diagnostics.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Installer fills a permanent profile/name/relationship directly: convenient first-run
  personality but manufactures ungrounded canonical meaning outside normal adoption.
- Treat missing setup/session as a new agent: simple reset semantics but can overwrite
  restored or already-committed continuity and erase uncertainty.
- Monolithic mandatory onboarding/host-mutation conversation: smooth-looking wizard but
  couples secrets and machine effects to model text and blocks ordinary use unnecessarily.

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
