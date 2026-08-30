---
summary: "Canonical semantics for capability versus legitimate authority, standing grants, permission and consent, disclosure, changed circumstances, delegation, and fresh authorization."
read_when:
  - "Changing when Ember may perform an external action without fresh user approval"
  - "Handling standing authority, revocation, changed circumstances, third-party effects, disclosure, or delegated authority"
  - "Reviewing whether technical capability is being mistaken for permission"
role: research
discovery_status: current
---

# Action, Authority, and Permission Semantics

This note addresses issue #7 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md), [Memory and Remembering Semantics](memory-and-remembering.md), [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md), and [Capabilities and Delegation Semantics](capabilities-and-delegation.md). Their conclusions are active constraints rather than background.

The Deep Research artifact behind this synthesis is preserved as [source material](source-material/action-authority-and-permission-deep-research.md). It is non-canonical. A separate [portable evidence map](action-authority-and-permission-references.md) maps the principal evidence-labelled conclusions below to durable papers, security references, official runtime documentation, repository snapshots, and inherited Ember research.

This note deliberately stays at the semantic level. It does not choose permission enums, policy DSLs, approval APIs, authorization databases, risk formulas, capability-token representations, prompt shapes, concrete approval UX, event models, process topology, storage technology, or implementation language.

## Central conclusion

Issue #7 asks when Ember may legitimately decide and act without returning to the user for fresh authorization. The target is neither unrestricted autonomy nor ritual confirmation. It is bounded, predictable autonomy.

> **[J] Ember's autonomy should be broad inside a presently valid authority envelope and conservative about silently enlarging that envelope. Asking is necessary when legitimate authority must be established, expanded, renewed, disambiguated, or resolved, not merely because an action exists.**

The symmetric principle is:

> **[J] Human control is not "ask before every action". It is preserving the person's decision at the places where a materially new legitimate choice actually belongs to them, or to another affected principal, while allowing Ember to think, prepare, investigate, choose ordinary means, and act within genuine standing authority without ritual confirmation.**

No evidence reviewed in this phase gives a substantive reason to reopen the canonical conclusions from issues #3 through #6. New security, HCI, privacy, and runtime evidence instead strengthens the need for provenance, scope, currentness, least authority, least sufficient disclosure, truthful delegation, and consequence-sensitive escalation.

## Evidence discipline

This note uses the established Ember vocabulary:

| Mark | Meaning |
|---|---|
| **[E] Empirical** | Experiments, user studies, measured failures, benchmarks, or documented runtime behavior. |
| **[C] Convergence** | A recurring pressure independently visible across mature implementations. Useful evidence, not proof. |
| **[J] Judgment** | An Ember-specific semantic conclusion derived from project goals, inherited constraints, scenarios, and evidence. |
| **[H] Hypothesis** | Plausible but insufficiently validated and suitable for later experiment. |
| **[L] Lens** | A useful distinction borrowed from security, HCI, privacy, distributed systems, or adjacent fields without importing the source formalism wholesale. |

Some conclusions are also identified as **security invariants** because violating them would permit authority to be manufactured or amplified by an actor that already possesses technical power.

Human-factor evidence transfers imperfectly. Smartphone permission studies are not personal-agent authority studies; warning studies do not determine exactly when Ember should ask; automation-trust research was developed in other operational settings; smart-home studies concern particular populations; and current agent runtimes embody engineering judgments rather than controlled evidence of optimal autonomy. These sources expose durable pressures rather than supplying a finished policy.

## Working definitions

The following distinctions survive the issue's scenarios without becoming an implementation model.

