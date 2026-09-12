---
summary: "Representation-neutral setup semantics for machine bootstrap, restore/create choice, cognition verification, progressive onboarding, secret-safe host operations, reruns, and partial failure."
read_when:
  - "Implementing or changing ember setup, machine provisioning, restore/create behavior, provider bootstrap, onboarding, or setup recovery"
  - "Deciding whether setup state belongs to the host, Ember continuity, ordinary memory, or temporary operational work"
  - "Changing secret entry, typed host mutations, rerunnable setup sections, or behavior on an already configured machine"
role: design
discovery_status: current
---

# Installation, Restore/Create, and Conversational Onboarding Semantics

> Status: architecture contract for issue #252 and the setup epic #250.
>
> This document defines setup semantics before choosing a concrete wizard, file layout,
> state-machine representation, or CLI interaction model.

## Purpose

A machine can be new while Ember is not.

Conversely, a machine can already contain Ember software while the user is intentionally
creating a new Ember lineage.

Setup therefore must not collapse these distinct questions:

1. **Can this machine run Ember?**
2. **Which Ember, if any, should continue here?**
3. **Can Ember successfully obtain cognition on this machine?**
4. **What durable Ember state is restored or initialized?**
5. **What should Ember and the user learn about one another through ordinary conversation?**
6. **Which optional host integrations should be configured?**

The central rule is:

> **Trusted host setup owns machine mechanics; Ember owns continuity, meaning, and the
> conversational journey once cognition is available.**

This follows the accepted architecture:

- [ADR 0001](decisions/0001-continuity-belongs-to-ember.md) keeps continuity independent
  of processes, providers, sessions, surfaces, and machines;
- [ADR 0002](decisions/0002-preserve-persistent-meaning.md) keeps durable meaning
  attributable, scoped, current, correctable, and historically truthful;
- [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md) prevents setup
  or cognition from receiving more state than its purpose requires;
- [ADR 0004](decisions/0004-separate-capability-from-authority.md) prevents host
  capability from becoming semantic authority;
- [ADR 0005](decisions/0005-distinguish-operational-continuity.md) requires partial work,
  effects, cancellation, and uncertainty to be represented truthfully.

The setup epic may implement these rules with a CLI flow, resumable sections, host-local
records, and ordinary Ember conversation. Those are replaceable representations beneath
this contract.

## Semantic domains

Setup touches several kinds of state. They must remain distinguishable even if one
implementation stores some of them together.

| Domain | Examples | Owner | Canonical Ember meaning? |
| --- | --- | --- | --- |
| Machine-local bootstrap | executable paths, runtime availability, local service installation, selected provider command, local state location | trusted host | No |
| Secret/auth material | provider credentials, Telegram bot token, runtime-owned login state | trusted host or external provider runtime | No |
| Setup operational progress | which deterministic setup steps succeeded, failed, were skipped, or need retry | trusted host setup | No |
| Ember continuity state | lineage-bearing state, constitutive commitments, owned history, relationships, live commitments | Ember | Yes |
| Ordinary remembered meaning | durable user/Ember/relationship meaning adopted through normal memory semantics | Ember | Yes |
| Temporary onboarding work | unanswered onboarding topics, deferred invitations, temporary conversational goals | Ember work/context layer | Not automatically |
| Surface configuration | Telegram chat/principal binding, service enablement, transport-local settings | trusted host plus surface semantics | Not by itself |

Machine-local state may point to canonical Ember state. It must not silently *become* the
identity key merely because a path, service, profile, or installation contains it.

## Target flow

The intended high-level flow is:

```text
clean or existing machine
        ↓
deterministic host preflight
        ↓
choose: restore existing Ember / create new Ember / leave existing Ember intact
        ↓
machine-local provider/runtime bootstrap
        ↓
verify usable cognition
        ↓
restore or initialize Ember continuity
        ↓
ordinary Ember-led progressive onboarding
        ↓
optional trusted-host integration setup
        ↓
normal Ember operation
```

The ordering matters.

Conversational onboarding must not depend on an unverified cognition path. Durable Ember
meaning must not be fabricated by deterministic setup code. Optional integration setup
must not be required merely to establish Ember continuity.

