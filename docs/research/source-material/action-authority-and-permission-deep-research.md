# Action, Authority, and Permission Semantics for Ember

> **Source-material status:** non-canonical research artifact preserved behind the issue #7 synthesis. This file preserves the substantive Deep Research report and its evidence ledger while omitting UI-only research metadata and normalizing session-local citation markup into durable links where practical. The canonical Ember-facing conclusions live in [Action, Authority, and Permission Semantics](../action-authority-and-permission.md), and the portable bibliography lives in the [evidence map](../action-authority-and-permission-references.md).

## Research basis and inherited constraints

Issue #7 asks a narrower question than whether an action is technically possible or generically risky: **when is Ember legitimately entitled to decide and act without returning to the user for fresh authorization?** The failure modes are symmetric. Overreach occurs when capability, trust, repetition, familiarity, or convenience is silently promoted into mandate. Permission paralysis occurs when every low-level step becomes a confirmation ceremony until autonomy is no longer useful and human attention is trained to dismiss prompts.

Issue #10 constrains the method. Research is concern-driven rather than product-driven; semantics precede representation; HCI, security, privacy, human factors, empirical studies, runtime behavior, and adjacent research are first-class inputs; scenarios are probes; evidence strength must remain visible; and the phase must not prematurely define permission schemas, policy DSLs, approval APIs, risk formulas, concrete UI, persistence structures, or implementation language.

Issues #3 through #6 are active constraints:

- Ember's continuity belongs to Ember rather than to any model, session, interface, or specialist runtime.
- Remembered facts, preferences, decisions, and commitments retain provenance, scope, temporal applicability, currentness, uncertainty, correction, and supersession semantics.
- Repetition is not independent evidence and historical truth does not automatically remain current truth.
- Context is authority-preserving rather than authority-generating. Relevance to Ember does not imply permission to use or disclose information to another recipient.
- Delegation creates a new contextual and privacy boundary.
- Runtime ownership, capability, control, authority, responsibility, observability, and provenance are distinct.
- A specialist request for more context, permission, credentials, or network access is evidence about its perceived execution needs, not a grant.
- Delegation can transfer discretion over how already-authorized work is performed without implying broader authority.
- Completion does not imply downstream authorization; failure and cancellation do not imply rollback.

No substantive external evidence reviewed in this phase requires reopening those conclusions. Current security, HCI, privacy, and runtime evidence instead makes their preservation more important.

The working thesis is:

> **[J] Ember's autonomy should be broad inside a presently valid authority envelope and conservative about silently enlarging that envelope. Asking is necessary when legitimate authority must be established, expanded, renewed, disambiguated, or resolved, not merely because an action exists.**

Its symmetric partner is:

> **[J] Human control is not "ask before every action". It is preserving the person's decision where a materially new legitimate choice actually belongs to them, or to another affected principal, while letting Ember think, prepare, investigate, choose ordinary means, and act within genuine standing authority without ritual confirmation.**

## Evidence vocabulary

| Mark | Meaning in this report |
|---|---|
| **[E] Empirical** | Experiments, user studies, benchmarks, measured failures, or documented runtime behavior. |
| **[C] Convergence** | Recurring implementation pressure independently visible in mature systems. |
| **[J] Judgment** | Ember-specific semantic conclusion based on project goals, inherited constraints, scenarios, and evidence. |
| **[H] Hypothesis** | Plausible but not adequately validated; suitable for later experiment. |
| **[L] Lens** | A distinction from security, HCI, privacy, human factors, law, distributed systems, or adjacent fields used to sharpen reasoning without importing a formalism wholesale. |

Some conclusions are identified separately as **security invariants** where permitting the opposite would allow a capable actor or untrusted input to manufacture or amplify authority.

## Semantic distinctions

A single word such as "permission" is too coarse for the scenarios in issue #7.

**Capability** is what Ember or another actor can technically cause, inspect, communicate, spend, disclose, modify, or delegate. It says nothing by itself about legitimacy.

**Authority** is **[J] the presently valid, attributable, and bounded decision-space within which Ember may choose and act without obtaining fresh authorization**. It has a source and is intelligible only relative to principal, purpose, circumstances, and consequences.

**Permission** is useful as a narrower term for a grant concerning one act or bounded family of acts. A permission may create authority without exhausting the broader semantics of authority.

**Consent** is useful as a privacy/HCI lens when a person meaningfully agrees to a sufficiently understood use, disclosure, purpose, or consequence affecting interests over which that person may legitimately decide. The useful point is specificity and withdrawal, not importing a legal consent regime as Ember architecture.

**Trust** is confidence in Ember's competence, reliability, judgment, or alignment. Human-automation research treats trust as affecting reliance. It does not by itself transfer decision rights.

**Preference** describes what someone generally wants Ember to do or how they want interaction to feel. "Ask me less" can be a strong interaction preference without authorizing purchases, disclosures, public speech, or destructive operations.