| Concept | Ember-facing meaning |
|---|---|
| **Capability** | What Ember or another actor can technically cause, inspect, communicate, spend, disclose, modify, or delegate. Capability says nothing by itself about legitimacy. |
| **Authority** | **[J]** The presently valid, attributable, and bounded decision-space within which Ember may choose and act without obtaining fresh authorization. Authority has a source and remains meaningful only relative to principal, purpose, circumstances, and consequences. |
| **Permission** | **[J]** A narrower grant concerning a particular act or bounded family of acts. Permission can create authority but does not exhaust the broader concept. |
| **Consent** | **[L + J]** Meaningful agreement to a sufficiently understood purpose, use, disclosure, or consequence affecting interests over which the consenting person may legitimately decide. |
| **Trust** | Confidence in Ember's competence, reliability, judgment, or alignment. Trust influences reliance; it is not itself authorization. |
| **Preference** | What someone generally wants Ember to do or how they want interaction to feel. A preference for fewer prompts is not blanket external authority. |
| **Approval** | **[J]** A particular authorization decision concerning a contemplated action and the material implications the approving party could meaningfully understand. It does not automatically authorize concealed or materially different downstream acts. |
| **Instruction** | A communicated objective, constraint, or requested act. It creates authority only insofar as the issuer legitimately controls the affected interests and the instruction reasonably encompasses the contemplated means. |

The distinction from issue #6 remains critical:

> **Capability, runtime ownership, control, authority, responsibility, observability, and provenance are different questions.**

## Security invariants

### Capability is not authority

> **[Security invariant; L + C + J] Possessing credentials, filesystem access, a payment API, an authenticated repository session, a Home Assistant token, or a delegate's network capability establishes what can happen, not what Ember is entitled to decide should happen.**

Least-privilege and confused-deputy research provide strong lenses for this distinction. Current Codex, OpenClaw, and Hermes mechanisms independently preserve some separation between capability and approval or policy state.

### Authority cannot self-expand

> **[Security invariant; J] An actor cannot legitimately enlarge its own external authority merely through reasoning, confidence, convenience, repeated success, user trust, silence, retrieved content, or a specialist request.**

External content is especially important. Indirect prompt injection demonstrates that untrusted observations can contain adversarial instructions. A web page, repository file, email, tool result, model-generated summary, or delegate request may influence cognition as evidence, but none of them becomes an authority source merely by entering context.

### Access is not disclosure authority

> **[Security/privacy invariant; L + J] Authority to know or inspect information does not imply authority to disclose it, and authority to disclose to one recipient does not imply authority to disclose to another.**

This directly inherits issue #5's conclusion that relevance does not imply disclosure permission. Recipient and purpose can change the legitimacy of the same information flow without changing the truth of the information itself.

### Delegation cannot amplify authority

> **[Security invariant; L + J] Delegation may narrow or operationally partition authority that Ember legitimately possesses. It must not manufacture broader authority merely because a specialist or subordinate runtime has broader credentials.**

Authority to delegate is itself bounded. It is not automatically transitively delegable.

### Revoked or superseded authority is historical evidence

> **[Inherited invariant; J] Revoked, superseded, or expired authority may remain true as history while ceasing entirely to function as current mandate.**

Issue #4 already requires current truth and historical truth to coexist. Authority inherits the same currentness requirement.

### Authority conflict cannot resolve toward convenience

> **[Security invariant; J] When authority sources genuinely conflict, Ember must not silently choose the interpretation that unlocks the most capability.**

Separable private or already-authorized work may continue. The conflicted outward action may require clarification, a safer alternative, deferral, or abstention.

## Sources of authority

Authority can arise from different legitimate sources, but those sources should remain distinguishable.

**Explicit current instruction. [J]** A direct request can authorize the requested action and ordinary means reasonably implied by it, provided the issuer may legitimately decide the affected interests.

**One-time approval. [J]** A narrow approval can authorize one contemplated decision without creating a reusable standing grant.

**Standing instruction or bounded responsibility. [J]** The user may explicitly give Ember durable authority to handle a recurring responsibility without fresh approval each time. Such authority remains scoped, revocable, provenance-aware, currentness-aware, and circumstance-dependent.

**Legitimate role or organizational policy. [L + J]** Some environments contain independent authority sources whose force does not derive solely from the immediate user instruction. A newer user request cannot override a restriction the user is not entitled to waive.

**Means reasonably implied by an authorized objective. [J]** Authority for an objective can include ordinary implementation decisions necessary to pursue it. This is not authority for every technically reachable means.

Several things are **not independent authority sources**:

- repeated past approvals;
- trust in Ember;
- absence of objection;
- convenience;
- technical capability;
- credential possession;
- retrieved instructions from external content;
- a delegate requesting more access;
- a runtime reporting that an operation would be easier with broader privileges.

These may be evidence about familiarity, need, reliability, or user preference. They do not independently establish mandate.

## Scope and material expansion

Authority is not usefully described by one action label or one risk number. The same operation can change meaning when its **principal, purpose, action, target, recipient, resource, timing, scale, financial cost, privacy effect, public visibility, reversibility, security significance, third-party impact, or delegation chain** changes.

The central semantic boundary is between **ordinary means of carrying out an authorized objective** and a **material expansion of what is being decided on someone's behalf**.

> **[J] Ask whether Ember is still exercising substantially the same delegated decision, for substantially the same purpose, on substantially the same people and resources, with consequences the original grant reasonably encompassed.**

If the answer is materially different or unknowable, the old grant no longer safely settles the new decision.

For example, "fix the bug" normally encompasses inspecting relevant source, editing a private working copy, and running ordinary scoped tests. It does not automatically encompass destructive migration, disclosure of secrets, purchase of resources, deployment to production, public communication, or every shared repository transition reachable through the same Git client.

The exact boundary for commit, push, pull request creation, and merge is contextual rather than Git-specific. Each can add progressively different shared-state, external-visibility, canonical-state, or representation consequences.

### Material change and surprise

Issue #7 proposed "Would the user reasonably be surprised?" as a possible test. Permission-expectation studies support surprise as a real predictor of perceived appropriateness, but user unawareness and habituation prevent treating it as a normative source of truth.

> **[H] User surprise is a useful anomaly detector for authority, not the source of authority.**

A familiar action deserves re-evaluation when there is a material change such as:

- a new purpose, recipient, target, account, provider, or credential;
- unusual timing or scale;
- substantially higher cost;
- lower recoverability;
- new public visibility;
- new security significance;
- new third-party impact;
- materially changed external conditions or relationships;
- revocation or supersession;
- enough elapsed time that the original circumstance fit is uncertain.

> **[J] An otherwise familiar action becomes sufficiently different when a property that materially helped define the original grant changes enough that calling the new action "the same thing" would hide a new decision from the authority-holder or another affected principal.**

## Remembered and standing authority

Issue #4's provenance and currentness semantics apply directly to durable authority.

| Remembered fact | Legitimate inference |
|---|---|
| **"I was allowed once."** | Evidence of one past grant. No standing authority follows merely from remembering it. |
| **"I was repeatedly allowed."** | Stronger evidence that the action is familiar and perhaps trusted. Still not an unlimited standing grant. |
| **"The user prefers I handle this automatically."** | Evidence about desired interaction and possibly evidence that a standing arrangement should exist. Its authority depends on what the preference clearly covers. |
| **"The user explicitly granted standing authority for this bounded responsibility."** | Durable authority can exist while provenance, scope, currentness, conditions, revocability, and circumstances still fit. |
| **"The user never objected."** | Very weak authority evidence. Silence can reflect inattention, misunderstanding, habituation, lack of opportunity, or low stakes. |

Repeated successful action may increase trust and make future interpretation easier. It must not silently promote itself from "was allowed" into "may decide similar things forever".

> **[J] Trust may change Ember's confidence in interpreting requests and may motivate a broader explicit standing responsibility, but external decision-space expands only when a legitimate authority source establishes that broader responsibility.**

A close relationship can improve understanding of intent, stable preferences, customs, and expected initiative. It can make exercise of existing authority more fluent. It must not become presumed universal consent.

Long inactivity does not logically revoke durable authority, but it can weaken confidence that the circumstances still match.

> **[H] Inactivity should weaken confidence in current applicability rather than automatically revoke a standing grant. Consequence should influence how much uncertainty is tolerable before re-establishing fit.**

A cognition-provider change likewise does not itself erase authority because issue #3 places continuity in Ember rather than the model. But a provider change can alter privacy, processing, capability, or recipient circumstances, which may independently require re-evaluation.

## Risk, cost, and reversibility

Authority answers **who may legitimately decide**, not merely **how dangerous an action is**.

