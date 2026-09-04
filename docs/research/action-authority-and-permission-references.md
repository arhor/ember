---
summary: "Portable evidence map supporting canonical authority semantics with security, HCI, privacy, multi-principal, human-factors, and runtime sources."
read_when:
  - "Checking evidence behind standing authority, fresh approval, revocation, disclosure, or changed-circumstance conclusions"
  - "Challenging capability-versus-authority, delegated-authority, consent, or confirmation-fatigue assumptions"
role: evidence
discovery_status: current
---

# Action, Authority, and Permission Evidence Map

This document is the portable evidence companion to [Action, Authority, and Permission Semantics](action-authority-and-permission.md).

The semantic note remains the canonical Ember-facing synthesis. This companion exists so that evidence labels such as **[E]**, **[C]**, **[J]**, **[H]**, and **[L]**, plus security-invariant claims, remain inspectable outside the originating Deep Research session.

The preserved [Deep Research artifact](source-material/action-authority-and-permission-deep-research.md) contains the broader research narrative and evidence ledger. Research-session citation markers are provenance rather than a portable bibliography; the durable sources below are intended to remain usable from the repository alone.

This map deliberately does not duplicate the full bibliographies from the preceding phases. They remain inherited inputs:

- [Continuity and Identity Evidence Map](continuity-and-identity-references.md)
- [Memory and Remembering Evidence Map](memory-and-remembering-references.md)
- [Context Selection and Cognitive Framing Evidence Map](context-selection-and-cognitive-framing-references.md)
- [Capabilities and Delegation Evidence Map](capabilities-and-delegation-references.md)

Rapidly changing runtime claims were examined on **2026-08-28**. The research observed Codex at commit `868c9edb0da913a5fc699a71664e65f44f6058b0`, OpenClaw at commit `f30ed1b42728b19725dacc0187c1c9ffe40f1bc9`, and Hermes at commit `306db2776c6b6f1acc85c31c4dabba3263f0e9fd`. Revalidate those implementations before later architecture work if their authority mechanisms have materially evolved.

## Evidence map for validated conclusions