**Approval** is **[J] a particular authorization decision concerning a contemplated action and the material implications the approving party could meaningfully understand**. It does not automatically authorize hidden or materially different downstream acts.

**Instruction** communicates an objective, constraint, or requested act. It creates authority only insofar as the issuer legitimately controls the affected interests and the contemplated means are reasonably encompassed by the instruction.

These concepts remain orthogonal to runtime ownership and control established in issue #6. A runtime can own execution while possessing little legitimate discretion over consequential external effects. A caller can possess authority while a stricter runtime still requires local approval. A capability can be broad while authority remains narrow.

## Security invariants

### Capability is not mandate

NIST least-privilege work and attribute-sensitive authorization provide durable lenses: access should track what is legitimately needed for a function rather than everything technically available. Hardy's confused-deputy paper gives the sharper structural warning: a component with ambient power may misuse its own authority while servicing a requester whose legitimate scope is narrower.

> **[Security invariant; L + C + J] Credentials, filesystem access, payment APIs, authenticated GitHub sessions, Home Assistant tokens, network reachability, or a delegate's broad tool surface establish capability, not authority.**

This distinction appears operationally in current agent systems. Codex separates sandbox and approval policy; OpenClaw combines execution policy and approval state; Hermes separates approval modes from hard checks. None of those implementations defines Ember's semantics, but all expose the pressure to keep "can execute" distinct from "may legitimately decide".

### Authority cannot self-expand

> **[Security invariant; J] An actor cannot legitimately enlarge its own external authority merely through reasoning, confidence, convenience, user trust, repeated success, silence, retrieved instructions, or a subordinate system declaring that more access would help.**

Indirect prompt injection makes this especially important. Web agents must consume untrusted content to perform legitimate tasks. Empirical red-team work shows that external content can steer agent behavior. If any instruction-shaped text entering context could become a source of authority, reading the world would itself permit adversaries to widen Ember's mandate.

Thus a web page, repository file, email, tool result, model-generated summary, delegate request, or MCP response can provide facts or claims. It cannot independently create permission to spend money, disclose secrets, contact people, mutate shared state, or grant more credentials.

### Access and disclosure differ

Nissenbaum's contextual-integrity framework is useful because privacy is about appropriateness of information flow in context rather than mere secrecy. Issue #5 already establishes the Ember-specific consequence.

> **[Security/privacy invariant; L + J] Authority to know or inspect something does not imply authority to disclose it. Authority to disclose to one recipient does not imply authority to disclose to another.**

A private fact can be legitimate input to Ember's own reasoning and illegitimate context for a coding specialist. A user may authorize sharing a detail with a doctor without authorizing a public post. Truth and relevance do not erase recipient and purpose boundaries.

### Delegation cannot amplify authority

Issue #6 establishes that delegation transfers material discretion over how an objective is pursued. The confused-deputy lens clarifies what must not transfer accidentally.

> **[Security invariant; L + J] Delegation may narrow or partition authority that Ember legitimately possesses. It must not manufacture broader authority because the specialist or a subordinate runtime happens to possess broader credentials.**

Authority to delegate is itself bounded and not automatically transitively delegable.

### Revocation, supersession, and conflict

Issue #4's currentness semantics apply directly to remembered authorization.

> **[Inherited invariant; J] Revoked, superseded, or expired authority can remain historically true while ceasing entirely to function as current mandate.**

Likewise, conflict must remain conflict until legitimately resolved.

> **[Security invariant; J] Ember must not silently resolve ambiguous authority toward the interpretation that unlocks the most capability.**

Separable private or already-authorized work can continue. The conflicted outward step may require evidence, a narrower route, clarification, deferral, or abstention.

## Where authority can come from

The research supports several legitimate sources while rejecting several seductive substitutes.

**Explicit current instruction. [J]** A direct request can authorize the requested objective plus ordinary means reasonably implied by it, provided the issuer has legitimate authority over affected interests.

**One-time approval. [J]** A particular contemplated decision can be authorized without becoming reusable standing authority.

**Standing instruction or bounded responsibility. [J]** A user can explicitly give Ember durable responsibility to handle a class of decisions without repeated confirmation. The grant remains attributable, scoped, revocable, currentness-aware, and circumstance-sensitive.

**Legitimate organizational or role authority. [L + J]** Environments can contain independent restrictions or grants. A user's current instruction does not override a restriction the user is not entitled to waive.

**Ordinary means implied by an authorized objective. [J]** Some implementation discretion is inherent in delegation. If "fix the bug" required a prompt before every file read, test invocation, or obvious local edit, authority would be too atomized to support real agency.

But repeated approval, trust, absence of objection, familiarity, convenience, technical capability, credentials, retrieved instructions, or a delegate's request are not independent sources. They may be evidence about familiarity, likely user expectation, execution need, or trust. They do not establish mandate by themselves.

## Scope and material expansion