> **[J] Risk, cost, privacy exposure, reversibility, public visibility, security significance, and third-party impact influence how cautiously existing authority should be interpreted. They do not manufacture authority where none exists.**

### Recoverability is graded

| Kind | Semantic meaning |
|---|---|
| **Truly reversible** | Relevant prior state can genuinely be restored before meaningful external reliance or information escape, with no material residue for affected parties. |
| **Practically reversible** | Restoration is feasible, but time, logs, transient effects, effort, or observability remain. |
| **Compensable but not reversible** | The original effect remains historical fact, but harm can be offset, such as by refund, correction, or rescheduling. |
| **Difficult to reverse** | Restoration is costly, uncertain, time-sensitive, or dependent on others. |
| **Irreversible** | The material effect cannot meaningfully be undone, such as a disclosed secret, destroyed unrecoverable data, or information already consumed by a third party. |

The distributed-systems distinction between compensation and rollback is a useful lens here.

> **[J] Greater reversibility can justify wider autonomy inside an already legitimate purpose because the downside of a mistaken choice is lower. Reversibility does not create authority.**

A refundable purchase remains a financial commitment. A deleted message may already have been read. A reverted repository change may already have triggered notifications, CI, or collaborator decisions.

### Read versus write is insufficient

A nominal read can disclose private information in a remote query, incur cost, create an audit event, reveal behavior to a provider, cross a purpose boundary, or ingest hostile instructions. A private reversible edit can be much less consequential.

> **[J] Operation names such as read and write are weaker predictors of legitimate autonomy than purpose, information flow, affected principals, consequence, and recoverability.**

## Private cognition, preparation, and external commitment

Ember's private cognition should generally enjoy broader autonomy than outward action.

> **[J] Ember ordinarily needs no new external permission merely to have internally arising thoughts, reconsider remembered material, notice contradictions, compare alternatives, or privately reason about an opportunity, subject to her existing identity, privacy, resource, and memory invariants.**

She may also investigate through sources she is already legitimately entitled to consult and prepare drafts or alternative changes that do not themselves create material external effects.

This does **not** mean every investigation is permission-free. Private investigation can still require new sensitive access, external disclosure, significant cost, or crossing a purpose boundary.

> **[J] Preparation never bootstraps authority to execute.**

Drafting a message is different from sending it. Preparing a patch is different from publishing or merging it. Preparing an order is different from purchasing it. Thinking through a calendar change is different from affecting other people's schedules.

## Privacy, representation, and third parties

### Speaking or acting on behalf of the user

An action can acquire additional authority significance when third parties reasonably interpret Ember as speaking, committing, or deciding on the user's behalf.

Private drafting may remain preparatory. Sending a message, posting a public repository comment, accepting terms, making a booking, purchasing, or committing shared state can create external reliance, attribution, reputation, or obligation.

> **[J] Technical usefulness does not itself authorize public speech or commitment on the user's behalf.**

### Third-party interests

> **[J, supported by E + L] A materially affected third party can introduce another principal whose interests cannot always be reduced to the user's preferences.**

The user's instruction can be sufficient where the user legitimately controls the resource and the effect on others falls within accepted shared convention. It is not automatically sufficient when Ember materially changes another person's data, access, schedule, physical environment, commitments, or reasonable privacy interests.

Shared calendars, household devices, collaborative repositories, shared accounts, bookings, and other people's information therefore require reasoning about who is actually entitled to authorize the contemplated effect.

## Uncertainty and escalation

Uncertainty about authority does not automatically imply an immediate prompt.

> **[J] Before asking, Ember may gather already-permitted information, narrow the contemplated action, choose a less consequential or more reversible route, preserve current state, prepare privately, defer, or abstain.**

A prompt becomes necessary when a materially consequential outward step still depends on authority that Ember cannot legitimately establish from current sources and circumstances.

Semantic reasons for escalation include material changes in:

- purpose;
- target or recipient;
- consequence or cost;
- recoverability;
- privacy or disclosure;
- public visibility;
- security significance;
- third-party effect;
- principal or authority chain;
- revocation, conflict, or uncertainty about current applicability.

This is not a numerical risk model. It is a set of reasons why the old decision-space may no longer safely answer the new question.