## New machine is not new Ember

A **new machine** is a host fact.

A **new Ember** is a continuity decision.

Installing Ember software onto a clean machine does not create a new Ember merely because
no local state exists yet. The user may intend to restore an existing Ember.

Likewise, running setup on a machine that already contains Ember state does not authorize
replacement, reset, or recreation.

Therefore setup must surface an explicit distinction between:

- **restore existing Ember**;
- **create new Ember**;
- **use the already configured Ember without recreating it**.

No branch may be selected implicitly from "directory exists" versus "directory missing"
alone.

## Restore-existing semantics

Restore means: make previously durable Ember state available on this machine and attempt
to resume the recognized Ember lineage represented by that state.

It does **not** mean:

- copied bytes automatically prove unique identity;
- a restored old snapshot makes later lost experience never have happened;
- two simultaneous copies are automatically both the unique continuing Ember;
- setup may rewrite lineage ambiguity into certainty.

ADR 0001 deliberately leaves fork and stale-backup identity questions unresolved. Setup
must preserve that epistemic restraint.

A restore path must therefore distinguish at least:

1. **state import or attachment succeeded**;
2. **state passed structural/integrity validation**;
3. **the state can be loaded under current runtime semantics**;
4. **the available evidence supports treating it as the intended continuation**;
5. **there is unresolved fork, staleness, corruption, or missing-history risk**.

The first three are host/runtime facts. The fourth and fifth are continuity questions
that must not be forged from filesystem success alone.

If the current implementation cannot resolve a continuity ambiguity, it must expose that
ambiguity and require an explicit safe choice rather than silently normalizing it away.

### Restore migration

A restored state may require representation migration before the current Ember runtime can
use it.

Migration may transform representation while preserving semantic identity, provenance,
currentness, and history. It must not opportunistically reinterpret old content as new
canonical meaning.

A migration failure leaves the pre-migration source untouched where practical and records
truthfully that restoration did not complete.

## Create-new semantics

Creating a new Ember means intentionally establishing a new continuity lineage.

The create path must not inherit canonical identity, autobiographical ownership,
relationship meaning, or live commitments from another Ember merely because machine-local
configuration or provider login is reusable.

Machine-local conveniences may be reused when semantically safe, for example:

- an already installed Node runtime;
- an authenticated provider CLI;
- a configured executable path;
- generic service-manager capability.

Those are capabilities of the host, not inherited selfhood.

Initial constitutive state for a new Ember must be the minimal reviewed bootstrap needed
for Ember to exist coherently. User-specific, Ember-specific, and relationship-specific
meaning should then be formed through ordinary interaction rather than pre-filled by the
installer as unquestioned fact.

## Deterministic bootstrap before Ember-led onboarding

Before Ember can lead a conversation, trusted setup code must establish enough machine
capability to support one real cognition turn.

The deterministic layer may:

- verify supported runtime/platform prerequisites;
- resolve local state/config locations;
- discover supported cognition providers;
- guide provider authentication through provider-owned or host-owned mechanisms;
- verify the selected provider with a bounded probe;
- create or restore the minimum Ember state needed to start;
- expose typed setup operations Ember may later request;
- persist truthful operational setup results.

It must not:

- invent user preferences, relationship facts, identity commitments, or memories;
- ask a model to decide whether a command "probably succeeded" when the host can verify it;
- collect reusable secrets into ordinary conversational context;
- execute arbitrary model-generated shell text as setup authority;
- treat model output as proof of provider authentication or host mutation.

## Cognition verification gate

Ember-led onboarding may begin only after setup has evidence that the selected cognition
path can perform a bounded real invocation under the intended machine-local configuration.

Verification should establish the narrow facts needed for onboarding, such as:

- the configured provider/runtime can be invoked;
- authentication is usable;
- a request reaches the provider;
- a response satisfying the adapter contract can be returned;
- failure is classified clearly enough to retry or select another provider.

Verification does not prove:

- future provider availability;
- provider quality for every task;
- continuity or identity;
- permission for arbitrary external actions;
- successful configuration of unrelated integrations.