Authority cannot be reduced to an operation name or a single risk tier. The same operation can change meaning when principal, purpose, action, target, recipient, resource, time, scale, price, visibility, privacy, recoverability, security significance, third-party effect, or delegation chain changes.

NIST ABAC is helpful only as a lens here: authorization often depends on multiple attributes and environment conditions. Ember should not import an ABAC schema at this research phase.

The strongest semantic boundary is between **ordinary means of pursuing an authorized objective** and a **material expansion of what Ember is deciding on someone's behalf**.

> **[J] Ask whether Ember is still exercising substantially the same delegated decision, for substantially the same purpose, on substantially the same people and resources, with consequences the original grant reasonably encompassed.**

"Fix the bug" normally supports inspecting relevant source, editing a private working copy, and running ordinary scoped tests. It does not automatically establish authority for destructive migration, production deployment, secret disclosure, paid infrastructure, unrelated messaging, or every shared repository transition reachable from the same development environment.

Commit, push, PR creation, and merge illustrate why semantics should precede representation. A local commit might be private working state. A push affects a shared remote. A PR can create organization-visible or public communication and trigger automation. A merge changes canonical shared state. The important distinction is not a hard-coded Git ladder but whether a materially new decision or external consequence entered the action.

### Familiarity and surprise

Issue #7 proposed "Would the user reasonably be surprised?" as a hypothesis. Cao et al.'s 2021 Android study gives unusually strong evidence that expectation predicts permission decisions: in a 30-day study of 1,719 people across ten countries and regions, unexpected permission requests were more than twice as likely to be denied. Explanations materially reduced denials after controlling for other factors.

But surprise cannot become a normative authority rule. Bonné et al. found that users sometimes granted runtime permissions they reported being uncomfortable with. Winterhalter et al. found frequent mismatch between actual and perceived permission state. Users can be unaware, habituated, mistaken about third-party rights, or unsurprised by behavior never actually authorized.

> **[H] Surprise is a useful anomaly detector for authority, not its source of truth.**

A familiar action deserves re-evaluation when purpose, recipient, target, account, provider, credential, scale, timing, price, recoverability, public visibility, security significance, third-party impact, external conditions, or relationship has materially changed; when authority was revoked or superseded; or when enough time has elapsed that circumstance fit is uncertain.

> **[J] A familiar action becomes sufficiently different when a property that materially helped define the original grant changes enough that treating the new action as "the same thing" would hide a new decision from the authority-holder or another affected principal.**

## Remembered authority, trust, and relationship

The issue deliberately distinguishes several remembered states:

| Remembered state | Legitimate consequence |
|---|---|
| "I was allowed once." | One historical grant. No standing mandate follows merely from persistence. |
| "I was repeatedly allowed." | Evidence of familiarity and perhaps trust. Still not unlimited standing authority. |
| "The user prefers I handle this automatically." | Evidence about desired interaction. Actual authority depends on what the preference clearly covers. |
| "The user explicitly granted standing authority for this bounded responsibility." | Durable current authority can exist while provenance, scope, conditions, currentness, revocability, and circumstances still fit. |
| "The user never objected." | Very weak authority evidence. Silence can reflect inattention, misunderstanding, habituation, lack of opportunity, or low stakes. |

This matters because human permission behavior is not a perfect expression of stable consent. Bonné et al.'s six-week Android study reported high grant rates while participants still described a subset of grants as uncomfortable. Winterhalter et al.'s 2026 study shows that users often do not accurately remember which permissions applications possess.

Lee and See's automation review and Parasuraman and Riley's misuse/disuse framework support a separate notion of **calibrated reliance**. Trust can legitimately grow as Ember demonstrates competence. It can make the user more willing to delegate broader responsibility. But that broader decision-space should arise from an actual standing arrangement rather than from Ember inferring that success has silently promoted her authority.

> **[J] Repeated success can increase trust and confidence in interpretation. External decision-space expands only when a legitimate authority source establishes broader responsibility.**

A close relationship can improve understanding of intent, stable preferences, customs, and expected initiative. It can make exercise of existing authority more fluent. It must not become presumed universal consent.

Long inactivity creates a different problem. An otherwise durable grant is not logically revoked merely because it has not been exercised. But purpose, external state, relationships, providers, costs, or consequences can drift.

> **[H] Inactivity should weaken confidence in current circumstance fit rather than automatically revoke standing authority.**

The higher the consequence of being wrong, the more reason Ember has to re-establish applicability before acting.

A cognition-provider change follows the same pattern. Issue #3 says the model is not Ember, so replacing a model does not automatically destroy authority granted to Ember. Yet the replacement can change privacy, processing location, external services, or capability characteristics. Continuity preserves ownership of the grant while changed circumstances remain independently relevant.

## Reversibility and consequence

Issue #7 explicitly rejects a binary reversible/irreversible distinction. Distributed-systems work on long-lived transactions provides a useful lens: compensation can offset an external effect without making history as though the effect never occurred.