| Canonical conclusion                                                                                                                | Basis                                             | Principal portable evidence                                                                                                                                                                                                                                                     | Interpretation for Ember                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability and credential possession are not authority.                                                                             | **Security invariant; [L + C + J]**               | [R1 NIST least privilege](#r1-nist-least-privilege), [R2 NIST ABAC](#r2-nist-attribute-based-access-control), [R3 Confused Deputy](#r3-the-confused-deputy), [R15 Codex](#r15-openai-codex), [R16 OpenClaw](#r16-openclaw), [R17 Hermes](#r17-hermes-agent), inherited issue #6 | Technical ability says what can happen, not who is entitled to decide that it should happen.                                                                                                  |
| Authority must not self-expand through model reasoning, retrieved content, repetition, convenience, trust, or a specialist request. | **Security invariant; [J], supported by [E + L]** | [R3](#r3-the-confused-deputy), [R14 prompt injection](#r14-indirect-prompt-injection), inherited context/delegation evidence                                                                                                                                                    | External content or an already-powerful actor cannot become the source of additional mandate merely by requesting it.                                                                         |
| Authority to access or know does not imply authority to disclose.                                                                   | **Security/privacy invariant; [L + J]**           | [R4 Contextual Integrity](#r4-privacy-as-contextual-integrity), inherited issue #5 contextual-integrity and least-sufficient-context evidence                                                                                                                                   | Recipient and purpose are semantic boundaries. The same truthful information can be legitimate internally and illegitimate to disclose externally.                                            |
| Delegation may narrow authority but must not amplify it.                                                                            | **Security invariant; [L + J]**                   | [R3](#r3-the-confused-deputy), inherited issue #6 delegation envelope, [R15](#r15-openai-codex), [R16](#r16-openclaw), [R17](#r17-hermes-agent)                                                                                                                                 | A delegate's broader credentials remain capability. Only bounded authority Ember legitimately possesses and intentionally entrusts may travel.                                                |
| Revoked, superseded, or expired authority is historical evidence rather than current mandate.                                       | **Inherited invariant; [J]**                      | Inherited issue #4 currentness/supersession semantics                                                                                                                                                                                                                           | Remembered authorization requires the same separation between historical truth and current applicability as remembered facts and preferences.                                                 |
| Authority conflict must not silently resolve to the most permissive interpretation.                                                 | **Security invariant; [J]**                       | [R3](#r3-the-confused-deputy), inherited issue #4 provenance/conflict semantics, issue #5 context-conflict semantics                                                                                                                                                            | Ambiguity should not become an escalation path. Separable private work can continue while the conflicted external decision remains unresolved.                                                |
| Authority is multidimensional and circumstance-sensitive rather than reducible to a read/write flag or single danger score.         | **[L + J]**                                       | [R2](#r2-nist-attribute-based-access-control), [R4](#r4-privacy-as-contextual-integrity), [R7 Cao](#r7-android-permission-expectations), inherited issues #4 and #5                                                                                                             | Principal, purpose, target, recipient, resource, timing, scale, cost, visibility, privacy, recoverability, and third-party impact can change the meaning of an otherwise identical operation. |
| User surprise is a useful anomaly signal but not a normative authority source.                                                      | **[H], supported by [E]**                         | [R7](#r7-android-permission-expectations), [R9 Winterhalter](#r9-permission-awareness), [R8 Bonné](#r8-runtime-permission-decisions)                                                                                                                                            | Unexpected requests predict denial, but user misunderstanding and habituation make surprise insufficient as a complete permission test.                                                       |
| Repeated approval and repeated success can increase familiarity or trust without creating standing authority.                       | **[E + J]**                                       | [R8](#r8-runtime-permission-decisions), [R9](#r9-permission-awareness), [R5 Lee and See](#r5-trust-in-automation), [R6 Parasuraman and Riley](#r6-humans-and-automation)                                                                                                        | A past click is evidence about history and perhaps trust, not automatic semantic promotion to "may decide forever."                                                                           |
| Trust should support calibrated reliance rather than silently become broader authority.                                             | **[L + J]**                                       | [R5](#r5-trust-in-automation), [R6](#r6-humans-and-automation)                                                                                                                                                                                                                  | Trust affects confidence and willingness to delegate responsibility. Actual decision-space still requires a legitimate authority source.                                                      |
| Repeated confirmations can lose attentional force.                                                                                  | **[E]**                                           | [R10 Anderson et al.](#r10-warning-habituation), [R11 Crying Wolf](#r11-ssl-warning-effectiveness)                                                                                                                                                                              | Prompting on every mechanical operation can make later high-value confirmations less meaningful.                                                                                              |
| Interruptions impose measurable cognitive and affective cost.                                                                       | **[E]**                                           | [R12 Mark et al.](#r12-cost-of-interrupted-work)                                                                                                                                                                                                                                | Asking is not a zero-cost fallback. Contacting the user should itself be treated as an action with attention consequences.                                                                    |
| Users can simultaneously want proactive assistance, control, and fewer interruptions.                                               | **[E, setting-specific]**                         | [R13 Malkin et al.](#r13-runtime-permissions-for-proactive-assistants)                                                                                                                                                                                                          | The autonomy/control tension is real. The study is small and privacy-focused, so it informs the pressure rather than supplying a universal rule.                                              |
| Greater reversibility can justify more discretion inside legitimate authority, but reversibility does not create authority.         | **[L + J]**                                       | [R18 Sagas](#r18-sagas-and-compensation), inherited issue #6 cancellation/rollback semantics                                                                                                                                                                                    | Refund, correction, or compensation can reduce harm while leaving the original external effect historically real.                                                                             |
| Read/write is an insufficient authority distinction.                                                                                | **[L + J]**                                       | [R4](#r4-privacy-as-contextual-integrity), [R14](#r14-indirect-prompt-injection), [R18](#r18-sagas-and-compensation)                                                                                                                                                            | Reads can disclose or ingest hostile instructions; private writes can be low consequence. Information flow and consequence matter more than operation labels.                                 |
| Private cognition and preparation can generally have broader autonomy than outward execution.                                       | **[J]**                                           | Issue #7 scenario synthesis, [R12](#r12-cost-of-interrupted-work), [R13](#r13-runtime-permissions-for-proactive-assistants), inherited issues #4 and #5                                                                                                                         | Think, compare, draft, and prepare when no new access/disclosure/effect boundary is crossed. Preparation never bootstraps execution authority.                                                |
| A materially affected third party can introduce another principal.                                                                  | **[E + J]**                                       | [R19 Zeng and Roesner](#r19-multi-user-smart-homes), [R20 KRATOS](#r20-kratos-multi-user-access), [R21 shared-home perspectives](#r21-shared-home-security-and-privacy)                                                                                                         | Shared environments cannot always be modeled as one owner whose instruction settles every interest.                                                                                           |
| Human attention should be spent at semantic authority boundaries rather than mechanical action boundaries.                          | **[E + J]**                                       | [R10](#r10-warning-habituation), [R11](#r11-ssl-warning-effectiveness), [R12](#r12-cost-of-interrupted-work), [R13](#r13-runtime-permissions-for-proactive-assistants), [R5](#r5-trust-in-automation), [R6](#r6-humans-and-automation)                                          | Ask when a materially new legitimate choice belongs to the user or another principal, not merely because a tool has another step.                                                             |
| Uncertainty does not always mean asking immediately.                                                                                | **[J]**                                           | Issue #7 scenario synthesis, [R12](#r12-cost-of-interrupted-work), inherited issue #5 staged-recall/graceful-degradation semantics                                                                                                                                              | Ember may gather already-permitted information, narrow scope, prepare, choose a safer route, defer, or abstain before escalation.                                                             |
| Runtime approval state and semantic authority are distinct.                                                                         | **[C + J]**                                       | [R15](#r15-openai-codex), [R16](#r16-openclaw), [R17](#r17-hermes-agent)                                                                                                                                                                                                        | A runtime can be stricter than Ember's semantic authority or more permissive than it. Runtime policy is evidence about enforcement, not the ultimate source of mandate.                       |
| Mature agent runtimes converge on hard outer boundaries plus selective autonomy inside them.                                        | **[C]**                                           | [R15](#r15-openai-codex), [R16](#r16-openclaw), [R17](#r17-hermes-agent)                                                                                                                                                                                                        | Useful convergence supports bounded autonomy, but concrete approval modes and policy surfaces are implementation evidence rather than Ember design decisions.                                 |
| Inactivity should weaken confidence in circumstance fit rather than automatically revoke durable authority.                         | **[H]**                                           | Inherited continuity/currentness semantics; direct personal-agent evidence is weak                                                                                                                                                                                              | Preserve durable grants without pretending long silence proves the surrounding world and relationship are unchanged.                                                                          |

## Principal research references

### R1 NIST least privilege

**National Institute of Standards and Technology.** _Least privilege_ glossary entry, drawing on CNSSI 4009, NIST SP 800-53 Rev. 5, NIST SP 800-171 Rev. 3, and related publications.

- https://csrc.nist.gov/glossary/term/least_privilege

NIST defines least privilege as restricting users or processes acting on their behalf to the minimum authorizations and resources necessary for assigned functions. Ember uses this as a security lens, not as a proposed role or permission representation.

### R2 NIST Attribute Based Access Control

**Chung Tong Hu, David F. Ferraiolo, David R. Kuhn, Adam Schnitzer, Kenneth Sandlin, Robert Miller, Karen Scarfone.** _Guide to Attribute Based Access Control (ABAC) Definition and Considerations._ NIST SP 800-162, 2014, updated 2019.

- https://csrc.nist.gov/pubs/sp/800/162/upd2/final
- https://www.nist.gov/publications/guide-attribute-based-access-control-abac-definition-and-considerations

Relevant as a lens showing that authorization can depend on subject, object, operation, relationships, and environment conditions. Ember does not adopt ABAC as an architecture in this phase.

### R3 The Confused Deputy

**Norm Hardy.** _The Confused Deputy (or why capabilities might have been invented)._ ACM SIGOPS Operating Systems Review 22(4), 1988, pp. 36-38.

- DOI: `10.1145/54289.871709`
- https://dl.acm.org/doi/10.1145/54289.871709

Relevant because a component with broad ambient authority can misuse its power while servicing a requester entitled to something narrower. Nested agent delegation is a contemporary version of the same structural hazard.

### R4 Privacy as Contextual Integrity

**Helen Nissenbaum.** _Privacy as Contextual Integrity._ Washington Law Review 79(1), 2004, p. 119 onward.

- https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/

Relevant as a privacy lens because legitimacy of information flow depends on context, roles, recipients, purposes, and transmission norms rather than on whether information is merely available or true.

### R5 Trust in Automation

**John D. Lee, Katrina A. See.** _Trust in Automation: Designing for Appropriate Reliance._ Human Factors 46(1), 2004, pp. 50-80.

- DOI: `10.1518/hfes.46.1.50_30392`
- https://pubmed.ncbi.nlm.nih.gov/15151155/

Relevant because the review frames trust around appropriate reliance under complexity and uncertainty rather than around maximizing trust. Ember uses this to separate confidence in the agent from transfer of decision rights.

### R6 Humans and Automation

**Raja Parasuraman, Victor Riley.** _Humans and Automation: Use, Misuse, Disuse, Abuse._ Human Factors 39(2), 1997, pp. 230-253.

- DOI: `10.1518/001872097778543886`
- https://doi.org/10.1518/001872097778543886

Relevant for the symmetric risks of overreliance and disuse, including monitoring failures and the cost of systems that repeatedly cry wolf.

### R7 Android permission expectations

**Weicheng Cao, Chunqiu Xia, Sai Teja Peddinti, David Lie, Nina Taft, Lisa M. Austin.** _A Large Scale Study of User Behavior, Expectations and Engagement with Android Permissions._ 30th USENIX Security Symposium, 2021, pp. 803-820.

- https://www.usenix.org/conference/usenixsecurity21/presentation/cao-weicheng

The 30-day study involved 1,719 participants across 10 countries and regions. Unexpected permission requests were more than twice as likely to be denied, and explanations substantially reduced denial rates after controlling for other factors. This is strong evidence that expectation matters to perceived appropriateness, not proof that expectation creates legitimate authority.

### R8 Runtime permission decisions

**Bram Bonné, Sai Teja Peddinti, Igor Bilogrevic, Nina Taft.** _Exploring decision making with Android's runtime permission dialogs using in-context surveys._ Thirteenth Symposium on Usable Privacy and Security, 2017, pp. 195-210.

- https://www.usenix.org/conference/soups2017/technical-sessions/presentation/bonne

Relevant because users granted many requests while still reporting discomfort with a subset of grants, and expectation strongly influenced decisions. A recorded click should therefore not be treated as permanent context-free mandate.

### R9 Permission awareness

**Verena Winterhalter, Sarah Prange, Anouk Moreno, Harel Israel Berger, Florian Alt.** _I don't know what I've all granted. Does it really matter? - Understanding Users' Awareness of Different Permission Types on Android._ Twenty-Second Symposium on Usable Privacy and Security, 2026, pp. 181-199.

- https://www.usenix.org/conference/soups2026/presentation/winterhalter

In this in-the-wild study with 77 participants, 56.76% of responses about app permission state mismatched actual state, including 60.70% for runtime permissions. The portable conclusion is that humans may not accurately remember existing grants, weakening any policy that assumes old permission state is self-explanatory.

### R10 Warning habituation

**Bonnie Brinton Anderson, Anthony Vance, C. Brock Kirwan, Jeffrey L. Jenkins, David Eargle.** _From Warning to Wallpaper: Why the Brain Habituates to Security Warnings and What Can Be Done About It._ Journal of Management Information Systems 33(3), 2016, pp. 713-743.

- DOI: `10.1080/07421222.2016.1243947`
- https://www.tandfonline.com/doi/full/10.1080/07421222.2016.1243947

The work directly measured habituation in an fMRI experiment with 25 participants and a behavioral experiment with 80 participants. Ember should not import the paper's UI remedy, but the evidence strongly supports treating repeated low-value confirmations as an attention-degrading safety mechanism.

### R11 SSL warning effectiveness

**Joshua Sunshine, Serge Egelman, Hazim Almuhimedi, Neha Atri, Lorrie Faith Cranor.** _Crying Wolf: An Empirical Study of SSL Warning Effectiveness._ 18th USENIX Security Symposium, 2009.

- https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/crying-wolf-empirical-study-ssl-warning

Relevant as independent usable-security evidence that warnings can train unsafe click-through behavior and that unnecessary warnings should be eliminated rather than merely restyled.

### R12 Cost of interrupted work

**Gloria Mark, Daniela Gudith, Ulrich Klocke.** _The Cost of Interrupted Work: More Speed and Stress._ CHI 2008, pp. 107-110.

- DOI: `10.1145/1357054.1357072`
- https://dl.acm.org/doi/10.1145/1357054.1357072

Participants compensated for interruptions by working faster, but with greater stress, frustration, time pressure, and effort. Ember therefore treats asking or contacting the user as carrying human attention cost.

### R13 Runtime permissions for proactive assistants

**Nathan Malkin, David Wagner, Serge Egelman.** _Runtime Permissions for Privacy in Proactive Intelligent Assistants._ Eighteenth Symposium on Usable Privacy and Security, 2022, pp. 633-651.

- https://www.usenix.org/conference/soups2022/presentation/malkin

A Wizard-of-Oz study with 23 participant pairs found that participants wanted control over assistant actions and data while generally prioritizing an interruption-free experience over very fine-grained control. This is direct but small-sample evidence for the autonomy/control tension.

### R14 Indirect prompt injection

Two current empirical anchors are especially useful:

**Soheil Khodayari, Xuenan Zhang, Bhupendra Acharya, Giancarlo Pellegrino.** _Indirect Prompt Injection in the Wild: An Empirical Study of Prevalence, Techniques, and Objectives._ 2026.

- arXiv: https://arxiv.org/abs/2604.27202

**Georgios Syros, Evan Rose, Brian Grinstead, Christoph Kerschbaumer, William Robertson, Cristina Nita-Rotaru, Alina Oprea.** _MUZZLE: Adaptive Agentic Red-Teaming of Web Agents Against Indirect Prompt Injection Attacks._ 2026.

- arXiv: https://arxiv.org/abs/2602.09222

These studies show that external content can steer agent behavior through the very observations needed for legitimate work. Ember's conclusion is semantic: retrieved content may supply evidence but cannot itself create authority.

### R15 OpenAI Codex

**OpenAI Codex repository**, examined on **2026-08-28** at commit `868c9edb0da913a5fc699a71664e65f44f6058b0`.

- Repository snapshot: https://github.com/openai/codex/tree/868c9edb0da913a5fc699a71664e65f44f6058b0
- Permission-request template: https://github.com/openai/codex/blob/868c9edb0da913a5fc699a71664e65f44f6058b0/codex-rs/prompts/templates/permissions/approval_policy/on_request_rule_request_permission.md
- Exec policy: https://github.com/openai/codex/blob/868c9edb0da913a5fc699a71664e65f44f6058b0/codex-rs/core/src/exec_policy.rs
- OpenAI engineering article, _Running Codex safely at OpenAI_, 2026-05-08: https://openai.com/index/running-codex-safely/

Current Codex separates sandbox boundaries, approval policies, network controls, managed configuration, and selective auto-review. The convergence supports bounded autonomy inside harder execution boundaries. It does not establish Ember's semantic authority model or approval UX.

### R16 OpenClaw

**OpenClaw repository**, examined on **2026-08-28** at commit `f30ed1b42728b19725dacc0187c1c9ffe40f1bc9`.

- Repository snapshot: https://github.com/openclaw/openclaw/tree/f30ed1b42728b19725dacc0187c1c9ffe40f1bc9
- Host exec modes: https://github.com/openclaw/openclaw/blob/f30ed1b42728b19725dacc0187c1c9ffe40f1bc9/docs/tools/permission-modes.md
- Exec behavior and session overrides: https://github.com/openclaw/openclaw/blob/f30ed1b42728b19725dacc0187c1c9ffe40f1bc9/docs/tools/exec.md
- Advanced approval semantics: https://github.com/openclaw/openclaw/blob/f30ed1b42728b19725dacc0187c1c9ffe40f1bc9/docs/tools/exec-approvals-advanced.md

OpenClaw's current model combines configuration and host approval state conservatively, distinguishes pending approval from execution, and treats approval resolution as security-sensitive authority. The useful Ember lesson is monotonicity and expiry, not the concrete configuration surface.

### R17 Hermes Agent

**NousResearch Hermes Agent repository**, examined on **2026-08-28** at commit `306db2776c6b6f1acc85c31c4dabba3263f0e9fd`.

- Repository snapshot: https://github.com/NousResearch/hermes-agent/tree/306db2776c6b6f1acc85c31c4dabba3263f0e9fd

The current implementation contains persistent approval modes and independent hard checks, with execution-context isolation intended to prevent one concurrent session from contaminating another's approval state. The portable security lesson is that authority context is security-sensitive state and must not become ordinary model-editable shared context.

### R18 Sagas and compensation

**Hector Garcia-Molina, Kenneth Salem.** _Sagas._ Proceedings of ACM SIGMOD 1987, pp. 249-259.

- DOI: `10.1145/38713.38742`
- https://dl.acm.org/doi/10.1145/38713.38742

Relevant as a distributed-systems lens separating compensation for long-lived external effects from true atomic rollback. Ember uses the distinction to avoid treating refundability or corrective follow-up as proof that the original act was reversible in the stronger semantic sense.

### R19 Multi-user smart homes

**Eric Zeng, Franziska Roesner.** _Understanding and Improving Security and Privacy in Multi-User Smart Homes: A Design Exploration and In-Home User Study._ 28th USENIX Security Symposium, 2019, pp. 159-176.

- https://www.usenix.org/conference/usenixsecurity19/presentation/zeng

A month-long in-home study with seven households documents multi-user security and privacy tensions in shared physical environments. It supports treating household actions as potentially multi-principal rather than assuming one account owner settles every affected interest.

### R20 KRATOS multi-user access

**Amit Kumar Sikder et al.** _KRATOS: Multi-User Multi-Device-Aware Access Control System for the Smart Home._ 2019.

- arXiv: https://arxiv.org/abs/1911.10186

The work studies conflicting, dynamic access demands across multiple users and devices. Ember does not borrow the access-control design, but the empirical problem validates multi-principal reasoning in shared environments.

### R21 Shared-home security and privacy

**Nandita Pattnaik, Shujun Li, Jason R. C. Nurse.** _Security and Privacy Perspectives of People Living in Shared Home Environments._ 2024.

- arXiv: https://arxiv.org/abs/2409.09363

Relevant because device ownership, landlord/resident roles, co-habitant relationships, visitors, and prior residents create security and privacy interests that do not collapse into a single household principal.

## Evidence limitations

The most important limitations are transfer limitations rather than missing citations:

- Android permission studies concern mobile platform grants, not persistent personal-agent standing authority.
- Warning studies establish habituation and click-through risks, not an Ember-ready approval interface.
- Automation literature often studies aviation, industrial, or decision-support contexts rather than close personal agents.
- Proactive-assistant evidence is unusually relevant but currently small-sample and privacy-focused.
- Smart-home work establishes multi-principal pressures but not a complete theory of interpersonal authorization.
- Prompt-injection studies are adversarial security evaluations and should not be generalized into assumptions about ordinary user intent.
- Runtime implementations show current engineering convergence, not controlled evidence that their approval modes are optimal.
- The exact boundary between ordinary implied means and material expansion remains an Ember semantic judgment that should be tested through scenarios and future user studies.

## Preserved hypotheses

The following should remain hypotheses rather than being silently promoted into universal rules:

- **[H] Surprise as anomaly detector.** A user being reasonably surprised is evidence that a prior grant may not fit, but not a complete authority test.
- **[H] Inactivity and currentness.** Long inactivity should weaken confidence in circumstance fit without automatically revoking durable authority.
- **[H] Initiative ladder.** Users may perceive `think → prepare → contact → act` as meaningfully different autonomy stages, but Ember-specific testing is needed.
- **[H] Material-change calibration.** Changes in cost, recipient, visibility, third-party impact, scale, or privacy may have different perceived thresholds depending on task and relationship.
- **[H] Provider-change semantics.** Authority should survive cognition-provider replacement as continuity state while privacy and capability changes are re-evaluated independently; direct empirical personal-agent evidence remains weak.

These hypotheses should inform later experiments and issue #9 synthesis without becoming permission schemas, risk formulas, or approval enums during the semantic research phase.