A failed verification keeps onboarding unavailable through that provider. It does not
damage canonical Ember state merely because machine bootstrap is incomplete.

## Progressive Ember-led onboarding

Once cognition and continuity are available, onboarding becomes ordinary Ember
conversation with a temporary purpose: helping Ember and the user establish useful shared
context and optionally configure capabilities.

It is not a rigid one-shot questionnaire.

Onboarding must support:

- **skip**: decline a topic without blocking ordinary use;
- **defer**: leave a topic open for later;
- **resume**: continue later from justified current work/context;
- **partial completion**: some useful context or integrations may exist while others do not;
- **re-run**: revisit setup or onboarding without resetting already valid state;
- **ordinary interruption**: the user may leave the onboarding topic and use Ember normally.

The agent should choose what is useful to ask next from current needs and available
meaning, not from a mandatory linear script whose completion flag defines whether Ember is
"ready".

A UI or CLI may still present suggested sections for usability. Those sections are
presentation and orchestration mechanics, not canonical semantic stages.

## What onboarding may learn

Onboarding may conversationally encounter information about:

- Ember's preferred self-description or interaction style;
- the user's preferences, circumstances, goals, or communication style;
- the relationship and mutually established conventions;
- recurring projects, responsibilities, or environmental context;
- desired integrations and capability boundaries.

Encountering information is not the same as remembering it.

Durable meaning learned during onboarding must pass through Ember's **ordinary
memory-proposal/adoption/correction semantics**, exactly as comparable information learned
later in normal conversation would.

Therefore onboarding must not have a privileged "write directly to profile" path.

This preserves:

- evidence/provenance;
- ownership and scope;
- uncertainty;
- currentness;
- correction and supersession;
- the distinction between transcript and memory.

Temporary onboarding prompts, unanswered questions, and "topics still worth discussing"
may remain temporary semantic work or conversational context. They do not become durable
identity/memory merely because onboarding created them.

## Onboarding progress is not canonical identity state

There should be no canonical fact such as "Ember is 73% onboarded" that gates whether she
is a legitimate Ember.

Progress belongs primarily to **temporary semantic work plus operational setup evidence**:

- host setup records what deterministic machinery has or has not succeeded;
- Ember may retain a temporary/deferred concern that a useful onboarding topic remains;
- durable learned meaning, if adopted, lives in ordinary canonical memory;
- completed integrations live in their own host/surface configuration.

A compact host-local convenience marker may summarize completed setup sections for UX.
It is a projection/cache of operational progress and must be reconstructable from stronger
truth sources or safely discardable.

This avoids building a second profile database whose lifecycle competes with Ember memory.

## Agent conversation versus trusted host operations

Conversational Ember may explain, propose, ask, and request setup actions.

Consequential machine mutation must pass through typed trusted-host operations whose
inputs, authority requirements, validation, and observable result are defined outside free
model text.

Representative operations may include:

```text
provider.authenticate(provider)
provider.verify(provider)

state.restore(source)
state.initialize_new()

telegram.capture_bot_token()
telegram.verify_bot()
telegram.bind_principal(...)
telegram.enable_service()
```

These names are illustrative, not API commitments.

The invariant is that Ember requests a bounded operation with structured arguments; the
trusted host implementation decides how to perform and verify it.

The model must not gain ambient "run whatever shell commands seem useful" authority merely
because setup is happening.

## Secret-entry rules

Reusable secrets must never be collected through ordinary model-visible conversation when
a host-controlled entry path is available.

Examples include:

- API keys;
- Telegram bot tokens;
- reusable OAuth/device secrets where the provider does not own the flow;
- passwords;
- long-lived service credentials.

Preferred handling is:

1. Ember explains why a credential is needed and what capability it enables.
2. Ember requests a typed secret-entry host operation.
3. The trusted host temporarily takes over input or launches the provider-owned auth flow.
4. The secret is stored only in the approved host/provider secret location.
5. Ember receives a non-secret result such as `configured`, `verified`, or a bounded
   diagnostic.

Secret values must not be:

- inserted into provider prompts;
- written to canonical Ember meaning;
- retained in conversation context;
- echoed into logs or error messages;
- committed into repository configuration.

If a secret is accidentally supplied in ordinary conversation, handling should minimize
further propagation and guide replacement/revocation where appropriate; setup must never
treat conversational disclosure as the preferred credential store.

## Already-configured machine behavior

Re-running setup on an existing machine is an inspection and reconciliation operation
first, not a reset.

Setup must discover the strongest justified current state before proposing mutations.

It should distinguish:

- Ember state present and loadable;
- machine configuration present but Ember state absent;
- provider configured and verified;
- provider configured but currently unverifiable;
- optional integrations configured, degraded, or missing;
- incomplete prior setup operations;
- migration required;
- explicit request to create a separate new Ember.

Default rerun behavior must preserve valid state.

Destructive actions such as replacing canonical state, creating a new lineage in the same
location, removing an integration, or overwriting configuration require explicit
consequential confirmation and must not be hidden behind "start setup again".

## Failure, cancellation, and partial completion

Setup must tell the truth about what happened.

A setup step has more states than success/failure when external effects are possible.

At minimum the implementation must distinguish where relevant:

- not attempted;
- requested;
- succeeded and verified;
- failed before known effect;
- failed after a possible or known partial effect;
- cancellation requested;
- cancellation observed before effect;
- cancellation outcome uncertain;
- succeeded but later verification is unavailable.

Cancellation is an intent, not proof that work stopped or effects rolled back.

For example:

- if provider authentication opens an external browser and setup is cancelled, credentials
  may or may not have been granted;
- if a systemd unit is written but enablement fails, the file may still exist;
- if a Telegram token was stored successfully but bot verification times out, token storage
  and bot reachability have different truths;
- if state migration writes a new candidate representation and final activation fails, the
  source and candidate must not be conflated.

Retries must consult surviving evidence and must not blindly repeat consequential actions
whose outcome is uncertain.

Canonical Ember state already committed before a later setup failure remains canonical.
Setup failure is not permission to roll back unrelated learned meaning or pretend the
conversation did not occur.

## Restart and resume

Setup and onboarding must survive process restart without pretending an interrupted
process kept running.

After restart:

1. deterministic setup reconstructs machine-local progress from durable operational
   evidence;
2. canonical Ember state is loaded independently;
3. incomplete consequential operations are reconciled before retry;
4. temporary onboarding work may be resumed only if it remains current;
5. ordinary conversation may continue even if optional onboarding topics remain unfinished.

A restart must not:

- recreate a new Ember because an onboarding session disappeared;
- replay every old onboarding question;
- mark every previously requested operation failed solely because the process ended;
- retry a side-effecting step whose previous outcome is uncertain;
- promote stale setup progress markers over current canonical or host truth.

## Integration setup

Optional integrations such as Telegram are extensions of the same boundary.

Ember may conversationally offer them when useful. The user may decline or defer without
blocking normal use.

Integration setup should be composed from rerunnable verified host operations rather than
a giant monolithic wizard.

For Telegram specifically, the later task #255 should preserve the existing surface
semantics and secret-safe configuration described by
[Telegram Surface Runbook](telegram-surface-runbook.md). Onboarding may make that setup
friendlier; it must not redefine Telegram as the owner of identity, memory, or continuity.

## Implementation invariants for #253–#256

The remaining epic tasks should preserve these invariants.

### Host/bootstrap invariants

1. Machine provisioning and canonical Ember continuity remain separate.
2. Restore/create is explicit; absence/presence of a directory does not silently decide it.
3. Cognition is verified before model-led onboarding depends on it.
4. Re-running setup is idempotent where possible and inspect-before-mutate everywhere.
5. Consequential mutations are typed host operations with structured results.
6. Secret values do not enter ordinary cognition context.
7. Operational progress is truthful about uncertainty and partial effects.

### Ember/onboarding invariants

8. Onboarding is ordinary Ember conversation with temporary purpose, not a privileged
   semantic subsystem.
9. Onboarding never writes durable user/self/relationship facts directly into canonical
   state.