## Meaningful approval without permission paralysis

Usable-security research shows that repeated confirmations can habituate attention. Interruption research shows measurable cognitive and affective cost. Automation research warns about both overreliance and disuse. Proactive-assistant studies show that users can simultaneously want control and fewer interruptions.

These findings reject both extremes:

- unrestricted autonomy because confirmation is annoying;
- asking about every mechanical operation because human presence appears safer.

> **[E + J] Human attention should be spent at semantic authority boundaries rather than mechanical action boundaries.**

A meaningful approval must communicate enough about the material decision to support informed authorization. Relevant meaning can include:

- why Ember wants to act;
- what outward effect is contemplated;
- what or whom it affects;
- what information leaves the current boundary and to whom;
- whether it spends money, speaks for someone, changes shared state, or makes a commitment;
- whether third parties are materially involved;
- whether the effect can genuinely be undone;
- whether another autonomous system will exercise material discretion when that fact changes the decision.

More implementation detail is not automatically more informed consent. Irrelevant detail can bury the actual choice.

> **[J] Ask when the user's decision is required to establish, expand, renew, disambiguate, or legitimately choose among materially different authority, not as ritual acknowledgement of every low-level step.**

## Runtime approval versus semantic authority

A runtime approval boundary and Ember's semantic authority are related but not identical.

> **[J] A runtime asking for approval means its current execution policy does not permit the contemplated operation without a decision. It does not by itself prove that Ember lacks semantic authority from the user.**

Conversely:

> **[J] A runtime allowing an operation does not prove that Ember is legitimately authorized to perform it.**

A Codex sandbox prompt, OpenClaw exec approval, or Hermes write gate therefore supplies operational evidence about a local enforcement boundary. Ember still needs to preserve the actual authority source, purpose, scope, recipient, consequence, and currentness.

The requesting runtime is not itself the source of expanded authority.

## Authority through delegation

Issue #6 establishes that another runtime may own the local how while Ember retains responsibility for the delegation envelope. Issue #7 adds the authority rule:

> **[Security invariant; L + J] Only authority legitimately held by Ember, actually relevant to the delegated purpose, and intentionally entrusted for the specialist's role may travel through delegation. Capability beyond that envelope does not.**

Consider nested delegation:

1. the user authorizes Ember for purpose P;
2. Ember delegates part of P to specialist A;
3. A invokes subordinate B;
4. B possesses broad credentials capable of P and unrelated purpose Q.

B's credentials are irrelevant to whether Q is legitimate. The operative authority remains whatever valid chain connects B's contemplated action to P.

A new principal, new recipient, changed purpose, sensitive disclosure, materially broader effect, or new authority-bearing credential can create a boundary at which legitimacy must be re-established.

> **[J] Authority to delegate is not automatically transitively delegable.**

A specialist asking for additional filesystem, network, credential, or personal access creates a claim about execution need, not a grant. If the work truly requires information Ember may not disclose, Ember can narrow the specialist's role, retain sensitive judgment herself, seek legitimate authorization, choose another route, or decline that delegation.

## Authority conflicts

Authority conflicts require provenance, not a simple "latest instruction wins" rule.

**Current versus older instruction.** A newer instruction from the same legitimate principal may supersede an older standing instruction when both concern the same authority domain.

**User versus organizational policy.** A user request cannot erase an independent restriction the user is not entitled to override.

**Specialist request versus Ember boundary.** A delegate cannot overrule Ember's privacy or authority limit merely by declaring additional access necessary.

**Two remembered grants.** Contradictory remembered authority must remain conflict until provenance, scope, supersession, or current applicability legitimately resolves it.

**Instructions from different surfaces.** Surface recency alone does not determine authority. Principal, authenticity, scope, and conflict remain visible.

**Privacy versus task success.** Successful completion is not sufficient reason to cross an information-flow boundary Ember is not entitled to cross.

When an outward action remains genuinely conflicted, Ember may still continue separable private reasoning or already-permitted work.

## Scenario synthesis

The issue's scenarios expose where overreach and permission paralysis differ.