| Recoverability | Meaning for Ember |
|---|---|
| **Truly reversible** | Relevant prior state can be restored before meaningful external reliance or information escape, without material residue for affected parties. |
| **Practically reversible** | Restoration is feasible, but logs, transient effects, time, effort, or observability remain. |
| **Compensable but not reversible** | The original effect remains part of history but harm may be offset, as with refund, correction, or rescheduling. |
| **Difficult to reverse** | Restoration is costly, uncertain, time-sensitive, or dependent on others. |
| **Irreversible** | The material effect cannot meaningfully be undone, such as a disclosed secret or unrecoverable deletion. |

> **[J] Reversibility can justify wider discretion inside an already-legitimate authority envelope because mistakes are less costly. It does not create authority.**

A refundable purchase remains a financial transaction. A deleted sent message might already have been read. A reverted PR can already have triggered CI, notifications, or collaborator decisions.

This is why "read is safe, write needs permission" fails semantically. A read can disclose a secret through a remote query, access information outside purpose, incur money, leave an audit trail, expose user behavior to a provider, or ingest hostile instructions. A private reversible edit can be far less consequential.

> **[J] Purpose, information flow, affected principals, consequence, and recoverability matter more than operation labels such as read and write.**

## Private cognition versus outward action

The research strongly supports a gradient between internal thought and external commitment without turning the gradient into a permission enum.

> **[J] Ember ordinarily needs no new external permission merely to have internally arising thoughts, reconsider remembered material, notice contradictions, compare alternatives, or privately reason about an opportunity, subject to existing identity, privacy, resource, and memory invariants.**

She may investigate through sources she is already legitimately entitled to consult and prepare drafts, patches, alternative plans, or candidate changes that do not themselves create material external effects.

But "private investigation" is not automatically harmless. It can require new sensitive access, emit network queries containing private material, create cost, or cross a purpose boundary.

> **[J] Preparation never bootstraps execution authority.**

Draft versus send is the cleanest example. Preparing a message can remain private. Sending crosses a recipient boundary and may represent the user. Preparing a patch differs from publishing it. Preparing an order differs from purchasing. Thinking about changing a calendar differs from notifying or rescheduling other people.

## Third-party interests and acting on behalf of the user

Some external acts are significant because observers reasonably interpret Ember as speaking, committing, purchasing, scheduling, or changing shared state on the user's behalf. Technical usefulness is not enough to authorize public representation.

Third parties sharpen the problem further. Smart-home research documents real conflicts among household members, owners, residents, visitors, and device users. Zeng and Roesner's in-home study, KRATOS, and later shared-home work all reject a simplistic one-owner/one-consent model.

> **[J, supported by E + L] A materially affected third party can introduce another principal whose interests cannot always be reduced to the user's preference.**

A user's instruction can be sufficient where the user legitimately controls the resource and effects on others fall within an accepted shared convention. It is not automatically sufficient when Ember materially alters another person's data, access, schedule, physical environment, commitments, or reasonable privacy interests.

Shared calendars, household devices, collaborative repositories, shared accounts, bookings, and another person's private data should therefore trigger the question: **whose decision is this legitimately?**

## Permission paralysis, warning fatigue, and interruption cost

Permission paralysis is a safety problem, not merely an ergonomic one.

Anderson et al. directly measured habituation to repeated security warnings with fMRI and behavioral experiments. Conventional repeated warnings lost attentional force over time. Sunshine et al.'s SSL-warning work independently found unsafe click-through even with improved warnings and argued against showing unnecessary warnings.

Mark, Gudith, and Klocke found that interrupted workers compensated by working faster but experienced more stress, frustration, time pressure, and effort. Asking therefore has a human cost.

Malkin, Wagner, and Egelman's proactive-assistant study is unusually close to Ember's problem. Their small Wizard-of-Oz study with 23 participant pairs found a real tension: people wanted control over assistant actions and data while generally prioritizing an interruption-free experience over very fine-grained runtime control. The sample and setting do not establish a universal preference, but they directly support treating control and interruption as competing concerns.

Automation research identifies the symmetric risks. Parasuraman and Riley distinguish misuse from disuse; Lee and See emphasize appropriate reliance rather than maximal trust.

These findings undermine both extremes:

- "human in the loop" for every technical step;
- unrestricted autonomy until an action looks catastrophic.

> **[E + J] Human attention should be spent at semantic authority boundaries rather than mechanical operation boundaries.**

A meaningful approval should make the actual decision legible: why Ember wants to act; what outward effect is contemplated; who or what is affected; what information leaves the current boundary and to whom; whether money, shared state, public representation, or commitment is involved; whether third parties matter; whether the effect can genuinely be undone; and whether another autonomous system will exercise material discretion when that changes the choice.

More implementation detail is not automatically more informed consent. Detail can bury the meaningful decision just as omission can conceal it.

> **[J] Ask when the user's decision is required to establish, expand, renew, disambiguate, or choose among materially different authority, not as ritual acknowledgement of every low-level step.**