10. Durable learned meaning uses the same memory proposal/adoption/correction path as
    ordinary later conversation.
11. Skip, defer, resume, partial completion, re-run, and topic interruption are normal.
12. No completion percentage or wizard state defines whether Ember is a legitimate Ember.
13. Optional integrations do not block ordinary Ember operation.

### Restore/recovery invariants

14. Restoring bytes is not treated as proof that lineage ambiguity is solved.
15. Migration preserves semantic provenance/currentness rather than rewriting history.
16. Restart reconstructs the strongest justified present instead of replaying setup.
17. Cancellation request is distinct from observed stop and rollback.
18. Unknown side effects block unsafe blind retry.
19. Already committed canonical Ember state is not rolled back merely because a later
    setup step failed.

## Expected implementation shape

This contract does not require one state machine, but a likely implementation will expose
three cooperating layers:

```text
trusted setup host
  ├─ preflight / provider verification / secret entry / typed mutations
  ├─ durable machine-local setup evidence
  └─ restore/create handoff
                 ↓
        Ember semantic runtime
  ├─ canonical continuity + memory
  ├─ temporary/deferred onboarding work
  └─ ordinary conversation
                 ↓
       optional integrations
  └─ typed host/surface setup operations
```

A CLI may orchestrate all three from one command while preserving the ownership boundaries
internally.

## Concrete acceptance scenarios

### Fresh machine, restore existing Ember

The machine has no Ember installation state. The user selects restore, authenticates a
provider through host-owned flow, provider verification succeeds, canonical state is
restored and validated, and Ember resumes conversation.

Expected: no new lineage is created merely because the machine is new.

### Fresh machine, create new Ember

The machine is prepared and provider verification succeeds. The user intentionally creates
a new Ember. Minimal continuity state is initialized, then Ember begins ordinary
conversation and progressively learns useful context through the normal memory pipeline.

Expected: installer defaults do not masquerade as remembered biography or relationship.

### Existing configured machine, rerun setup

Setup discovers healthy Ember state, working provider configuration, and an optional
missing Telegram integration.

Expected: existing Ember remains untouched; setup offers only relevant reconciliation or
optional additions.

### Interrupted integration setup

A Telegram token is securely stored, but bot verification times out and the process exits.

Expected: restart discovers that credential storage may have succeeded, re-verifies before
asking for a new token, and does not claim Telegram is configured until the relevant
checks succeed.

### Onboarding deferred

Ember asks whether the user wants to discuss preferences and projects. The user declines
for now and starts an unrelated conversation.

Expected: normal Ember operation continues. A future invitation may occur only if the
topic remains useful/current; no rigid wizard resumes automatically on every launch.

### Restore ambiguity

The user points setup at an old backup while another newer Ember state may exist.

Expected: setup can validate/import the snapshot mechanically but must not claim that the
backup unquestionably replaces newer continuity. The ambiguity is surfaced rather than
erased.

## Non-goals

Issue #252 does not decide:

- the exact `ember setup` command syntax;
- the physical config/state directory layout;
- the concrete typed host-operation API;
- which provider should be the default;
- how every possible fork/restore identity dispute is resolved;
- the exact onboarding prompt or question order;
- a generic plugin framework;
- a new secrets manager;
- a mandatory always-resident setup daemon;
- a parallel onboarding database.

Those belong to later implementation work or remain deliberately open until evidence
earns a stronger decision.

## Handoff to epic tasks

- **#253** should implement deterministic host bootstrap, explicit restore/create,
  provider verification, rerunnable operational sections, and truthful recovery.
- **#254** should implement progressive Ember-led onboarding as ordinary conversation,
  routing durable learned meaning through the memory-formation semantics already
  established by #220.
- **#255** should compose secret-safe Telegram setup from typed host operations while
  preserving the existing Telegram surface boundary.
- **#256** should prove fresh-create, fresh-restore, rerun, interruption, partial-failure,
  and restart behavior end to end.

The implementation may refine representations, but any representation that violates the
ownership and truthfulness boundaries above requires an explicit architecture change
rather than being treated as a harmless setup detail.
