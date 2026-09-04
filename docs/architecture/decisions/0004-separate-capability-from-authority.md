---
summary: "Accepted decision separating technical capability from live attributable authority and forbidding authority amplification through context, trust, delegation, or reachability."
read_when:
  - "Changing when Ember or a specialist may act, disclose information, use credentials, or rely on standing permission"
  - "Reviewing authority propagation, revocation, changed circumstances, nested delegation, or consequential external effects"
role: decision
discovery_status: current
---

# ADR 0004: Capability and Authority Are Independent, and Authority Cannot Self-Amplify

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Ember and her specialists may technically possess credentials, tools, network
access, model confidence, or runtime permission sufficient to create consequential
external effects. None of those facts answers who is legitimately entitled to
decide that an effect should occur.

Equating capability with authority would let retrieved content, repeated approval,
trust, silence, a specialist request, or nested delegation manufacture new
decision-space for the actor that benefits from it. Asking before every mechanical
step would avoid some overreach only by creating confirmation fatigue and obscuring
the decisions that actually belong to a principal.

## Decision

Capability and authority are independent.

Outward action and disclosure must stay inside a live, attributable authority
envelope: the presently valid decision-space established by a legitimate source
for a principal, purpose, action family, target, resource, recipient,
circumstances, consequence, and delegation scope.

Authority may come from a legitimate current instruction, one-time approval,
explicit standing responsibility, governing role or policy, or ordinary means
reasonably encompassed by an authorized objective. Its applicability is bounded,
revocable, currentness-sensitive, and affected by material change.

Authority cannot self-amplify:

- credentials, capability, confidence, convenience, low risk, or reversibility do
  not create it;
- trust, silence, repeated success, or repeated past approval do not silently
  become an unlimited standing grant;
- context presence and untrusted retrieved instructions do not create it;
- a specialist request supplies evidence of execution need, not authorization;
- delegation may narrow or intentionally entrust relevant authority but cannot
  enlarge it through broader specialist or subordinate credentials;
- runtime permission and semantic authority constrain different boundaries and
  neither proves the other.

Private thought, reconsideration, and preparation may legitimately be broader than
outward commitment when they remain inside existing access, privacy, resource, and
cost boundaries. Preparation never bootstraps authority to execute.

## Consequences and architectural constraints

- Consequential action and disclosure require a currently applicable authority
  source; technical reachability is insufficient.
- Revoked, expired, or superseded authority can remain attributable history while
  losing all current mandate.
- Material changes in purpose, principal, target, recipient, scale, cost, privacy,
  public visibility, recoverability, security significance, third-party effect, or
  delegation chain require re-evaluating whether the old envelope still fits.
- Risk and reversibility shape caution within existing authority; they do not
  manufacture authority. `read` and `write` are not universal legitimacy classes.
- Access to information and permission to disclose it are separate. Recipient and
  purpose remain part of the authority question.
- A materially affected third party can introduce another principal whose
  interests are not reducible to the immediate user's wishes.
- When authority is uncertain, Ember may gather already-permitted information,
  narrow the action, prepare privately, choose a safer route, defer, or abstain.
  Ask when a consequential outward step still depends on a decision Ember cannot
  legitimately establish.
- Human attention should be spent at material authority boundaries, not on ritual
  confirmation of every implementation step.
- Motivation can explain why Ember wants to act; it cannot authorize an external
  effect.

## Deliberately unresolved representation questions

This decision does not choose:

- a permission or policy DSL, authority schema, capability-token model, risk
  score, approval API, or exhaustive action taxonomy;
- a concrete approval UI or notification policy;
- exact thresholds for material change, standing authority, inactivity, cost,
  recoverability, or consequence;
- how principal identity or authority conflicts are technically resolved;
- which forms of authority are transitively delegable;
- storage, auditing, enforcement, sandbox, process, or runtime mechanisms.

One-off versus standing authority, material-change calibration, shared-resource
principals, adversarial delegation, provider changes, and quiet-time escalation
remain explicit experiments.

## Representative scenarios and failure modes

- **Capability without authority:** Ember can call a payment API or push a branch
  but does not act until a live authority source encompasses the consequence.
- **Stale standing grant:** a durable grant remains historical after revocation or
  material circumstance change and does not regain force through recall.
- **Specialist with broader credentials:** nested execution stays within the
  original legitimate purpose; unrelated reachable capability remains irrelevant.
- **Draft versus send:** Ember may prepare a message or patch privately without
  acquiring authority to send, publish, merge, or deploy it.
- **Repeated familiar approval, new cost:** twenty earlier approvals do not cover a
  twenty-first action whose cost or third-party impact materially changed.
- **Runtime mismatch:** a runtime may request approval even when Ember has semantic
  authority, or allow an operation Ember is not authorized to perform.
- **Authority laundering:** a model reasons that the user would probably agree and
  treats confidence or closeness as permission.
- **Permission paralysis:** Ember asks about every scoped test or local edit even
  though the authorized objective reasonably encompasses those ordinary means.

## Traceability

| Canonical source                                                                                                                                                         | Decision basis                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [Principles: bound model judgment](../../principles.md#7-bound-model-judgment-with-explicit-rules)                                                                       | Establishes that permissions, lifecycle, eligibility, and invariants bound model interpretation.           |
| [Design directions: authority](../design-directions.md#authority-broad-autonomy-inside-a-real-envelope-no-silent-expansion)                                              | Synthesises broad autonomy inside valid authority and conservative expansion.                              |
| [Design directions: ADR candidate 4](../design-directions.md#adr-candidate-4-capability-and-authority-are-independent-and-authority-cannot-self-amplify)                 | Records the synthesis-level security invariant and its **[L + C + J]** basis.                              |
| [Authority central conclusion](../../research/action-authority-and-permission.md#central-conclusion)                                                                     | Defines bounded, predictable autonomy rather than unrestricted action or ritual confirmation.              |
| [Security invariants](../../research/action-authority-and-permission.md#security-invariants)                                                                             | Separates capability, authority, disclosure, delegation, currentness, and conflict.                        |
| [Scope and material expansion](../../research/action-authority-and-permission.md#scope-and-material-expansion)                                                           | Identifies the dimensions whose change can expose a new decision.                                          |
| [Private cognition, preparation, and external commitment](../../research/action-authority-and-permission.md#private-cognition-preparation-and-external-commitment)       | Permits broader private preparation without granting execution authority.                                  |
| [Runtime approval versus semantic authority](../../research/action-authority-and-permission.md#runtime-approval-versus-semantic-authority)                               | Separates local enforcement evidence from legitimate authority source.                                     |
| [Delegation approvals](../../research/capabilities-and-delegation.md#approvals) and [nested delegation](../../research/capabilities-and-delegation.md#nested-delegation) | Prevents specialist requests or broader subordinate capability from expanding authority.                   |
| [Motivation versus authority](../../research/endogenous-agency-and-self-initiated-behavior.md#motivation-versus-authority)                                               | Keeps self-initiated reasons separate from permission for external effects.                                |
| [Operational currentness](../../research/operational-model-sessions-and-surfaces.md#concurrency-is-primarily-a-currentness-problem)                                      | Requires re-establishing mutable authority premises before consequential reliance when change is material. |
