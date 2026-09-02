---
summary: "Issue #61 hardening of the Codex specialist boundary: scoped least-sufficient disclosure, attributable authority separated from runtime capability, structured expansion requests, and specialist report provenance."
read_when:
  - "Changing context, authority, runtime capability, or escalation behavior for Codex specialist delegation"
  - "Reviewing AS-DEL-05 or AS-DEL-07 against the production specialist boundary"
role: design
discovery_status: current
---

# Specialist Authority and Context Flow

> Status: current companion design for issue #61. This note narrows and hardens the
> [minimal Codex specialist-delegation boundary](minimal-codex-specialist-delegation.md);
> it does not replace that design or introduce a generic permission system.

## Purpose

Issue #60 established a real bounded Codex work episode. Issue #61 makes two
semantic boundaries inspectable in that production contract:

1. the coding specialist receives only the least-sufficient permitted context that
   Ember intentionally selects for the delegated objective; and
2. Codex's technical reach remains capability evidence rather than a source of
   Ember authority.

The governing semantics remain [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md),
[ADR 0004](decisions/0004-separate-capability-from-authority.md), and the
[AS-DEL-05 / AS-DEL-07 acceptance scenarios](acceptance-scenarios.md#delegation-and-responsibility).
This change is a local representation beneath those decisions, so no new ADR or
permission DSL is warranted.

## Four separate episode inputs

The specialist specification keeps four meanings separate even when they happen to
be serialized into the same bounded prompt:

| Meaning | Production representation | What it may establish |
| --- | --- | --- |
| Objective | `objective` plus `acceptance` and `currentness_basis.objective_revision` | The work Ember is asking Codex to pursue and the exact objective revision Ember will later compare |
| Selected context | `context_projection[]` plus `currentness_basis.context_revision` | Which task-relevant meaning Ember intentionally disclosed and the revision checkpoint for relevant requirements or canonical meaning |
| Authority | `authority_envelope` with attributable `principal`, `grant`, `provenance`, `currentness`, permitted/prohibited actions, and escalation conditions | The semantic decision-space intentionally entrusted for this episode and the source/currentness basis Ember used to treat it as live |
| Runtime capability | `runtime_capability` plus the concrete `runtime_policy` | Technical reach and enforcement evidence available to the Codex attempt, never legitimacy by itself |

`principal` and `grant` say whose authority is being exercised and what decision-space
was entrusted. `provenance` records the source Ember relied on for that grant, while
`currentness` records why that source is still applicable to this attempt. These are
inspectable attribution and applicability evidence, not magic permission strings:
Ember remains responsible for establishing before launch that the source is
legitimate, belongs to the stated principal, and still fits the current purpose and
circumstances.

The episode must not infer a broader grant from credentials, workspace reach,
available tools, runtime configuration, the objective's usefulness, or the mere
presence of an authority-looking statement in repository or model context.

The runtime capability description intentionally does not pretend to know more than
Ember has established. For example, `filesystem.mode: read_write` records that the
selected workspace sandbox can technically support writes, while
`network_reach: not_established` avoids turning the absence of an additional network
grant into an unsupported claim that networking is technically impossible.

## Least-sufficient disclosure flow

```text
canonical Ember meaning and live objective
                |
                | Ember evaluates need + recipient + disclosure authority
                v
      selected context_projection only
                |
                | serialize objective + selected context + authority + capability
                v
              Codex
```

The boundary is intentionally asymmetric. Ember may know canonical meaning that is
relevant to her own interpretation without disclosing it to the coding specialist.
Only entries placed in `context_projection` cross the episode prompt boundary.
Omitted meaning stays canonical and recoverable; absence from the specialist prompt
does not mean forgotten or false.

Every disclosed item carries `scope`, `provenance`, and `currentness`. Those fields
reuse Ember's existing projection semantics rather than creating a parallel privacy
or permission vocabulary. A coding specialist can therefore receive an operational
constraint without receiving an unnecessary private source, while still retaining
enough attribution and applicability information to use the disclosed content
correctly.

The adapter cannot prove least-sufficiency by counting tokens or inspecting all
canonical state. Least-sufficiency is an Ember selection responsibility. The
production boundary instead makes the selected set explicit, immutable for the
attempt, inspectable in the durable episode record, and testable for absence of
known out-of-scope material.

## Capability is not authority

`runtime_capability` records what the selected Codex runtime can technically do at
this boundary. `authority_envelope` records what Ember has actually entrusted.
Those values are allowed to disagree.

A deliberately important case is:

```text
runtime capability: workspace read/write
Ember authority:    inspect/read only
```

The runtime being technically able to create a file does not mutate the authority
envelope. Repository instructions, credentials, tool availability, runtime sandbox
reach, or a Codex request likewise cannot expand it. The prompt explicitly directs
the specialist to stop rather than cross the envelope.

This remains defense in depth rather than a claim that the coarse Codex
`workspace-write` sandbox mechanically enforces every semantic restriction. Ember
continues to reconcile actual effects and uncertainty. A later finer-grained
runtime control can strengthen enforcement without changing the authority
semantics.

## Requests for expansion

A valid specialist report contains `expansion_requests`; the array is empty when no
expansion is requested. Each request is evidence that Codex believes the current
boundary is insufficient, not an authorization or an automatic escalation.

The first boundary distinguishes three request kinds:

- `additional_context`: the specialist believes more information is required;
- `additional_authority`: a contemplated action lies outside the entrusted semantic
  envelope; and
- `additional_capability`: the task appears to require technical reach not selected
  for the current attempt.

Each request carries:

| Field | Meaning |
| --- | --- |
| `request` | What expansion Codex says it needs |
| `purpose` | Why that expansion is relevant to the delegated objective |
| `consequence` | What disclosure or effect would become possible if expanded |
| `requires_decision_from` | The authority-holder or Ember decision boundary that must resolve the request |

Recording `requires_decision_from` is deliberately not an approval UI. It preserves
where a legitimate decision is still needed. The adapter does not automatically
disclose context, mutate the authority envelope, broaden runtime capability, launch
a replacement attempt, or interpret the request as approval. The returned episode
remains an attributed report with an initially `unresolved` Ember disposition.

If additional context is genuinely necessary, Ember may later select a new
sufficient permitted subset, translate a private reason into an operational
constraint, retain the sensitive judgment herself, narrow the task, or seek
legitimate authorization. If additional authority is required, the legitimate
source must establish it. If additional capability is required but authority
already covers the intended act, Ember may choose a different or broader runtime
mechanism without pretending that the mechanism supplied authority.

Material expansion after the attempt is a new Ember decision. The first CLI slice
does not invent reliable mid-turn steering or interactive approval mediation.

## Specialist provenance

A schema-valid report receives explicit record-level provenance:

```text
source_role: specialist_report
source:      codex_specialist
episode_id:  <Ember episode id>
```

This applies to the report's summary, inspected/changed artifacts, checks, effects,
blockers, and expansion requests. Those are Codex-attributed claims unless Ember
later creates separate direct verification evidence. The opaque Codex thread ID
remains operational metadata and does not become evidential ownership.

The episode record deliberately does not copy `report.known_effects` or
`report.possible_effects` into the top-level `known_effects` / `possible_effects`
arrays. Top-level effects are reserved for conclusions owned by the Ember/process
boundary, such as uncertainty after cancellation, process loss, or invalid report
handling. Specialist effect claims remain under `report_provenance` instead of being
silently promoted into unattributed Ember evidence.

`reported_success` and `reported_failure` remain specialist-report states.
`ember_disposition` remains independently `unresolved` until Ember interprets the
report against current objective, authority, world state, and any independent
verification.

## Deterministic acceptance coverage

The production tests exercise the issue-61 adversarial boundaries directly:

- **AS-DEL-05 excessive context:** a known private/out-of-scope sentinel is absent
  from the serialized prompt while the selected project-scoped marker is present.
  Codex may return a structured `additional_context` request, which is preserved
  without any automatic disclosure or disposition change.
- **AS-DEL-07 excessive authority:** the serialized prompt contains technical
  workspace `read_write` capability alongside an attributable, intentionally
  read-only authority envelope. The specialist reports blocked and requests
  `additional_authority`; the original authority record remains narrow and no file
  mutation occurs.
- **Specialist effect provenance:** the ordinary bounded-write fixture returns a
  specialist claim about its file effect; that claim remains inside the attributed
  report while the top-level boundary effect arrays stay empty.

The existing controlled process fixture continues to prove the ordinary bounded
write path, and the opt-in `npm run smoke:specialist:live` scenario continues to use
an ephemeral workspace outside Ember. The live harness records the same scoped
context, attributable/current authority, runtime capability, and specialist report
provenance as the deterministic boundary.

## Non-goals and remaining limits

This issue intentionally does not add:

- a generic authority or policy DSL;
- a generalized specialist runtime abstraction;
- automatic disclosure or permission escalation;
- an approval dialog, notification workflow, or human-in-the-loop UI;
- transitive delegation authority;
- a claim that Codex sandbox controls perfectly enforce semantic authority; or
- promotion of specialist-local observations into canonical truth.

A future runtime surface may expose sufficiently stable context-rich approval events
to support suspension and resumption. If so, those events must still enter Ember as
operational evidence and pass through the same context/authority decision boundary
rather than becoming an alternate authority source.