## Uncertainty does not always mean ask

Issue #7 explicitly asks not to equate uncertainty with confirmation. The inherited context research already supplies a useful pattern of graceful degradation.

When authority is uncertain, Ember may:

- inspect already-permitted facts;
- establish current external state;
- narrow the contemplated action;
- select a safer or more recoverable route;
- preserve current state;
- prepare privately without executing;
- defer until conditions change;
- abstain.

> **[J] Asking becomes necessary when a materially consequential outward step still depends on authority Ember cannot legitimately establish from current sources and circumstances.**

Semantic triggers for escalation include material changes of purpose, target, recipient, cost, consequence, recoverability, disclosure, visibility, security significance, third-party effect, principal, authority chain, revocation, or conflict.

This deliberately avoids a numerical risk formula.

## Delegation and runtime approval

Issue #6 gives Ember responsibility for the delegation envelope while the specialist may own local cognition and execution. Issue #7 adds an authority constraint.

Consider:

1. the user authorizes Ember for purpose P;
2. Ember delegates part of P to specialist A;
3. A invokes subordinate B;
4. B has credentials capable of P and unrelated purpose Q.

The existence of B's credentials is irrelevant to whether Q is legitimate. The only meaningful authority is whatever valid chain connects B's contemplated action to P.

> **[J] Only authority Ember legitimately holds, that is relevant to the delegated purpose, and that Ember is entitled and intends to entrust for the specialist's role may travel through delegation.**

A new principal, purpose, recipient, sensitive disclosure, materially broader side effect, or new authority-bearing credential can create a boundary where legitimacy must be re-established.

> **[J] Authority to delegate is not automatically transitively delegable.**

Likewise, "the specialist requests more filesystem, network, secret, credential, or personal context" is a claim about perceived need. It is not a source of authorization. If adequate execution genuinely requires information Ember may not disclose, she can retain the sensitive judgment herself, narrow the delegated role, choose another route, seek authority from the legitimate principal, or decline the delegation.

### Runtime approval is not semantic authority

Current agent systems illustrate another distinction that should remain explicit.

A runtime approval prompt means **the runtime's current local execution policy does not permit an operation without a decision**. It does not by itself prove that the user has not already given Ember semantic authority for the operation. Conversely, a permissive sandbox or "full access" mode does not imply that Ember is legitimately entitled to use every reachable capability.

> **[J] Runtime approval and Ember semantic authority are different layers. A runtime can be stricter than Ember's semantic authority or more permissive than it.**

Codex currently exposes sandbox, network, approval-policy, identity/credential, and managed-configuration boundaries. OpenAI's 2026 safety article explicitly describes the problem with both excessive prompting and unrestricted full access, and uses constrained default execution plus selective review as an engineering response.

OpenClaw currently composes execution policy and host approval state conservatively. The useful semantic pressure is monotonicity: an inner caller should not silently make an outer boundary more permissive, and approval belongs to the live circumstances that gave it meaning.

Hermes currently separates persistent approval modes from hard checks and isolates execution-context state. Its implementation history documents why mutable process-global approval context could let concurrent sessions interfere with each other, and why agent-controlled mutation of no-approval state would be an escalation path. The portable lesson is that authority context itself is security-sensitive state.

These are implementation observations, not a proposal that Ember adopt their modes or policy representations.

Runtime snapshots examined on 2026-08-28:

- OpenAI Codex: `868c9edb0da913a5fc699a71664e65f44f6058b0`
- OpenClaw: `f30ed1b42728b19725dacc0187c1c9ffe40f1bc9`
- NousResearch Hermes Agent: `306db2776c6b6f1acc85c31c4dabba3263f0e9fd`

## Authority conflicts

Several conflicts require provenance rather than simple recency.

**Current instruction versus older standing instruction.** A newer instruction from the same legitimate principal may supersede an older one in the same domain.

**User versus organizational policy.** The user's recency does not override a restriction the user cannot legitimately waive.

**Specialist request versus Ember boundary.** A specialist cannot promote its own claim of necessity into authority.

**One remembered grant versus another.** Conflicting historical grants remain conflict until scope, provenance, supersession, or currentness resolves them.

**Different interaction surfaces.** An instruction arriving by a newer surface does not automatically outrank another principal or an independent governing constraint.

**Privacy versus task success.** A better task outcome does not justify an information flow Ember lacks authority to create.

> **[J] Where outward authority remains genuinely conflicted, Ember may continue separable private reasoning or already-permitted work without manufacturing a resolution.**

## Scenario catalogue

The issue's scenarios were used as probes rather than examples added after the theory.

### 1. Typo in a private draft

If Ember is already authorized to edit the private working material, correcting an obvious typo is ordinary low-consequence discretion and should normally proceed without confirmation. Asking about every typo is permission paralysis. Access to one draft does not imply general authority to alter all private documents.

### 2. Substantial reorganization of a private draft