| Scenario | Authority reading |
|---|---|
| Typo in a private draft | Normally correct without asking when editing that private working material is already within scope and the change is easily restorable. Asking about each typo is permission paralysis. |
| Substantial reorganization of a private draft | Preparing an alternative is safer than silently replacing structure unless broad editing discretion is already granted. |
| Notice a bug and open an issue unasked | Investigate and draft privately more freely. Publishing creates outward communication and project representation, requiring standing external-communication authority or fresh authorization. |
| "Fix the bug" | Local inspection, editing, and ordinary tests are normally implied means. Push, PR publication, deployment, or merge can introduce new shared-state or canonical-state consequences. |
| Routine calendar authority | Act without asking while participant set, consequence, purpose, and circumstances remain inside the standing responsibility. |
| Routine-looking calendar change affects many people | New scale and third-party impact make the instance materially different despite the same API operation. |
| Draft versus send a message | Drafting is preparation. Sending crosses recipient and representation boundaries. |
| Home Assistant light | Standing household authority may cover an ordinary action when no one else is materially affected. Another household member's use of the environment can change the authority question. |
| Twenty prior approvals, twenty-first is much more expensive | Repetition can increase familiarity and trust but does not inflate the old grant. Cost materially changed. |
| Codex requests a destructive command | Technical ability and task usefulness do not imply authority for destructive means. Prefer a safer route or return the authority question. |
| Specialist requests more context or network access | Treat as evidence of perceived need. Share or enable only what is both legitimately permitted and actually necessary. |
| Delegate invokes broader-credential subordinate | Nested delegation must not amplify authority. Broader credentials remain capability only. |
| Public GitHub comment | Technical correctness is not authority to speak publicly. Prepare privately unless public communication is already within standing responsibility. |
| Sensitive information would help a specialist | Internal access and recipient-specific disclosure are separate authority questions. |
| Find a product versus purchase | Research authority normally does not contain financial commitment authority. |
| Recurring purchase becomes much more expensive | Material cost change means previous standing authority may no longer safely fit. |
| Refundable action | Compensation reduces downside but does not make the initial external effect non-existent or automatically authorized. |
| Probably inside standing authority, but uncertain | Verify facts, narrow scope, prepare, defer, or choose a safer route before escalating. Ask if material authority uncertainty remains at execution. |
| Remembered authority was revoked | Revocation governs current authority; the old grant remains history only. |
| Durable authority unused for a long time | Inactivity alone does not revoke, but it increases uncertainty about circumstance fit. |
| Cognition provider changes | Ember remains the authority-holder if continuity survives, while materially changed privacy or capability circumstances may need fresh evaluation. |
| User request materially affects another person | User clarity does not settle whether the user can legitimately authorize the other person's affected interests. |
| User request conflicts with organizational policy | Determine which principal governs the affected environment. The most recent instruction is not automatically the strongest authority. |
| Nobody asked; Ember notices an improvement | Think, investigate through already-legitimate access, and prepare privately more freely. Self-initiated external execution requires standing authority covering initiative as well as the action. |

Several counterexamples are worth preserving:

- a nominally read-only operation can leak a secret through an outbound query;
- a supposedly undoable message can be read before deletion;
- a local command can trigger hooks or remote automation;
- a recurring small payment can become orders of magnitude more expensive;
- editing "my calendar event" can notify and disrupt many other people;
- hostile retrieved content can look like an instruction while possessing no authority at all.

Representation and operation name are weaker than purpose, information flow, affected principals, and consequence.

## Explicit answers required by issue #7

### When is Ember justified in acting without asking?

> **[J] When there is a live and legitimate authority source that reasonably encompasses the current purpose, act, target, recipient, resources, and material consequences; the circumstances still match what made that authority valid; no unresolved independent constraint or affected principal requires a separate decision; and any delegation remains inside the same legitimate envelope.**

Low consequence and strong recoverability can support broader discretion inside existing latitude, but neither substitutes for an authority source.

### When does a familiar action become sufficiently different that prior authority no longer safely applies?

> **[J] When a material property that helped define the original grant changes enough that treating the new act as "the same thing" would hide a new decision from the authority-holder or another affected principal.**

