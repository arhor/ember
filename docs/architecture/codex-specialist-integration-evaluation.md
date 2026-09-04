---
summary: "Issue #64 evaluation concluding that Codex exec remains sufficient for Ember's implemented specialist delegation, with App Server adoption deferred until live approval mediation or in-turn control becomes required."
read_when:
  - "Choosing between Codex exec, the TypeScript Codex SDK, and Codex App Server for specialist delegation"
  - "Evaluating whether specialist approvals, progress, cancellation, steering, or session lifecycle require a richer Codex integration"
  - "Reviewing the evidence and adoption trigger behind Ember's current Codex specialist process boundary"
role: design
discovery_status: current
---

# Codex Specialist Integration Evaluation

## Decision

**Keep `codex exec` for the current specialist boundary. Do not migrate to Codex
App Server or the TypeScript SDK for issue #64.**

The implemented requirements from issues [#48](https://github.com/arhor/ember/issues/48),
[#59](https://github.com/arhor/ember/issues/59),
[#60](https://github.com/arhor/ember/issues/60), and
[#63](https://github.com/arhor/ember/issues/63), together with acceptance scenarios
AS-DEL-00 through AS-DEL-08, require a bounded attempt, explicit workspace and
runtime policy, attributable structured evidence, best-effort cancellation, and
truthful uncertainty after boundary loss. The current `codex exec` adapter provides
those capabilities. None of the accepted scenarios requires Ember to suspend a
running turn, answer a runtime approval request, steer the same turn, or recover the
same Codex-local thread.

App Server has real additional capabilities: bidirectional approval requests,
in-turn steering, a protocol-level interrupt, richer streamed lifecycle events,
and explicit thread operations. Those capabilities would matter if Ember adopts a
live approval-mediated specialist episode. They do not make cancellation prove
effect absence, make runtime permission equal semantic authority, or remove Ember's
durable reconciliation obligations. Adopting them now would add a stateful JSON-RPC
client and a larger versioned protocol without satisfying a current unmet
requirement.

The TypeScript Codex SDK is not a third capability tier for this decision. The
official SDK guide presents the TypeScript library as a programmatic way to start,
continue, and resume local Codex threads, and directs custom clients needing
approvals and streamed events to App Server. It could reduce subprocess wrapper
code, but that convenience alone does not justify a new production dependency or
a session-semantics change.

The same official page also documents a stable Python SDK that controls a local
App Server over JSON-RPC and includes a pinned Codex CLI runtime dependency. That
SDK packages the richer App Server boundary rather than supplying another
capability tier. It is outside this evaluation's implementation scope because
Ember's accepted runtime and current specialist adapter are TypeScript on Node.js;
its underlying App Server capabilities and costs remain covered here.

## Evaluation baseline

This evaluation was performed on **2026-09-02** against:

- repository specialist record contract version 3 and episode specification
  contract version 2 in `src/delegation/codex-specialist.ts`;
- the implemented behavior and deterministic cases in
  `src/delegation/codex-specialist.test.ts`;
- the [minimal specialist design](minimal-codex-specialist-delegation.md),
  [authority and context flow](specialist-authority-context-flow.md),
  [external-runtime spike](external-agent-runtime-spike.md), and AS-DEL-00 through
  AS-DEL-08 in the [acceptance catalogue](acceptance-scenarios.md#delegation-and-responsibility);
- locally installed **`codex-cli 0.152.1`**, observed with `codex --version`,
  `codex exec --help`, and `codex app-server --help`; and
- official OpenAI documentation retrieved on 2026-09-02 for
  [non-interactive mode](https://developers.openai.com/codex/noninteractive/),
  [Codex App Server](https://developers.openai.com/codex/app-server/), and the
  [Codex SDK](https://developers.openai.com/codex/sdk/).

The OpenAI pages do not expose a documentation release number. Claims below are
therefore dated documentation observations, not promises that every older or
future CLI has the same surface. The local command observations establish only
what version 0.152.1 exposed in this environment. The repository adapter continues
to treat external output as untrusted and validates the narrow contract it uses.

## Requirement-by-requirement evaluation

| Required semantic or operational capability                                    | What `codex exec` provides and Ember implements                                                                                                                                                                                              | Gap that matters now                                                                                                              | What App Server or TypeScript SDK would add                                                                                                                                                             | Added complexity or ownership change                                                                                                                                                                                   | Recommendation                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Explicit bounded objective and least-sufficient context (AS-DEL-00, AS-DEL-05) | Prompt over stdin; explicit `-C` workspace; `--ignore-user-config`; disabled plugins, apps, and skill instructions; Ember persists the immutable projection before launch                                                                    | None for the implemented single attempt                                                                                           | App Server `turn/start` accepts input, cwd, sandbox, and other overrides; the TypeScript SDK offers typed thread/run calls                                                                              | App Server requires connection initialization and thread/turn ownership; the TypeScript SDK adds a runtime dependency while Ember must still build the same projection                                                 | Keep `exec`                                                                                                     |
| Separate semantic authority from runtime capability (AS-DEL-05, AS-DEL-07)     | Preselected `workspace-write` capability is recorded separately from the prompt-level authority envelope; out-of-envelope needs return in the final `expansion_requests` report                                                              | Cannot pause the same CLI turn to mediate a newly encountered runtime approval; the current contract intentionally blocks instead | App Server sends bidirectional command, file-change, and permission approval requests with thread, turn, item, action, cwd, reason, and sometimes network context                                       | Ember would have to persist pending-request correlation, reconstruct meaningful semantic authority, route or deny decisions, and handle request cleanup/disconnects; runtime approval would still not create authority | Keep `exec` until same-attempt approval mediation is a required scenario                                        |
| Structured final report with specialist provenance (AS-DEL-03)                 | Officially documented `--output-schema`; JSONL final agent message; Ember validates exact fields and retains Codex attribution separately from Ember disposition                                                                             | None                                                                                                                              | App Server accepts an output schema on a turn and streams item events; the TypeScript SDK exposes final responses and thread APIs                                                                       | Larger event/schema surface with no stronger provenance; Ember still validates and interprets the report                                                                                                               | Keep `exec`                                                                                                     |
| Credible progress and partial evidence (AS-DEL-01, AS-DEL-06)                  | Officially documented JSONL includes thread, turn, command, file-change, tool, plan, message, completion, failure, and error events; Ember deliberately persists only stable boundary facts and the final report                             | No durable semantic intermediate-progress claim; this is a deliberate narrowing, not a current acceptance failure                 | App Server streams item start/completion, deltas, tool progress, and thread status with stronger identifiers; the official SDK guide directs custom clients needing streamed agent events to App Server | Requires a version-aware event reducer, bounded storage, provenance rules, replay/reconnect behavior, and a decision about which operational events deserve durable semantic status                                    | Keep `exec`; reconsider App Server only when a user-visible or recovery requirement needs intermediate progress |
| Explicit cancellation and timeout with truthful effects (AS-DEL-04, AS-DEL-06) | Ember records intent before signalling, distinguishes timeout from cancellation, applies bounded TERM/KILL to the direct child, records observed exit separately, and prohibits unsafe retry when effects or continued work remain uncertain | CLI child termination gives no specialist-wide stop acknowledgement and cannot prove descendant, remote, or prior effects stopped | App Server documents `turn/interrupt` and an `interrupted` turn status; experimental APIs can list or terminate background terminals                                                                    | A protocol acknowledgement improves Codex-turn evidence but still does not prove rollback, remote-effect absence, or that every descendant stopped; a persistent server also becomes another supervised process        | Keep `exec`; App Server would improve control evidence, not discharge AS-DEL-04 reconciliation                  |
| Boundary/process loss and restart (AS-DEL-08)                                  | Ember's durable record survives restart and converts a committed or possibly launched attempt to `lost`/`ambiguous`; replacement is a new Ember episode                                                                                      | No reattachment to the ephemeral CLI attempt, by design                                                                           | App Server supports thread read/resume/list and status; the TypeScript SDK supports continuing and resuming threads                                                                                     | Persisted Codex threads would become operational recovery inputs requiring retention, cleanup, compatibility, disclosure, and currentness rules; thread resumption cannot reconstruct unobserved effects               | Keep fresh ephemeral attempts until same-thread recovery becomes a concrete requirement                         |
| Late-result currentness and Ember-owned disposition (AS-DEL-02)                | Immutable objective/context revisions are compared with a current checkpoint before acceptance                                                                                                                                               | None                                                                                                                              | No Codex surface removes this responsibility                                                                                                                                                            | Adopting another surface does not change ownership; Ember must still reject, qualify, or re-evaluate late reports                                                                                                      | Keep `exec`                                                                                                     |
| Inspection and testability                                                     | Direct argv, stdio, child signals, JSONL, and strict schema are deterministic to fake; live validation targets a disposable fixture                                                                                                          | Event compatibility is checked only at the narrow parser boundary                                                                 | App Server can generate version-matched TypeScript or JSON schemas; the TypeScript SDK provides typed APIs                                                                                              | Generated schemas and bidirectional protocol fixtures expand the compatibility/test matrix substantially                                                                                                               | Keep the smaller boundary                                                                                       |

## What migration would buy

App Server adoption would buy Ember one material capability bundle: a live,
bidirectional specialist session in which Ember can observe a context-rich pending
approval, decide or route it while the same turn waits, steer that active turn,
interrupt it through the Codex protocol, and retain richer thread/turn/item
lifecycle evidence. It would also offer generated schemas tied to the installed
Codex version.

That bundle has a clear cost. Ember would own initialization and transport,
request/response correlation, server-initiated requests, subscriptions and event
reduction, pending approval durability, disconnect and restart behavior, protocol
version compatibility, thread retention and cleanup, and supervision of a
long-lived runtime. The semantic boundary would not shrink: Ember would still own
context selection, attributable authority, currentness, effect reconciliation,
report provenance, and final disposition.

The TypeScript SDK would buy a more idiomatic language API and resumable thread
helpers. For the current one-attempt boundary, it would mostly replace a small
audited subprocess invocation with package and wrapper ownership. If Ember later
chooses App Server capabilities, a stable TypeScript SDK that exposes the required
bidirectional surface may be considered as an implementation convenience, but it
should be evaluated against the same protocol requirements rather than adopted
separately.

## Adoption trigger and focused follow-up

Reopen this decision only when an accepted requirement demonstrates at least one
of the following:

1. a specialist must remain suspended while Ember obtains or denies a meaningful
   approval, then continue the **same** attempt;
2. a user or Ember must steer a live turn without cancelling and starting a new
   episode;
3. recovery requires supported reattachment to a retained Codex thread rather
   than a new Ember episode with bounded prior evidence; or
4. durable intermediate progress is necessary for a concrete inspection or
   recovery scenario and the CLI JSONL contract cannot support it reliably.

If triggered, define a focused implementation issue to prototype App Server on a
disposable workspace. It must map server requests and notifications into Ember's
existing episode meanings, preserve AS-DEL-04 uncertainty across interrupt or
disconnect, prove that no approval decision exceeds the live authority envelope,
record exact CLI/protocol versions and generated schemas, and compare deterministic
coverage and operational ownership with the current `exec` adapter. It must not
replace `exec` until the required scenario passes through the richer boundary.

## Conclusion

`codex exec` remains the least sufficient supported integration for Ember's real
specialist requirements. The current gaps are either deliberately safe behavior
(end blocked instead of mediating an approval) or semantic uncertainties that App
Server cannot eliminate. App Server is the justified next surface for a future
live approval or in-turn control requirement; the TypeScript SDK is optional
implementation machinery, not a reason to migrate by itself.