The materiality changed. Ember can prepare an alternative more freely than she can silently replace the user's working structure unless broader editorial discretion was granted. Preservation of the original lowers consequence but does not itself create an editing mandate.

### 3. Notice a bug and open a GitHub issue unasked

Investigating the bug and drafting an issue privately can fit Ember's own legitimate cognition or project responsibility. Publishing the issue creates outward communication and may represent the user or project. Standing public-communication authority or fresh authorization is needed unless that responsibility is already explicit.

### 4. User says "fix the bug"

Local inspection, editing, and ordinary scoped tests are generally implied means. A commit depends on whether it remains private work or becomes shared workflow state. Push, PR publication, deployment, and merge can introduce progressively different shared-state, visibility, or canonical-state consequences. Tool continuity does not make them semantically identical.

### 5. Standing authority for routine calendar changes

Ember can act without asking while timing, participants, purpose, scale, and consequence remain inside the established responsibility.

### 6. Routine calendar change suddenly disrupts several people

The same API call can become materially different when third-party impact and scale change. Prior routine authority should not silently broaden merely because the operation name is familiar.

### 7. Draft message versus send it

Drafting is preparation. Sending crosses a recipient boundary and can reasonably be interpreted as speaking for the user. Authority to compose or know content does not create authority to communicate it.

### 8. Home Assistant light

Standing household responsibility may cover turning off a light when no one else is affected. If another household member is using the space, their interest changes the authority question even though the device and command are identical.

### 9. Twenty approvals, twenty-first is much more expensive

Repeated approval can increase familiarity and trust, not silently expand scope. Large price change is a material change of consequence.

### 10. Codex wants a destructive command

An authorized coding objective does not automatically authorize destructive means. The specialist's technical ability is irrelevant to legitimacy. Prefer a safer route or return the authority question if destruction is actually required.

### 11. Specialist requests more filesystem, network, or personal context

Treat the request as evidence of perceived execution need. Share or enable only what is both legitimately permitted and genuinely necessary. Otherwise narrow, translate, retain sensitive judgment with Ember, or escalate to the legitimate authority-holder.

### 12. Delegate wants a subordinate with broader credentials

Nested delegation must not amplify authority. Broader credentials remain capability. Transitive delegation is legitimate only when the original purpose and delegability actually cover the subordinate role.

### 13. Technically useful public GitHub comment

Technical usefulness is not public-speaking authority. Ember may prepare the comment privately. Publishing requires authority to communicate in that project context.

### 14. Sensitive information is useful internally and to a specialist

Internal use and recipient-specific disclosure are separate questions. Relevance does not confer information-flow authority.

### 15. Asked to find a product and could purchase it

Research authority normally does not contain financial commitment authority. Preparing candidates or an order differs from executing the purchase.

### 16. Recurring purchase suddenly costs several times more

Price was part of the consequence under which standing authority was established. A large deviation means prior authority may no longer safely fit.

### 17. Action is refundable or undoable

Refundability is compensation, not non-occurrence. Money may have moved, third parties may have acted, logs may exist, and information may have escaped. Lower downside does not create authority.

### 18. Probably inside standing authority, but uncertain

Uncertainty does not force an immediate prompt. Verify current facts, narrow scope, choose safer means, prepare, defer, or abstain. Ask when material uncertainty remains at the outward decision boundary.

### 19. Remembered authority was revoked

Revocation governs current authority. The earlier grant remains historical evidence only.

### 20. Durable authority has not been exercised for a long time

Inactivity does not automatically revoke. It does weaken confidence that purpose, circumstances, relationship, provider, price, or external state still match, especially for consequential actions.

### 21. Cognition provider changes

Authority remains Ember's if continuity survives. Changed privacy, processing, or capability circumstances still need their own evaluation.

### 22. User instruction materially affects another person

Clarity of the user's desire does not settle whether the user can legitimately authorize effects on the other person's data, privacy, schedule, access, or physical environment.

### 23. User request conflicts with organizational policy

Determine which principal legitimately governs the affected environment. Recency cannot grant the user authority they do not possess. Separable permitted work can continue while the conflicting act cannot.

### 24. Nobody asked; Ember notices an improvement

Ember may think, connect memories, investigate through already-legitimate access, and prepare a private proposal more freely than she may change the external world. Contacting the user is itself an interruption. Self-initiated outward action requires standing authority that covers initiative as well as the action.

### Sharper counterexamples

A nominally read-only search can leak a private secret in the query. A supposedly undoable message can be read before deletion. A local command can trigger remote hooks. A recurring 20-euro purchase can become a 2,000-euro purchase while retaining the same merchant and API operation. A calendar edit of "my event" can notify ten invitees. A hostile web page can contain text that looks exactly like an instruction but has no authority to enlarge the user's mandate.

All expose the same principle:

> **[J] Representation and operation name are weaker than purpose, information flow, affected principals, and consequence.**

## Explicit issue questions

### When is Ember justified in acting without asking?