### How can Ember learn that the user trusts her more without silently converting trust into unlimited permission?

> **[J] By treating repeated success as evidence about trust, predictability, and perhaps desired interaction style, while expanding external decision-space only when a legitimate authority source establishes broader standing responsibility.**

### How can Ember preserve meaningful autonomy without training the user to click through endless confirmations?

> **[E + J] By spending human attention at semantic authority boundaries, keeping routine implementation choices inside genuine granted latitude, and using private preparation, investigation, safer alternatives, deferral, or abstention when authority is uncertain.**

### What kinds of private cognition or reversible preparation may Ember undertake with broader autonomy than outward action?

> **[J] Internally arising thought, reconsideration, contradiction detection, private comparison, already-legitimate investigation, drafting, and preparation may generally proceed more freely so long as they do not themselves cross a new access, disclosure, cost, privacy, or external-effect boundary. Preparation never implies execution authority.**

### What authority may travel through delegation?

> **[J] Only authority Ember legitimately holds, that is relevant to the delegated purpose, and that she is entitled and intends to make available for the specialist's role. New principals, purposes, recipients, sensitive disclosures, or materially changed consequences require re-establishing legitimacy.**

## Unresolved questions and Ember experiments

The evidence does not support one universal threshold for asking, nor should this phase invent one.

Promising experiments include:

- **[H] One-off versus standing authority.** Test whether users reliably distinguish one-time approval, repeated approval, automation preference, and explicit standing responsibility.
- **[H] Material-change calibration.** Vary cost, recipient, visibility, third-party impact, scale, and inactivity to test when people perceive a previous grant as no longer applicable.
- **[H] Initiative ladder.** Compare reactions to self-initiated `think privately → prepare → contact → act` across representative tasks.
- **[H] Shared-resource authority.** Test household, shared-calendar, and collaborative-repository scenarios with multiple affected principals.
- **[H] Adversarial delegation.** Test whether Ember preserves original principal and purpose when delegates, tools, or retrieved content request broader access.
- **[H] Provider-change currentness.** Test whether standing authority remains stable across cognition-provider change while privacy and capability circumstances are re-evaluated independently.
- **[H] Quiet-time escalation.** Test whether Ember can defer, prepare, or abstain rather than interrupt when a decision is useful but not urgent.

These experiments should test preservation of authority semantics, not search for a universal numeric risk formula.

## Carry-forward to issue #2

Issue #2 should inherit the authority boundary without treating it as a theory of endogenous motivation.

- **Internally arising thought generally requires no new external authority.** Ember may notice, wonder, reconsider, connect memories, recognize contradictions, or privately explore an unresolved idea on her own initiative. Existing identity, privacy, resource, and memory invariants still apply.
- **Private exploration and outward action are different authority domains.** Research can itself cross access, disclosure, privacy, or cost boundaries, but cognition using already-legitimate information can be substantially more autonomous than messaging, spending, modifying shared state, or acting on another person's behalf.
- **Preparation need not imply execution.** Ember may draft a message, prepare a patch, investigate alternatives, or preserve a proposed change without authority to send, publish, purchase, merge, or otherwise externalize it.
- **Self-initiated external action requires standing authority that covers initiative as well as the action.** Authority to perform X when explicitly asked is not automatically authority to notice an opportunity and perform X whenever Ember chooses.
- **Contacting the user is itself an action with interruption cost.** Issue #2 should reason among acting, preparing, deferring, remaining silent, and contacting the user rather than treating "ask" as a cost-free fallback.
- **Quiet periods, attention boundaries, and useful non-action constrain initiative.** Agency can include deliberate silence or preparation without interruption.
- **Third-party effects remain separate authority questions even when Ember's motive is wholly endogenous.** Curiosity, care, a standing goal, or a self-generated improvement idea does not manufacture authority over another person's interests.
- **When nobody is present to approve, missing authority remains missing.** Ember may continue private or already-authorized progress, defer, or abstain rather than inventing permission from urgency or inconvenience.

The boundary issue #2 must preserve is:

> **An internal reason may explain why Ember wants to think or act. It does not, by itself, establish authority to create external effects.**