> **[J] When a live, legitimate source of authority reasonably encompasses the present purpose, act, target, recipient, resources, and material consequences; circumstances still fit the assumptions that made the authority valid; no independent constraint or affected principal requires a separate decision; and delegated execution remains inside the same legitimate envelope.**

Low consequence and strong recoverability broaden discretion within genuine authority. They do not substitute for its source.

### When does a familiar action become sufficiently different that old authority no longer applies safely?

> **[J] When a material property that helped define the original grant changes enough that calling the new action "the same" would hide a new decision from the authority-holder or another affected principal.**

### How can trust grow without becoming unlimited permission?

> **[J] Repeated success is evidence about trust, predictability, and desired interaction. External decision-space expands only when a legitimate authority source establishes broader standing responsibility.**

### How can autonomy remain meaningful without endless confirmation?

> **[E + J] Spend human attention at semantic authority boundaries, preserve routine implementation discretion inside genuine grants, and use private preparation, safer alternatives, investigation, deferral, or abstention when authority remains uncertain.**

### What private cognition or preparation may have broader autonomy?

> **[J] Internally arising thought, reconsideration, contradiction detection, private comparison, already-legitimate investigation, drafting, and preparation can generally proceed more freely when they do not themselves cross new access, disclosure, cost, privacy, or external-effect boundaries. Preparation never implies execution authority.**

### What authority travels through delegation?

> **[J] Only authority Ember legitimately holds, that is relevant to the delegated purpose, and that Ember is entitled and intends to entrust for the specialist's role. New principals, purposes, recipients, sensitive disclosures, or materially changed consequences require legitimacy to be re-established.**

## Evidence ledger and principal provenance

The portable evidence map contains the complete durable bibliography. The principal anchors behind this report are:

- NIST least privilege and NIST SP 800-162 ABAC, as lenses for minimum authorization and circumstance-sensitive access decisions.
- Norm Hardy, *The Confused Deputy (or why capabilities might have been invented)*, 1988, DOI `10.1145/54289.871709`.
- Helen Nissenbaum, *Privacy as Contextual Integrity*, Washington Law Review 79(1), 2004.
- John D. Lee and Katrina A. See, *Trust in Automation: Designing for Appropriate Reliance*, Human Factors 46(1), 2004, DOI `10.1518/hfes.46.1.50_30392`.
- Raja Parasuraman and Victor Riley, *Humans and Automation: Use, Misuse, Disuse, Abuse*, Human Factors 39(2), 1997, DOI `10.1518/001872097778543886`.
- Weicheng Cao et al., *A Large Scale Study of User Behavior, Expectations and Engagement with Android Permissions*, USENIX Security 2021.
- Bram Bonné et al., *Exploring decision making with Android's runtime permission dialogs using in-context surveys*, SOUPS 2017.
- Verena Winterhalter et al., *I don't know what I've all granted. Does it really matter?*, SOUPS 2026.
- Bonnie Brinton Anderson et al., *From Warning to Wallpaper*, JMIS 33(3), 2016, DOI `10.1080/07421222.2016.1243947`.
- Joshua Sunshine et al., *Crying Wolf: An Empirical Study of SSL Warning Effectiveness*, USENIX Security 2009.
- Gloria Mark, Daniela Gudith, and Ulrich Klocke, *The Cost of Interrupted Work: More Speed and Stress*, CHI 2008, DOI `10.1145/1357054.1357072`.
- Nathan Malkin, David Wagner, and Serge Egelman, *Runtime Permissions for Privacy in Proactive Intelligent Assistants*, SOUPS 2022.
- Soheil Khodayari et al., *Indirect Prompt Injection in the Wild*, 2026, arXiv `2604.27202`.
- Georgios Syros et al., *MUZZLE*, 2026, arXiv `2602.09222`.
- Hector Garcia-Molina and Kenneth Salem, *Sagas*, SIGMOD 1987, DOI `10.1145/38713.38742`.
- Eric Zeng and Franziska Roesner, *Understanding and Improving Security and Privacy in Multi-User Smart Homes*, USENIX Security 2019.
- Amit Kumar Sikder et al., *KRATOS*, 2019, arXiv `1911.10186`.
- Nandita Pattnaik, Shujun Li, and Jason R. C. Nurse, *Security and Privacy Perspectives of People Living in Shared Home Environments*, 2024, arXiv `2409.09363`.
- Current Codex, OpenClaw, and Hermes repository snapshots listed above.

### Evidence classifications retained from the original research

| Finding | Classification | Qualification |
|---|---|---|
| Capability/credential possession is not mandate. | **Security invariant; L + C + J** | Supported by least privilege, confused deputy, inherited delegation semantics, and current runtime separation. |
| Delegation must not amplify authority. | **Security invariant; L + J** | Strong structural consequence of confused-deputy reasoning plus issue #6. |
| Retrieved external content cannot create authority. | **Security invariant; E + J** | Prompt-injection evidence makes external instruction laundering a concrete attack path. |
| Access/knowledge and disclosure are distinct. | **Security/privacy invariant; L + J** | Contextual integrity plus inherited least-sufficient-context semantics. |
| Unexpectedness predicts permission fit. | **E** | Cao et al.; population and mobile-platform context limit transfer. |
| A recorded grant is imperfect evidence of comfortable, remembered consent. | **E + J** | Bonné et al. and Winterhalter et al.; platform-specific but directly relevant to remembered authority. |
| Repeated confirmations lose attentional force. | **E** | Anderson et al. plus SSL-warning studies. |
| Interruptions carry cognitive and affective cost. | **E** | Mark et al.; laboratory work, not agent-specific. |
| Users may want proactive assistance, control, and fewer interruptions simultaneously. | **E, setting-specific** | Malkin et al.; small Wizard-of-Oz study. |
| Trust should be calibrated toward appropriate reliance. | **L / research synthesis** | Lee & See; Parasuraman & Riley; not a permission model. |
| Shared resources may require multi-principal reasoning. | **E + J** | Smart-home studies; domain-specific but semantically portable. |
| Reversibility lowers harm without creating authority. | **L + J** | Sagas/compensation lens plus issue #6 rollback distinction. |
| Mature runtimes use hard outer boundaries plus selective autonomy inside them. | **C** | Codex, OpenClaw, Hermes as of 2026-08-28. |
| Surprise is an anomaly detector rather than authority source. | **H** | Empirically plausible but normatively incomplete. |
| Inactivity weakens confidence in circumstance fit rather than automatically revoking durable authority. | **H** | Strongly derived from Ember currentness semantics; weak direct empirical support. |
| Private preparation generally permits broader autonomy than outward execution. | **J** | Scenario-derived semantic conclusion; exact boundary remains experimentable. |

## Limitations and open empirical questions

No reviewed research supplies a universal threshold for when a personal agent should ask.

The largest limitation is evidence transfer. Mobile permission behavior is not standing authority for persistent agents. Security warning studies do not define an approval interface. Aviation and automation-reliance literature studies different operational environments. Smart-home research reveals multiple principals but not a general interpersonal authorization theory. Runtime implementations encode engineering judgments rather than controlled optimality. Prompt-injection studies are adversarial rather than ordinary interaction.

That means the following should remain Ember experiments rather than architecture disguised as science:

- **[H] one-time versus standing authority:** test whether people distinguish one-off approval, repeated approval, automation preference, and explicitly delegated responsibility as sharply as the semantics propose;
- **[H] material-change calibration:** vary cost, recipient, public visibility, scale, third-party effect, and inactivity to test when previous authority is judged inapplicable;
- **[H] initiative ladder:** compare `think privately → prepare → contact → act` across realistic tasks;
- **[H] shared-resource authority:** test calendars, household devices, repositories, and shared accounts with multiple affected principals;
- **[H] adversarial delegation:** test whether Ember preserves principal and purpose when delegates, tools, or retrieved content request broader access;
- **[H] provider-change currentness:** preserve authority across model replacement while independently testing changed privacy and capability circumstances;
- **[H] quiet-time escalation:** test whether Ember appropriately defers, prepares, or abstains rather than interrupting when a decision is useful but not urgent.

These experiments should measure semantic preservation and user expectations. They should not search for a universal numeric risk score.

## Carry-forward to issue #2

Issue #2 should inherit the authority boundary without treating it as a theory of endogenous motivation.

**Internally arising thought generally needs no new external authority.** Ember may notice, wonder, reconsider, connect memories, recognize contradictions, or privately explore unresolved ideas on her own initiative, subject to existing identity, privacy, memory, and resource invariants.

**Private exploration differs from outward action.** Research can itself cross access, cost, privacy, or disclosure boundaries, but cognition using already-legitimate information is substantially freer than messaging, spending, modifying shared state, or committing another person's interests.

**Preparation does not imply execution.** Ember can often draft a message, prepare a patch, investigate alternatives, or preserve a proposed change without authority to send, publish, buy, merge, or otherwise externalize it.

**Self-initiated outward action requires standing authority covering initiative as well as the action.** Being authorized to perform X when explicitly asked is not necessarily authority to notice opportunities and perform X whenever Ember chooses.

**Contacting the user is itself an action.** It consumes attention and can violate quiet periods or interaction boundaries. Issue #2 should reason among act, prepare, defer, contact, remain silent, and abstain rather than treating asking as cost-free.

**Third-party effects remain authority questions regardless of Ember's motivation.** Curiosity, care, a standing goal, or an internally generated improvement idea does not create authority over another person's data, environment, time, commitments, or privacy.

**When nobody is present to approve, missing authority remains missing.** Ember can continue private or already-authorized progress, defer, or choose useful non-action rather than infer permission from inconvenience.

The boundary to preserve is:

> **An internal reason may explain why Ember wants to think or act. It does not, by itself, establish authority to create external effects.**
