# ADR Documentation Migration Plan

> Archived on 2026-10-28. This document preserves historical design, investigation
> or migration evidence; its commands, paths, proposals and implementation plans are
> not current operating instructions. Use [current architecture](../../architecture/README.md),
> [guides](../../guides/README.md) and [accepted ADRs](../../architecture/decisions/README.md).

Status: documentation migration complete on 2026-10-27. The maintainer
authorized finishing M09–M11 without further phase-approval pauses. ADRs 0011–0038
are accepted; ADRs 0001–0009 retain original acceptance; ADR 0010 is deprecated.

## Governing direction

- Use the original `.agents/skills/adr-skill/` unchanged with its native templates,
  metadata, implementation plans and checkbox verification. Existing numeric filenames
  continue at the maintainer's explicit request. Manual-template authoring is used
  because the original CommonJS helpers cannot run directly in Ember's ESM scope.
- Retire the catalogue, routing metadata, old `ember-documentation` entry point,
  custom discovery tooling/tests and CI wiring under accepted ADR 0014. Static document
  and ADR indexes plus source reading/search own navigation; root guidance owns maintenance.
- ADRs own accepted architectural choices. Foundations, scenarios, research, guides,
  detailed implementation references, evidence and historical reports retain their
  responsibilities, dates, provenance and uncertainty. Detailed sources are retained
  with explicit ADR owners rather than deleted to meet a conversion quota.
- Preserve original ADR bodies/headings/identities/dates, all 40 scenario IDs, and
  historical supersession. ADR 0009 replaces only ADR 0006's package-manager policy.
  ADR 0010 is history, not authority to customize/reinstate the withdrawn tooling.
- Do not modify `packages/`, the lockfile, TypeScript configuration, or the original
  ADR skill. No runtime behavior is changed by this documentation migration.
- M08-F02, the missing durable contact-decision/no_contact ledger, remains open runtime
  implementation work. The maintainer acknowledged the gap; documentation acceptance
  does not implement or verify it. Other unselected semantic representations stay open.

## Tracking

| ID  | Task                                        | Status | Completion evidence                                                                                |
| --- | ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| M01 | Inventory source responsibilities           | Done   | 119-source ledger, 27 extracted candidates                                                         |
| M02 | Record replacement governance               | Done   | Deprecated ADR 0010; accepted ADR 0014                                                             |
| M03 | Native metadata and catalogue retirement    | Done   | Original skill preserved; custom metadata/tooling removed                                          |
| M04 | Pilot migration                             | Done   | Accepted ADRs 0011–0013 and source owners                                                          |
| M05 | Application and cognition                   | Done   | Accepted ADRs 0015–0018; 91 targeted tests                                                         |
| M06 | Memory, conversation and representation     | Done   | Accepted ADRs 0019–0023; 97 targeted tests                                                         |
| M07 | Capability, authority and delegation        | Done   | Accepted ADRs 0024–0028; 98 targeted tests                                                         |
| M08 | Agency, objectives, runtime and surfaces    | Done   | Accepted ADRs 0029–0038; 210 targeted tests; M08-F02 open                                          |
| M09 | Reconcile original ADRs and retained corpus | Done   | Original nine bodies preserved; all 38 native ADRs complete; 119 final source dispositions         |
| M10 | Complete routing/maintenance cutover        | Done   | Root/index guidance, lifecycle labels, retired-tool wiring and active runbooks reconciled          |
| M11 | Final audit and migration closure           | Done   | 678 tests, dependency/evaluation checks, full structural/link audit; existing type errors recorded |

Estimates in the historical record below are original planning references, not measured
human hours or a claim of runtime implementation effort. Phase reviews M02–M08 are
recorded historically; the maintainer waived further phase pauses for M09–M11.

## Final verification scope

Check every native ADR's metadata, required body sections, status/index/source owners,
all 119 source dispositions, source knowledge retention, all local targets/anchors,
40 scenario identities, supersession, original skill byte identity and protected files.
Run the existing deterministic suite through Node after `nvm use`, include colocated
core tests, check dependency boundaries, scoped formatting and strict lint. Record
pre-existing root-toolchain issues separately; do not edit active packages to clear them.
No live provider, remote service, publishing, commit or dependency installation is needed.

## Historical inventory and execution record

The remaining inventory findings and dated phase packages preserve the original
investigation, superseded approaches and reviews. Their earlier pending/retained-
catalogue/custom-helper instructions do not override the governing direction above.
The source ledger has been updated to actual final dispositions; open M08-F02 tasks
remain explicitly open. The original plan's 27 candidate keys stay traceable to ADRs.

## M01 inventory findings

Inventory completed against baseline commit `3b4e27f27a776116b4d4db2a1560171b13ad94b4`. The ledger below has exactly
119 baseline source rows; the execution plan and proposed ADR 0010 are migration
additions and are tracked separately. Inventory completion records proposed
dispositions, not completed conversions or acceptance of candidate decisions.

The reviewed source structure yields **27 extracted ADR candidates plus governance
ADR 0010**, for a projected 37-record corpus including the nine existing ADRs.
This falls within the investigation's estimate; keep the 64–116-hour budget until
pilot measurements justify changing it. Candidate labels C01–C27 are stable tracking
keys; allocate numeric ADR filenames when records are created, not in advance.

Disposition totals: **convert: 5**, **historical: 7**, **merge: 5**, **retain: 80**, **split: 22**.
All 38 current design documents have explicit treatment. Every other source retains
an accountable task for navigation, lifecycle, or provenance review.

### Reconciliation findings

- **F01 — historical instructions inside current design:** `minimal-continuity-slice.md`
  still describes Node 24, `.mjs`, and a zero-dependency implementation. ADRs 0006/0009,
  current package manifests, and the application-flow reference govern the present
  runtime. C12 extracts only the validated JSON snapshot/durable replacement/single-writer
  choice, corroborated by `packages/core/src/persistence/state-store.ts`; obsolete
  runtime/provider instructions must remain historical or be removed from current guidance.
- **F02 — historical package pins presented as current:** AI SDK adapter/provider sources
  cite `ai@7.0.93`, while the current root/core manifests use `ai@7.0.153`. Retain dated
  adoption evidence, reconcile current operational claims, and avoid making an old
  patch version an accidental new constraint. The Ollama loopback-only configuration
  and hosted DeepSeek API-key handling remain explicit provider trust distinctions.
- **F03 — an already recorded choice:** ADR 0008's Telegram protocol-client amendment
  already adopts `node-telegram-bot-api@2.1.0` with Ember-owned polling and no automatic
  send retries. Retain its framework evaluation as evidence; do not create a duplicate ADR.
- **F04 — partial supersession:** ADR 0009 replaces ADR 0006's package-manager choice,
  not its language/runtime decision. Lifecycle tooling must preserve that scoped
  amendment rather than marking ADR 0006 wholly superseded.
- **F05 — representation questions remain open:** conversation, action approval,
  objectives, and onboarding sources explicitly leave choices open. Preserve those
  limits alongside later concrete implementations; do not infer universal policy from
  the first sidecar, Calendar action, or setup flow.
- **F06 — evaluation is not adoption:** the TypeScript experiment supports ADR 0006;
  endogenous selectivity supplies evidence for C20; the earlier LangGraph evaluation
  proposes possible seams while later objective evidence defers adoption. Preserve
  dates, measurements, and this distinction when adjusting discovery roles.
- **F07 — refinements share an owner:** specialist context flow explicitly states that
  it does not warrant a new independent ADR. Consolidate its implementation constraints
  into C16 beneath ADRs 0003/0004. Likewise consolidate the opportunity/evaluator/silence
  chain into C18 while keeping its detailed lifecycle reference available.

These are migration reconciliation requirements, not changes to production behavior.
No external documentation refresh or live provider experiment was performed for this
inventory; retained research and empirical reports remain dated evidence.

### Candidate decision catalogue

Titles and scopes below are proposals for phase review. Source links identify the
rationale and implementation evidence to preserve; a candidate is not yet an accepted
record. Existing ADRs 0001–0009 remain governing in their established scopes.

| Candidate | Proposed decision                                                                                                                                                                         | Class          | Owning task | Sources                                                                                                                                                                                                                                                                                      | Boundary to preserve                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C01       | [Keep streamed cognition provisional until final validation](../../architecture/decisions/0011-keep-streamed-cognition-provisional-until-final-validation.md)                             | implementation | M04         | [ai-sdk-streaming-cognition-boundary](../../architecture/decisions/0011-keep-streamed-cognition-provisional-until-final-validation.md)                                                                                                                                                       | Ephemeral snapshots; final result validation owns completion.                                                     |
| C02       | [Keep Codex exec for bounded specialist work](../../architecture/decisions/0012-keep-codex-exec-for-bounded-specialist-work.md)                                                           | implementation | M04         | [codex-specialist-integration-evaluation](../codex-specialist-integration-evaluation.md)                                                                                                                                                                                                     | Retain the dated comparison and explicit App Server adoption triggers.                                            |
| C03       | [Keep conversation identity and short-lived dialogue Ember-owned](../../architecture/decisions/0013-keep-conversation-identity-and-context-ember-owned.md)                                | semantic       | M04         | [conversation-context-turn-semantics](../../architecture/conversation-context-turn-semantics.md)                                                                                                                                                                                             | Separate conversation from memory and provider sessions; representation remains open.                             |
| C04       | [Centralize application coordination and inward dependencies](../../architecture/decisions/0015-centralize-application-coordination-and-inward-dependencies.md)                           | implementation | M05         | [canonical-application-flow](../../architecture/canonical-application-flow.md); [source-layout](../../architecture/source-layout.md)                                                                                                                                                         | One application boundary; executable composition owns construction; retain current source maps.                   |
| C05       | [Use AI SDK beneath an Ember-owned cognition seam](../../architecture/decisions/0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md)                                                 | implementation | M05         | [ai-sdk-cognition-adapter-boundary](../../architecture/ai-sdk-cognition-adapter-boundary.md)                                                                                                                                                                                                 | Contain SDK types and mechanics; preserve provider trust/configuration distinctions in the reference.             |
| C06       | [Use typed structured output for Ember-owned control decisions](../../architecture/decisions/0017-use-typed-structured-output-for-control-decisions.md)                                   | implementation | M05         | [ai-sdk-structured-control-boundary](../../architecture/ai-sdk-structured-control-boundary.md)                                                                                                                                                                                               | Typed control is separate from ordinary cognition completion and canonical authority.                             |
| C07       | [Isolate Claude Code cognition behind its AI SDK provider](../../architecture/decisions/0018-isolate-claude-code-cognition-behind-its-ai-sdk-provider.md)                                 | implementation | M05         | [claude-code-ai-sdk-provider](../../architecture/claude-code-ai-sdk-provider.md)                                                                                                                                                                                                             | Subscription authentication, context/tool isolation, and session evidence remain bounded.                         |
| C08       | [Require evidence-backed proposals and deterministic memory adoption](../../architecture/decisions/0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md)           | implementation | M06         | [memory-proposal-semantics](../../architecture/decisions/0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md)                                                                                                                                                        | Separate assessment from mutation; preserve the bounded v1 adoption policy and supersession checks.               |
| C09       | [Generate memory candidates from bounded durable conversation evidence](../../architecture/decisions/0020-generate-memory-candidates-from-bounded-durable-conversation-evidence.md)       | implementation | M06         | [conversation-memory-proposal-generation](../../architecture/conversation-memory-proposal-generation.md)                                                                                                                                                                                     | Model generation cannot manufacture evidence or bypass deterministic adoption.                                    |
| C10       | [Persist conversation trajectories independently of surfaces](../../architecture/decisions/0021-persist-conversation-trajectories-independently-of-surfaces.md)                           | implementation | M06         | [cross-surface-conversation-continuity](../../architecture/cross-surface-conversation-continuity.md)                                                                                                                                                                                         | Retain sidecar migration and explicit fresh-conversation behavior as maintained reference.                        |
| C11       | [Keep semantic state independent of encodings and materialized views](../../architecture/decisions/0022-keep-semantic-state-independent-of-encodings-and-materialized-views.md)           | semantic       | M06         | [semantic-state-representation-boundary](../../architecture/semantic-state-representation-boundary.md)                                                                                                                                                                                       | Retain Markdown v1 edit/import procedures; graph adoption remains unselected.                                     |
| C12       | [Persist validated canonical snapshots under a single-writer lease](../../architecture/decisions/0023-persist-validated-canonical-snapshots-under-a-single-writer-lease.md)               | implementation | M06         | [minimal-continuity-slice](minimal-continuity-slice.md)                                                                                                                                                                                                                                      | Extract the still-implemented JSON/durable replacement choice; exclude obsolete Node 24/provider plans.           |
| C13       | [Enforce capability authority and effect evidence in an Ember firewall](../../architecture/decisions/0024-enforce-capability-authority-and-effect-evidence-in-an-ember-firewall.md)       | implementation | M07         | [capability-execution-boundary](../../architecture/capability-execution-boundary.md)                                                                                                                                                                                                         | Keep Calendar-specific bindings and operational details as reference beneath proposal semantics.                  |
| C14       | [Map MCP tools explicitly into bounded Ember capabilities](../../architecture/decisions/0025-map-mcp-tools-explicitly-into-bounded-ember-capabilities.md)                                 | implementation | M07         | [mcp-capability-source](../../architecture/mcp-capability-source.md)                                                                                                                                                                                                                         | Local stdio discovery is capability evidence; explicit mapping and authority remain Ember-owned.                  |
| C15       | [Bind approval to one attributable and still-current action proposal](../../architecture/decisions/0026-bind-approval-to-one-attributable-and-still-current-action-proposal.md)           | semantic       | M07         | [durable-action-proposal-approval](../../architecture/durable-action-proposal-approval.md)                                                                                                                                                                                                   | Exact material parameters, currentness, and effect correlation; no universal approval UI or policy DSL.           |
| C16       | [Delegate bounded specialist episodes with explicit context and authority](../../architecture/decisions/0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md) | implementation | M07         | [minimal-codex-specialist-delegation](../../architecture/minimal-codex-specialist-delegation.md); [specialist-authority-context-flow](../../architecture/decisions/0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md)                                         | One boundary owner; the context-flow refinement does not warrant another independent ADR.                         |
| C17       | [Reintegrate specialist results through a currentness and provenance gate](../../architecture/decisions/0028-reintegrate-specialist-results-through-a-currentness-and-provenance-gate.md) | implementation | M07         | [specialist-result-reintegration](../../architecture/specialist-result-reintegration.md)                                                                                                                                                                                                     | Runtime success and specialist reports cannot directly mutate canonical meaning.                                  |
| C18       | [Persist topic-free cognition decisions and explicit silence](../../architecture/decisions/0029-persist-topic-free-cognition-decisions-and-explicit-silence.md)                           | implementation | M08         | [cognition-opportunity](../../architecture/cognition-opportunity.md); [endogenous-cognition-decision](../../architecture/endogenous-cognition-decision.md); [endogenous-silence-lifecycle](../../architecture/decisions/0029-persist-topic-free-cognition-decisions-and-explicit-silence.md) | One opportunity/evaluator/lifecycle decision; keep schema and lifecycle reference together.                       |
| C19       | [Represent dormant concerns with existing live commitments](../../architecture/decisions/0030-represent-dormant-concerns-with-existing-live-commitments.md)                               | implementation | M08         | [endogenous-concern-activation](../../architecture/decisions/0030-represent-dormant-concerns-with-existing-live-commitments.md)                                                                                                                                                              | Dormancy is selection, not a new canonical status; discharge remains an explicit transition.                      |
| C20       | [Defer repeated cognition over unchanged projected grounding](../../architecture/decisions/0031-defer-repeated-cognition-over-unchanged-projected-grounding.md)                           | implementation | M08         | [endogenous-attention-control](../../architecture/endogenous-attention-control.md)                                                                                                                                                                                                           | Preserve the measured narrow control and time-sensitive reopening limitation; no generic scheduler.               |
| C21       | [Separate completed cognition from permission to interrupt](../../architecture/decisions/0032-separate-completed-cognition-from-permission-to-interrupt.md)                               | implementation | M08         | [endogenous-interruption-decision](../../architecture/decisions/0032-separate-completed-cognition-from-permission-to-interrupt.md)                                                                                                                                                           | Keep deliver/defer/suppress/no-delivery separate from contact intent and actual delivery.                         |
| C22       | [Represent proactive contact as durable intent distinct from delivery](../../architecture/decisions/0033-represent-proactive-contact-as-durable-intent-distinct-from-delivery.md)         | semantic       | M08         | [proactive-contact-intent](../../architecture/proactive-contact-intent.md)                                                                                                                                                                                                                   | No-contact is an established result; intent, representation, handoff, and awareness remain distinct.              |
| C23       | [Revalidate authority and attention before proactive handoff](../../architecture/decisions/0034-revalidate-authority-and-attention-before-proactive-handoff.md)                           | implementation | M08         | [proactive-contact-attention-policy](../../architecture/proactive-contact-attention-policy.md)                                                                                                                                                                                               | Pure admit/defer/suppress gate with attributable evidence and explicit next-step ownership.                       |
| C24       | [Keep durable objectives independent of execution episodes](../../architecture/decisions/0035-keep-durable-objectives-independent-of-execution-episodes.md)                               | semantic       | M08         | [durable-objective-lifecycle](../../architecture/durable-objective-lifecycle.md)                                                                                                                                                                                                             | Explicit user-intent creation, separate lifecycle/progress, and fresh currentness before later work.              |
| C25       | [Defer LangGraph until a measured bounded execution gap earns it](../../architecture/decisions/0036-defer-langgraph-until-a-measured-bounded-execution-gap-earns-it.md)                   | implementation | M08         | [durable-objective-langgraph-evaluation](../durable-objective-langgraph-evaluation.md); [langgraph-durable-execution-evaluation](../langgraph-durable-execution-evaluation.md)                                                                                                               | Later objective evidence owns the current deferral; earlier proposed ports remain evaluated possibilities.        |
| C26       | [Keep interaction occurrences and delivery truth transport-neutral](../../architecture/decisions/0037-keep-interaction-occurrences-and-delivery-truth-transport-neutral.md)               | implementation | M08         | [interaction-surface-boundary](../../architecture/interaction-surface-boundary.md)                                                                                                                                                                                                           | Retain current adapter contract and reconciliation reference; composition belongs to C04.                         |
| C27       | [Separate machine setup, lineage selection, and conversational onboarding](../../architecture/decisions/0038-separate-machine-setup-lineage-selection-and-conversational-onboarding.md)   | semantic       | M08         | [setup-and-onboarding-semantics](../../guides/setup-and-onboarding.md)                                                                                                                                                                                                                       | Retain host commands, secret entry, and implemented onboarding procedures as reference; fork semantics stay open. |

## Source-to-destination ledger

The 119 rows retain the original inventory. Baseline role/lifecycle describes the
pre-migration source; disposition/destination/status now records the actual final outcome.
All sources remain at their original paths with explicit accepted decision owners where
extracted. The retired catalogue roles are retained here as inventory history, not metadata.
`retain` may include a justified discovery-role correction or link update in its owning
task. `historical` means preserve the existing historical/superseded lifecycle, not
change it again. All disposition-execution evidence is pending.

| Source                                                                                                                                                                   | Baseline role / lifecycle | Disposition           | Destination / retained responsibility                                                                                                                                                                                                                    | Governing decisions and scenario/evidence links                                                                                                         | Reconciliation / open questions                                                                                                                       | Task | Completion evidence                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| [architecture/README.md](../../architecture/README.md)                                                                                                                   | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0006, 0007, 0008; Keep source-owned procedure/evidence links                                                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M10  | Done: source responsibility/provenance retained and indexed    |
| [architecture/acceptance-scenarios.md](../../architecture/acceptance-scenarios.md)                                                                                       | scenario / current        | retain                | Retain scenario responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0002, 0003, 0004, 0005; AS-AGY, AS-AUTH, AS-CONT, AS-CTX, AS-DEL, AS-MEM, AS-OPS scenarios cited in source                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/ai-sdk-cognition-adapter-boundary.md](../../architecture/ai-sdk-cognition-adapter-boundary.md)                                                             | design / current          | decision + reference  | [Accepted ADR 0016](../../architecture/decisions/0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                                | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M05  | Done: accepted owner published; detailed source retained       |
| [architecture/ai-sdk-streaming-cognition-boundary.md](../../architecture/decisions/0011-keep-streamed-cognition-provisional-until-final-validation.md)                   | design / current          | consolidated into ADR | Accepted ADR 0011 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M04  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/ai-sdk-structured-control-boundary.md](../../architecture/ai-sdk-structured-control-boundary.md)                                                           | design / current          | decision + reference  | [Accepted ADR 0017](../../architecture/decisions/0017-use-typed-structured-output-for-control-decisions.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                               | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M05  | Done: accepted owner published; detailed source retained       |
| [architecture/authority-approval-effects-evaluation.md](../../guides/authority-approval-effects-evaluation.md)                                                           | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/autonomous-memory-formation-evaluation.md](../../guides/autonomous-memory-formation-evaluation.md)                                                         | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/canonical-application-flow.md](../../architecture/canonical-application-flow.md)                                                                           | design / current          | decision + reference  | [Accepted ADR 0015](../../architecture/decisions/0015-centralize-application-coordination-and-inward-dependencies.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M05  | Done: accepted owner published; detailed source retained       |
| [architecture/capability-execution-boundary.md](../../architecture/capability-execution-boundary.md)                                                                     | design / current          | decision + reference  | [Accepted ADR 0024](../../architecture/decisions/0024-enforce-capability-authority-and-effect-evidence-in-an-ember-firewall.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                           | ADRs 0004; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: accepted owner published; detailed source retained       |
| [architecture/claude-code-ai-sdk-provider.md](../../architecture/claude-code-ai-sdk-provider.md)                                                                         | design / current          | decision + reference  | [Accepted ADR 0018](../../architecture/decisions/0018-isolate-claude-code-cognition-behind-its-ai-sdk-provider.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                        | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M05  | Done: accepted owner published; detailed source retained       |
| [architecture/claude-code-subscription-cognition-reprobe.md](../claude-code-subscription-cognition-reprobe.md)                                                           | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/codex-specialist-integration-evaluation.md](../codex-specialist-integration-evaluation.md)                                                                 | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | AS-DEL scenarios cited in source                                                                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M04  | Done: source responsibility/provenance retained and indexed    |
| [architecture/cognition-adapter-contract-decision.md](cognition-adapter-contract-decision.md)                                                                            | design / superseded       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | ADRs 0001, 0003, 0004, 0005; Preserve source-owned verification and traceability                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/cognition-backend-replacement-evaluation.md](../../guides/cognition-backend-replacement-evaluation.md)                                                     | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/cognition-opportunity.md](../../architecture/cognition-opportunity.md)                                                                                     | design / current          | decision + reference  | [Accepted ADR 0029](../../architecture/decisions/0029-persist-topic-free-cognition-decisions-and-explicit-silence.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | ADRs 0001, 0003, 0005; AS-AGY-01, AS-AGY-02                                                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/composable-agent-infrastructure-strategy.md](composable-agent-infrastructure-strategy.md)                                                                  | design / superseded       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | ADRs 0007; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/context-selection-failure-inventory.md](../context-selection-failure-inventory.md)                                                                         | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003; AS-MEM-05; Keep source-owned procedure/evidence links                                                                                  | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/context-selection-harm-evaluation.md](../context-selection-harm-evaluation.md)                                                                             | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0003; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/conversation-coherence-evaluation.md](../../guides/conversation-coherence-evaluation.md)                                                                   | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/conversation-context-turn-semantics.md](../../architecture/conversation-context-turn-semantics.md)                                                         | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0002, 0003; Preserve source-owned verification and traceability                                                                                    | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M04  | Done: source responsibility/provenance retained and indexed    |
| [architecture/conversation-memory-proposal-generation.md](../../architecture/conversation-memory-proposal-generation.md)                                                 | design / current          | decision + reference  | [Accepted ADR 0020](../../architecture/decisions/0020-generate-memory-candidates-from-bounded-durable-conversation-evidence.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                           | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M06  | Done: accepted owner published; detailed source retained       |
| [architecture/cross-surface-continuity-validation.md](../cross-surface-continuity-validation.md)                                                                         | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0003, 0005; Keep source-owned procedure/evidence links                                                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/cross-surface-conversation-continuity.md](../../architecture/cross-surface-conversation-continuity.md)                                                     | design / current          | decision + reference  | [Accepted ADR 0021](../../architecture/decisions/0021-persist-conversation-trajectories-independently-of-surfaces.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M06  | Done: accepted owner published; detailed source retained       |
| [architecture/decisions/0001-continuity-belongs-to-ember.md](../../architecture/decisions/0001-continuity-belongs-to-ember.md)                                           | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0001; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0002-preserve-persistent-meaning.md](../../architecture/decisions/0002-preserve-persistent-meaning.md)                                           | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0002; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0003-use-least-sufficient-permitted-projections.md](../../architecture/decisions/0003-use-least-sufficient-permitted-projections.md)             | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0003; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0004-separate-capability-from-authority.md](../../architecture/decisions/0004-separate-capability-from-authority.md)                             | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0004; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0005-distinguish-operational-continuity.md](../../architecture/decisions/0005-distinguish-operational-continuity.md)                             | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0005; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0006-adopt-typescript-on-nodejs-26.md](../../architecture/decisions/0006-adopt-typescript-on-nodejs-26.md)                                       | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0001, 0002, 0003, 0004, 0005, 0006, 0009; Preserve source-owned verification and traceability                                                      | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0007-use-systemd-supervised-episodic-runtime.md](../../architecture/decisions/0007-use-systemd-supervised-episodic-runtime.md)                   | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0001, 0005, 0006, 0007; Preserve source-owned verification and traceability                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0008-add-systemd-supervised-telegram-transport-worker.md](../../architecture/decisions/0008-add-systemd-supervised-telegram-transport-worker.md) | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0006, 0007, 0008; Preserve source-owned verification and traceability                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/0009-adopt-pnpm-as-package-manager.md](../../architecture/decisions/0009-adopt-pnpm-as-package-manager.md)                                       | decision / current        | retain ADR            | Preserve original accepted body/date/status and identity; append native implementation/verification guidance with existing concrete code/test references.                                                                                                | ADRs 0001, 0005, 0006, 0009; Preserve source-owned verification and traceability                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: native body reconciliation; historical meaning preserved |
| [architecture/decisions/README.md](../../architecture/decisions/README.md)                                                                                               | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0001, 0005, 0006, 0007, 0008; Keep source-owned procedure/evidence links                                                                           | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M10  | Done: source responsibility/provenance retained and indexed    |
| [architecture/delivery-reconciliation-runbook.md](../../guides/delivery-reconciliation-runbook.md)                                                                       | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0005; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/design-directions.md](../design-directions.md)                                                                                                             | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0001–0005; canonical concern syntheses and their evidence labels                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/durable-action-proposal-approval.md](../../architecture/durable-action-proposal-approval.md)                                                               | design / current          | decision + reference  | [Accepted ADR 0026](../../architecture/decisions/0026-bind-approval-to-one-attributable-and-still-current-action-proposal.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                             | ADRs 0002, 0004, 0005; AS-AUTH-05, AS-DEL-07                                                                                                            | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: accepted owner published; detailed source retained       |
| [architecture/durable-objective-langgraph-evaluation.md](../durable-objective-langgraph-evaluation.md)                                                                   | design / current          | decision + reference  | [Accepted ADR 0036](../../architecture/decisions/0036-defer-langgraph-until-a-measured-bounded-execution-gap-earns-it.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                 | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/durable-objective-lifecycle.md](../../architecture/durable-objective-lifecycle.md)                                                                         | design / current          | decision + reference  | [Accepted ADR 0035](../../architecture/decisions/0035-keep-durable-objectives-independent-of-execution-episodes.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                       | ADRs 0001, 0002, 0004, 0005; Preserve source-owned verification and traceability                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/endogenous-attention-control.md](../../architecture/endogenous-attention-control.md)                                                                       | design / current          | decision + reference  | [Accepted ADR 0031](../../architecture/decisions/0031-defer-repeated-cognition-over-unchanged-projected-grounding.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/endogenous-cognition-decision.md](../../architecture/endogenous-cognition-decision.md)                                                                     | design / current          | decision + reference  | [Accepted ADR 0029](../../architecture/decisions/0029-persist-topic-free-cognition-decisions-and-explicit-silence.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/endogenous-concern-activation.md](../../architecture/decisions/0030-represent-dormant-concerns-with-existing-live-commitments.md)                          | design / current          | consolidated into ADR | Accepted ADR 0030 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/endogenous-interruption-decision.md](../../architecture/decisions/0032-separate-completed-cognition-from-permission-to-interrupt.md)                       | design / current          | consolidated into ADR | Accepted ADR 0032 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | ADRs 0004, 0005; AS-AGY-05                                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/endogenous-restart-continuity.md](../../guides/endogenous-restart-continuity.md)                                                                           | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/endogenous-selectivity-evaluation.md](../endogenous-selectivity-evaluation.md)                                                                             | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/endogenous-silence-lifecycle.md](../../architecture/decisions/0029-persist-topic-free-cognition-decisions-and-explicit-silence.md)                         | design / current          | consolidated into ADR | Accepted ADR 0029 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/episodic-runtime-recovery-validation.md](../episodic-runtime-recovery-validation.md)                                                                       | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0005, 0007; Keep source-owned procedure/evidence links                                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/episodic-runtime-runbook.md](../../guides/episodic-runtime-runbook.md)                                                                                     | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0006, 0007; Keep source-owned procedure/evidence links                                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/external-agent-runtime-spike.md](external-agent-runtime-spike.md)                                                                                          | design / historical       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | ADRs 0001, 0003, 0004, 0005; Preserve source-owned verification and traceability                                                                        | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/google-calendar-readonly-runbook.md](../../guides/google-calendar-readonly-runbook.md)                                                                     | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/graph-memory-spike-evaluation.md](../graph-memory-spike-evaluation.md)                                                                                     | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/initial-model.md](initial-model.md)                                                                                                                        | design / superseded       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/interaction-surface-boundary.md](../../architecture/interaction-surface-boundary.md)                                                                       | design / current          | decision + reference  | [Accepted ADR 0037](../../architecture/decisions/0037-keep-interaction-occurrences-and-delivery-truth-transport-neutral.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                               | ADRs 0001, 0003, 0004, 0005, 0008; AS-OPS-01, AS-OPS-02, AS-OPS-03, AS-OPS-05, AS-OPS-06                                                                | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/langgraph-durable-execution-evaluation.md](../langgraph-durable-execution-evaluation.md)                                                                   | design / current          | decision + reference  | [Accepted ADR 0036](../../architecture/decisions/0036-defer-langgraph-until-a-measured-bounded-execution-gap-earns-it.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                 | ADRs 0007; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/long-lived-runtime-requirements.md](../../architecture/long-lived-runtime-requirements.md)                                                                 | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0005, 0006; Preserve source-owned verification and traceability                                                                                    | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: source responsibility/provenance retained and indexed    |
| [architecture/longitudinal-continuity-harness.md](../../guides/longitudinal-continuity-harness.md)                                                                       | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/longitudinal-currentness-evaluation.md](../longitudinal-currentness-evaluation.md)                                                                         | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003; AS-MEM-03; Keep source-owned procedure/evidence links                                                                                  | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/longitudinal-degraded-context-evaluation.md](../longitudinal-degraded-context-evaluation.md)                                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003; AS-CONT-04, AS-MEM-04, AS-MEM-05; Keep source-owned procedure/evidence links                                                           | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/longitudinal-provenance-evaluation.md](../longitudinal-provenance-evaluation.md)                                                                           | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/mastra-composable-infrastructure-evaluation.md](mastra-composable-infrastructure-evaluation.md)                                                            | design / historical       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | ADRs 0007; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/mcp-capability-source.md](../../architecture/mcp-capability-source.md)                                                                                     | design / current          | decision + reference  | [Accepted ADR 0025](../../architecture/decisions/0025-map-mcp-tools-explicitly-into-bounded-ember-capabilities.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                        | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: accepted owner published; detailed source retained       |
| [architecture/memory-proposal-semantics.md](../../architecture/decisions/0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md)                    | design / current          | consolidated into ADR | Accepted ADR 0019 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | ADRs 0002, 0004; Preserve source-owned verification and traceability                                                                                    | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M06  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/minimal-codex-specialist-delegation.md](../../architecture/minimal-codex-specialist-delegation.md)                                                         | design / current          | decision + reference  | [Accepted ADR 0027](../../architecture/decisions/0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                        | ADRs 0003, 0005; AS-DEL scenarios cited in source                                                                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: accepted owner published; detailed source retained       |
| [architecture/minimal-continuity-runbook.md](../../guides/minimal-continuity-runbook.md)                                                                                 | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/minimal-continuity-slice.md](minimal-continuity-slice.md)                                                                                                  | design / current          | decision + reference  | [Accepted ADR 0023](../../architecture/decisions/0023-persist-validated-canonical-snapshots-under-a-single-writer-lease.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                               | ADRs 0001, 0002, 0003, 0004, 0005, 0006; AS-CONT-01, AS-CONT-02, AS-CONT-05, AS-MEM-01, AS-MEM-04                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M06  | Done: accepted owner published; detailed source retained       |
| [architecture/openai-agents-sdk-execution-toolkit-evaluation.md](openai-agents-sdk-execution-toolkit-evaluation.md)                                                      | design / historical       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| [architecture/proactive-contact-attention-policy.md](../../architecture/proactive-contact-attention-policy.md)                                                           | design / current          | decision + reference  | [Accepted ADR 0034](../../architecture/decisions/0034-revalidate-authority-and-attention-before-proactive-handoff.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/proactive-contact-evaluation.md](../../guides/proactive-contact-evaluation.md)                                                                             | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/proactive-contact-intent.md](../../architecture/proactive-contact-intent.md)                                                                               | design / current          | decision + reference  | [Accepted ADR 0033](../../architecture/decisions/0033-represent-proactive-contact-as-durable-intent-distinct-from-delivery.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                            | ADRs 0005; Preserve source-owned verification and traceability                                                                                          | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/process-restart-continuity-evaluation.md](../../guides/process-restart-continuity-evaluation.md)                                                           | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0001; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/raspberry-pi-resource-evaluation.md](../raspberry-pi-resource-evaluation.md)                                                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0006; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/raspberry-pi-resource-validation.md](../../guides/raspberry-pi-resource-validation.md)                                                                     | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/retrieval-indexing-evaluation.md](../retrieval-indexing-evaluation.md)                                                                                     | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0006; Keep source-owned procedure/evidence links                                                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/runtime-resource-evaluation.md](../runtime-resource-evaluation.md)                                                                                         | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0007; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/semantic-continuity-evaluation.md](../../guides/semantic-continuity-evaluation.md)                                                                         | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0002, 0003; AS-CONT-01, AS-DEL-03, AS-MEM-01, AS-MEM-04; Keep source-owned procedure/evidence links                                                | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/semantic-state-representation-boundary.md](../../architecture/semantic-state-representation-boundary.md)                                                   | design / current          | decision + reference  | [Accepted ADR 0022](../../architecture/decisions/0022-keep-semantic-state-independent-of-encodings-and-materialized-views.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                             | ADRs 0002, 0003; Preserve source-owned verification and traceability                                                                                    | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M06  | Done: accepted owner published; detailed source retained       |
| [architecture/setup-and-onboarding-semantics.md](../../guides/setup-and-onboarding.md)                                                                                   | design / current          | decision + reference  | [Accepted ADR 0038](../../architecture/decisions/0038-separate-machine-setup-lineage-selection-and-conversational-onboarding.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                          | ADRs 0001, 0002, 0003, 0004, 0005; Preserve source-owned verification and traceability                                                                  | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: accepted owner published; detailed source retained       |
| [architecture/setup-onboarding-validation.md](../../guides/setup-onboarding-validation.md)                                                                               | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/source-layout.md](../../architecture/source-layout.md)                                                                                                     | design / current          | decision + reference  | [Accepted ADR 0015](../../architecture/decisions/0015-centralize-application-coordination-and-inward-dependencies.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                                     | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M05  | Done: accepted owner published; detailed source retained       |
| [architecture/specialist-authority-context-flow.md](../../architecture/decisions/0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md)       | design / current          | consolidated into ADR | Accepted ADR 0027 retains the architectural constraints; original redundant source is removed from the active tree and available in Git history.                                                                                                         | ADRs 0003, 0004; AS-DEL-05, AS-DEL-07                                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: consolidated by approved reorganization 2026-10-28       |
| [architecture/specialist-result-reintegration.md](../../architecture/specialist-result-reintegration.md)                                                                 | design / current          | decision + reference  | [Accepted ADR 0028](../../architecture/decisions/0028-reintegrate-specialist-results-through-a-currentness-and-provenance-gate.md) owns the extracted decision; retain source details/procedures/evidence under its owner notice.                        | ADRs 0002, 0004, 0005; AS-DEL-00, AS-DEL-02, AS-DEL-03, AS-DEL-06                                                                                       | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M07  | Done: accepted owner published; detailed source retained       |
| [architecture/telegram-bot-framework-evaluation.md](../telegram-bot-framework-evaluation.md)                                                                             | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADR 0008 protocol-client amendment; [operational evidence](../telegram-transport-operational-evidence.md)                                               | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M08  | Done: source responsibility/provenance retained and indexed    |
| [architecture/telegram-surface-runbook.md](../../guides/telegram-surface-runbook.md)                                                                                     | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0007, 0008; Keep source-owned procedure/evidence links                                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/telegram-transport-operational-evidence.md](../telegram-transport-operational-evidence.md)                                                                 | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/typescript-adoption-validation.md](../typescript-adoption-validation.md)                                                                                   | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0004, 0006; Keep source-owned procedure/evidence links                                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/typescript-runtime-evaluation.md](../typescript-runtime-evaluation.md)                                                                                     | design / current          | retain                | Retain design responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADR 0006; [adoption evidence](../typescript-adoption-validation.md)                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [architecture/vercel-ai-sdk-modular-cognition-evaluation.md](vercel-ai-sdk-modular-cognition-evaluation.md)                                                              | design / superseded       | historical            | Retain original dated source and explicit historical/supersession label and replacement path; do not refresh observations into current claims.                                                                                                           | Preserve source-owned verification and traceability                                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: lifecycle/replacement retained and indexed               |
| `documentation-discovery-evaluation.md` (removed 2026-10-28)                                                                                                             | reference / current       | removed; Git history  | Maintainer-approved cleanup: [ADR 0014](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28); reusable governance is in docs/README.md and original files remain in Git history. | ADRs 0001, 0005; Keep source-owned procedure/evidence links                                                                                             | Preserve historical filename/provenance; remove retired instructions and avoid dangling links.                                                        | M09  | Done: removed from active tree by approved cleanup             |
| `documentation-discovery-guide.md` (removed 2026-10-28)                                                                                                                  | guide / current           | removed; Git history  | Maintainer-approved cleanup: [ADR 0014](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28); reusable governance is in docs/README.md and original files remain in Git history. | Keep source-owned procedure/evidence links                                                                                                              | Preserve historical filename/provenance; remove retired instructions and avoid dangling links.                                                        | M10  | Done: removed from active tree by approved cleanup             |
| `documentation-discovery.md` (removed 2026-10-28)                                                                                                                        | design / current          | removed; Git history  | Maintainer-approved cleanup: [ADR 0014](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28); reusable governance is in docs/README.md and original files remain in Git history. | [deprecated ADR 0010](../../architecture/decisions/0010-adopt-adr-centered-documentation.md); existing discovery evaluation and seven routing scenarios | Preserve historical filename/provenance; remove retired instructions and avoid dangling links.                                                        | M10  | Done: removed from active tree by approved cleanup             |
| [principles.md](../../principles.md)                                                                                                                                     | foundation / current      | retain                | Retain foundation responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                | Foundation constraining all decisions; preserve purpose/principles.                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/README.md](../README.md)                                                                                                                                       | guide / current           | retain                | Retain guide responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                     | ADRs 0007; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M10  | Done: source responsibility/provenance retained and indexed    |
| [research/action-authority-and-permission-references.md](../action-authority-and-permission-references.md)                                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0004, 0005; [canonical concern](../action-authority-and-permission.md)                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/action-authority-and-permission.md](../action-authority-and-permission.md)                                                                                     | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0004, 0005; [concern evidence](../action-authority-and-permission-references.md)                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/capabilities-and-delegation-references.md](../capabilities-and-delegation-references.md)                                                                       | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004, 0005; [canonical concern](../capabilities-and-delegation.md)                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/capabilities-and-delegation.md](../capabilities-and-delegation.md)                                                                                             | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004, 0005; [concern evidence](../capabilities-and-delegation-references.md)                                                           | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/context-selection-and-cognitive-framing-references.md](../context-selection-and-cognitive-framing-references.md)                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004; [canonical concern](../context-selection-and-cognitive-framing.md)                                                               | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/context-selection-and-cognitive-framing.md](../context-selection-and-cognitive-framing.md)                                                                     | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004; [concern evidence](../context-selection-and-cognitive-framing-references.md)                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/continuity-and-identity-references.md](../continuity-and-identity-references.md)                                                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0005; [canonical concern](../continuity-and-identity.md)                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/continuity-and-identity.md](../continuity-and-identity.md)                                                                                                     | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0005; [concern evidence](../continuity-and-identity-references.md)                                                                           | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/endogenous-agency-and-self-initiated-behavior-references.md](../endogenous-agency-and-self-initiated-behavior-references.md)                                   | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004, 0005; [canonical concern](../endogenous-agency-and-self-initiated-behavior.md)                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/endogenous-agency-and-self-initiated-behavior.md](../endogenous-agency-and-self-initiated-behavior.md)                                                         | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003, 0004, 0005; [concern evidence](../endogenous-agency-and-self-initiated-behavior-references.md)                                         | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/hermes.md](../hermes.md)                                                                                                                                       | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/letta.md](../letta.md)                                                                                                                                         | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/long-lived-runtime-topology-comparison.md](../long-lived-runtime-topology-comparison.md)                                                                       | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | ADRs 0007; Keep source-owned procedure/evidence links                                                                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/memory-and-remembering-references.md](../memory-and-remembering-references.md)                                                                                 | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003; [canonical concern](../memory-and-remembering.md)                                                                                      | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/memory-and-remembering.md](../memory-and-remembering.md)                                                                                                       | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0002, 0003; [concern evidence](../memory-and-remembering-references.md)                                                                            | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/nanobot.md](../nanobot.md)                                                                                                                                     | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/openclaw-documentation-discovery.md](openclaw-documentation-discovery.md)                                                                                      | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/openclaw.md](../openclaw.md)                                                                                                                                   | reference / current       | retain                | Retain reference responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                 | Keep source-owned procedure/evidence links                                                                                                              | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/operational-model-sessions-and-surfaces-references.md](../operational-model-sessions-and-surfaces-references.md)                                               | evidence / current        | retain                | Retain evidence responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0002, 0004, 0005; [canonical concern](../operational-model-sessions-and-surfaces.md)                                                         | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/operational-model-sessions-and-surfaces.md](../operational-model-sessions-and-surfaces.md)                                                                     | research / current        | retain                | Retain research responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                  | ADRs 0001, 0002, 0004, 0005; [concern evidence](../operational-model-sessions-and-surfaces-references.md)                                               | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/action-authority-and-permission-deep-research.md](action-authority-and-permission-deep-research.md)                                            | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0004, 0005; [canonical concern](../action-authority-and-permission.md)                                                                             | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/capabilities-and-delegation-deep-research.md](capabilities-and-delegation-deep-research.md)                                                    | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0002, 0003, 0004, 0005; [canonical concern](../capabilities-and-delegation.md)                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/context-selection-and-cognitive-framing-deep-research.md](context-selection-and-cognitive-framing-deep-research.md)                            | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0002, 0003, 0004; [canonical concern](../context-selection-and-cognitive-framing.md)                                                               | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/continuity-and-identity-deep-research.md](continuity-and-identity-deep-research.md)                                                            | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0001, 0005; [canonical concern](../continuity-and-identity.md)                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/endogenous-agency-and-self-initiated-behavior-deep-research.md](endogenous-agency-and-self-initiated-behavior-deep-research.md)                | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0002, 0003, 0004, 0005; [canonical concern](../endogenous-agency-and-self-initiated-behavior.md)                                                   | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/memory-and-remembering-deep-research.md](memory-and-remembering-deep-research.md)                                                              | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0002, 0003; [canonical concern](../memory-and-remembering.md)                                                                                      | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [research/source-material/operational-model-sessions-and-surfaces-deep-research.md](operational-model-sessions-and-surfaces-deep-research.md)                            | source / current          | retain                | Retain source responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                    | ADRs 0001, 0002, 0004, 0005; [canonical concern](../operational-model-sessions-and-surfaces.md)                                                         | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |
| [vision.md](../../vision.md)                                                                                                                                             | foundation / current      | retain                | Retain foundation responsibility and existing source/traceability links; static directory index supplies navigation. Research/evidence is not silently converted into accepted decisions.                                                                | Foundation constraining all decisions; preserve purpose/principles.                                                                                     | Preserve original evidence, dates, source headings, stable scenario IDs, uncertainty and known implementation limits; accepted ADRs govern decisions. | M09  | Done: source responsibility/provenance retained and indexed    |

## Review and completion log

### First-phase review package — 2026-10-27

Historical snapshot prepared before acceptance; M02 is now complete. The later
M03/M04 package below records the current execution and review state.

M01's inventory is complete. M02 remains in progress until the maintainer reviews
the inventory and [proposed ADR 0010](../../architecture/decisions/0010-adopt-adr-centered-documentation.md).
M03 and subsequent implementation tasks remain not started.

The ADR readiness review confirms an attributable trigger, explicit alternatives,
scope and non-goals, semantic/implementation template rules, retrospective handling,
lifecycle and partial-supersession rules, affected paths, phased implementation,
and checkable verification criteria. The proposal uses the approved conversational
plan as captured intent. Its acceptance and the implementation verification
checkboxes remain pending; a review-ready proposal is not an accepted decision.

Validation completed for this package:

- All 119 baseline paths occur exactly once in the ledger; all 27 candidate keys
  have source rows and assigned domain tasks.
- All local links and section anchors in the tracker and proposed ADR resolve.
- The acceptance catalogue retains its 40 existing scenario headings; no scenario
  or accepted ADR content was changed in this phase.
- `pnpm test:docs` timed out after 20 seconds without test output. Its exact package
  script command, `node --test "tests/docs-discovery*.test.ts"`, passed all 23 tests.
- `node scripts/docs-discovery.ts check` validated all 121 participating documents.
- `npx oxfmt` formatted the four touched documentation files, and
  `npx oxlint --deny-warnings --format=agent` passed.

First-phase acceptance will allow M03 tooling adaptation to begin. Candidate records
remain proposed dispositions until their own pilot/domain reviews; accepting the
inventory does not pre-accept their unwritten decisions.

| Date       | Task / gate      | Evidence and outcome                                                                                                                  | Estimate or scope changes                                                   |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-10-27 | Plan created     | Investigation converted into an execution tracker; all migration tasks remain not started                                             | Initial estimate: 64–116 h plus 5–12 h maintainer review                    |
| 2026-10-27 | M01 complete     | Baseline commit, 119-source ledger, 27 candidate catalogue, and seven reconciliation findings recorded; structural/link checks passed | 27 extracted candidates plus governance ADR 0010; retain budget until pilot |
| 2026-10-27 | M02 review ready | ADR 0010 drafted as proposed and added to the proposed-governance index; documentation tests, discovery, and strict lint passed       | Await first-phase review; M03 has not started                               |
| 2026-10-27 | M02 accepted     | Maintainer approved the concrete policy and inventory; ADR 0010 accepted and index updated                                            | M03 authorized                                                              |
| 2026-10-27 | M03 complete     | Compatible helpers, templates, shared parser/validation, fixture tests, and independent skill evaluation pass                         | Existing repository-check limitations are recorded below                    |
| 2026-10-27 | M04 review ready | ADRs 0011–0013 drafted with original-source links and preservation checks; all 44 related behavior tests pass                         | Await pilot acceptance before publishing dispositions and starting M05–M07  |

### Historical M03 tooling and M04 pilot review package — 2026-10-27 (withdrawn)

This historical package describes the earlier approach, withdrawn after the maintainer
chose the unmodified ADR skill. ADR 0010 is now deprecated; the custom helpers,
validator, semantic template, and tests described here have been removed.

At the time of this package, the maintainer had approved the first phase and ADR
0010 was accepted.
M03 is implemented; root agent routing still uses the existing documentation skill
until M10. The three actual pilot records remain proposed for the next phase review:

| Candidate | Pilot record                                                                                                | Current source / disposition after acceptance                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| C01       | [ADR 0011](../../architecture/decisions/0011-keep-streamed-cognition-provisional-until-final-validation.md) | Streaming source remains current for review; after acceptance it becomes explicitly superseded by the ADR                                    |
| C02       | [ADR 0012](../../architecture/decisions/0012-keep-codex-exec-for-bounded-specialist-work.md)                | Integration choice moves to the ADR; preserve the 2026-09-02 comparison as supporting evidence at its original path                          |
| C03       | [ADR 0013](../../architecture/decisions/0013-keep-conversation-identity-and-context-ember-owned.md)         | Semantic invariants move to the ADR; retain the original path as a concise contract/navigation reference for implementation and open choices |

#### Tooling implementation and validation

- Native ESM helper entry points share `scripts/adr-tools.ts` and the existing
  discovery parser. Both template classes and an options-heavy implementation variant
  emit valid discovery/lifecycle metadata; numeric IDs and classified indexes are
  maintained without bootstrapping over an existing corpus.
- Lifecycle operations preserve creation dates and fenced examples, support legacy
  bold/section statuses and explicit normalization, serialize writers, and preflight
  structure, discovery, IDs, supersession, and index changes. Full replacement links
  both ways and updates records/indexes together; partial amendments remain explicit
  prose under accepted/current records.
- `scripts/check-adrs.ts` is included in `pnpm check`; `pnpm test:docs` now includes
  the ADR helper fixtures. Documentation describes the new validation surface.
- The fixture suite verifies legacy compatibility, semantic acceptance without an
  implementation plan, preservation on invalid input, replacement handling, ID/index
  conflicts, lock contention, and symlink escape rejection.
- An independent skill-creator forward test used isolated repositories to draft a
  semantic record with open representation, maintain an accepted implementation record
  without changing its decision/date, normalize legacy status, and exercise bootstrap.
  The fixtures passed; no actual repository decision was accepted by that test.
- The bundled skill quick validator could not run because available Python interpreters
  lack PyYAML. Its frontmatter constraints were reviewed directly, and the independent
  behavioral check exercised the actual skill and helpers. No dependency was installed.

#### Pilot preservation and evidence

- C01 preserves optional streaming, replaceable ephemeral snapshots, authoritative
  final validation, observer-error isolation, capability policy, and truthful failure.
- C02 retains the dated exec/App Server/SDK comparison, blocked-versus-live approval,
  effect uncertainty, and all four adoption triggers. It does not claim to re-evaluate
  current external SDKs or CLI releases.
- C03 maps all fifteen original invariants and every open representation category.
  Shared-ground/awareness, replay/turn identity, cross-surface disclosure, bounded
  participation, and truthful gaps remain explicit without selecting storage or budgets.
- The five relevant existing test files passed all **44 tests**: five streaming,
  29 specialist, one ownership validator, eight conversation-evaluation, and one
  cross-surface/restart test. These support selected implementation traces and do not
  turn the semantic record into a claim of exhaustive conversational correctness.
- Original sources have explicit links to their proposals and remain current. No
  candidate has been accepted or source retired ahead of the pilot review.

#### Remaining checks and effort

Final package validation:

- `node --test "tests/docs-discovery*.test.ts" tests/adr-tools.test.ts` passed **47 tests**
  (23 discovery tests and 24 ADR helper tests).
- `node scripts/docs-discovery.ts check` validated all **124 participating documents**;
  `node scripts/check-adrs.ts` passed lifecycle, structure, ID, supersession, and index checks.
- The five pilot-related behavior test files passed **44 tests**. All **413 local links
  and anchors** across changed/new Markdown resolved, including skill references.
- Baseline comparison confirms all 119 original source rows are accounted for and
  the original nine ADRs and 40-scenario acceptance catalogue are unchanged.
- Focused strict TypeScript checking of `scripts/adr-tools.ts`, `scripts/check-adrs.ts`,
  and their discovery import passed with the repository compiler options and Node types.
- `node scripts/check-dependencies.ts`, `npx oxlint --fix`, `npx oxfmt`,
  `npx oxlint --deny-warnings --format=agent`, and `git diff --check` passed.
- `pnpm check` did not complete within 20 seconds; migration checks ran directly.

The root TypeScript check still has
two pre-existing `FinishReason`/`InferenceFinishReason` errors at lines 220 and 246 of
`packages/core/src/ai/cognition.ts`; that file was not changed. No migration tooling
diagnostic remains. The original `pnpm check` also references a `test:types` script
that is absent from the package manifest; this migration does not invent that suite.
The local pnpm executable has previously stalled, so required script equivalents are
run directly with the initialized repository Node when needed.

The mandatory full formatter also added missing semicolons in the experimental
`../../packages/agent` and removed a trailing comma in `tsconfig.json`.
Those changes are formatting only. No runtime behavior or production API changed.

Pilot drafting produced three records without requiring an additional decision class,
metadata grammar, or independent adoption choice. The agent's human-equivalent working
hours were not measured; retain the original 64–116-hour sizing budget rather than
inventing an actual-hours figure. M05–M09 have 30–58 focused hours budgeted; M10–M11
have 10–18 hours, plus remaining phase review. No scope expansion is proposed.

After pilot acceptance, publish those three dispositions and start M05–M07. M04 remains
in progress until that review; M05 and later tasks remain not started.

### Current-direction revision — 2026-10-27

The maintainer explicitly chose the original ADR skill rather than adapting it to
Ember. All eleven tracked skill files were restored byte-for-byte from the original
repository version; the custom semantic template, helper implementation, ADR checker,
helper tests, and package/guide integration were removed. Repository formatting now
excludes the original skill so its files remain unchanged.

All thirteen ADR headers now contain only native `status`, `date`, and
`decision-makers` fields. Recorded statuses/dates and the original nine records' body
content are preserved; duplicated body status/date bullets were moved to frontmatter.
Unknown original attribution is explicit. ADR 0010 is deprecated as withdrawn policy.
Pilot records 0011–0013 remain proposed, with native simple-template headings and an
Implementation Plan in every record. There is no semantic-template exemption.

The catalogue is provisionally separate from the skill. Its native ADR projection
is ephemeral and supports the original linked supersession status. Non-ADR metadata
is unchanged pending the maintainer's catalogue-retention preference. This is a
reversible compatibility step, not permission to modify the skill again.

Verification for this revision:

- `node --test "tests/docs-discovery*.test.ts"`: **26 passing tests**, including native
  metadata without source modification, linked supersession, and invalid required fields.
- `node scripts/docs-discovery.ts check`: **124 documents validated**.
- Focused strict TypeScript check of the discovery utility passed with repository
  compiler options and Node types.
- `npx oxlint --fix`, `npx oxfmt`, and strict lint passed. Post-format byte comparison
  confirms the original skill has no diff and no added semantic template.
- All thirteen ADR frontmatters use only native fields; the original nine records'
  content matches the baseline after moving status/date into metadata.
- Local link/anchor review distinguishes inline-code syntax examples from rendered
  Markdown links. The 40-scenario catalogue remains unchanged.

The historical 47-test custom-helper results above apply only to the withdrawn
implementation; they are not current checks. Existing unrelated root typecheck/pnpm
limitations are unchanged. M02/M03 remain open only for the replacement policy and
catalogue choice; no bulk conversion has begun.

## Governing and supporting sources

- `documentation-discovery.md` (removed; see [cleanup record](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28))
- Former discovery guide: `documentation-discovery-guide.md` (removed; see [cleanup record](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28))
- [Existing ADRs and decision discipline](../../architecture/decisions/README.md)
- [Acceptance scenarios](../../architecture/acceptance-scenarios.md)
- [Research governance](../README.md)
- Former discovery guide: `documentation-discovery-guide.md` (removed; see [cleanup record](../../architecture/decisions/0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28))
- [ADR skill](../../../.agents/skills/adr-skill/SKILL.md)

## Catalogue retirement — 2026-10-27

- [x] Record approved native-skill/catalogue-retirement governance (M02).
- [x] Remove catalogue metadata/tooling/tests and CI/package wiring; preserve lifecycle in prose (M03).
- [x] Add complete directory navigation and switch root instructions (early M10).
- [x] Review and accept native pilot ADRs (M04); domain batches may proceed.
- [ ] Complete domain conversion, existing-record body reconciliation, and final audit (M05–M11).

No package, lockfile, or TypeScript configuration edits belong to this retirement.

Retirement verification: all 1,259 local Markdown link targets resolve; every
non-index document appears in its directory index; no source frontmatter retains
catalogue routing keys. All 11 original ADR skill files match HEAD byte-for-byte.
All 1,412 files captured under `packages/`, plus the lockfile and TypeScript
configuration, match their pre-retirement bytes. Scoped lint fixes and formatting,
strict repository lint, and `git diff --check` passed. The deleted discovery tests
were retired with their implementation; no runtime behavior changed.

## M04 native pilot acceptance — 2026-10-27

Review: all three records pass the unchanged skill checklist. ADR 0011 retains
optional streaming, ephemeral snapshots, observer-failure isolation, final validation,
and one capability execution path. ADR 0012 retains the dated comparison, all four
adoption triggers, authority separation, and cancellation/effect uncertainty. ADR
0013 retains all fifteen invariants and every unresolved representation category.

Published dispositions: streaming decision superseded at its source, dated Codex
evaluation preserved as evidence, conversation source retained as detailed supporting
reference with decision ownership transferred explicitly. Existing source headings
and anchors remain stable. No implementation tasks are reopened: these ADRs record
existing boundaries and their ongoing constraints. Further extraction belongs to
M05–M08; empirical evidence remains bounded by its original test/version context.

## M05 — Application and cognition phase review

Four proposals use the original simple template, native metadata, implementation
plans, alternatives, and checkable verification. Filenames continue Ember's established numeric sequence: ADR 0014 records catalogue
retirement, and ADRs 0015–0018 cover C04–C07. The skill remains unchanged.

- [x] C04 extracts application ownership from canonical flow/source layout, preserving
      inward dependencies, the ten-step interaction path, durable responsibility splits,
      operator exceptions, and maintained source maps.
- [x] C05 extracts the SDK seam, disclosure/tool/error/evidence boundaries and preserves
      loopback Ollama versus hosted DeepSeek credential/configuration distinctions.
- [x] C06 preserves typed control, shape-versus-semantics validation, projection-only
      disclosure, disabled retries, and generic-process compatibility.
- [x] C07 preserves Claude's fixed settings, subscription credential ownership,
      one-shot context, bounded isolation claim, and truthful abort/timeout evidence.
- [x] Complete targeted deterministic verification: 91 tests passed across 11 files; production dependency check passed.
- [x] Maintainer phase review accepted ADRs 0015–0018 and resolved the error-cause wording.
- [x] Transfer source ownership, retaining detailed implementation maps,
      procedures, dated evidence, and existing anchors; ADRs are now the decision owners.

Review finding: current `ai/cognition.ts` retains some API/retry/unknown errors as
in-memory `ProviderError.cause`; the old source states none cross that boundary.
Claude authentication classification inspects such causes. C05 flags the conflict
explicitly and distinguishes semantic/normalized-evidence redaction from in-memory
cause isolation. Phase review must resolve the documentation claim without silently
changing package code or weakening the actual canonical/evidence disclosure boundary.

M05 verification — 2026-10-27: all 91 tests across the eleven targeted files passed,
including application/dependency enforcement, direct/tool cognition, failure
classification, Ollama/DeepSeek configuration, structured opportunity evaluation,
Codex/Cursor bridges, and Claude isolation. `node scripts/check-dependencies.ts`
passed. No live provider was called. Source comparison found no missing architectural
constraint in C04/C06/C07; C05 preserves the intended boundary and explicitly flags
the source/code cause-handling conflict. Proposed resolution: describe in-memory
causes accurately, retaining the exclusion from semantic results and normalized
evidence; do not change runtime cause handling in this documentation phase.

ADR review: concrete affected paths, implementation patterns, unchanged dependencies,
non-goals, alternatives, measurable verification, and revisit conditions are present.
Approval is pending for the batch and the explicit cause-handling documentation
resolution. Source ownership transfers only after that review.

## ADR filename consistency — 2026-10-27

At the maintainer's request, continue the existing numeric filename convention.
Catalogue-retirement governance is ADR 0014; C04–C07 are ADRs 0015–0018 in candidate
order. Titles and repository links follow those numbers. Statuses and decision content
are unchanged; M05 proposals still await phase acceptance. This repository convention
does not modify the original ADR skill.

## M05 completion — 2026-10-27

- [x] Accept ADRs 0015–0018 following maintainer phase review.
- [x] Publish explicit accepted decision owners in all five source references.
- [x] Correct in-memory error-cause wording to match current code, preserving the
      distinction from semantic results and normalized inference evidence.
- [x] Qualify historical AI SDK patch pins and retain dated provider evidence.
- [x] Preserve source headings, implementation procedures/maps, and local links.

The previously recorded 91 deterministic tests and production dependency check passed
for the unchanged implementation. This completion edits documentation only; checks
are scoped to formatting, links/metadata, skill integrity, protected package bytes,
and strict lint. M06 remains the next phase; its decisions are not implicitly accepted.

## M06 — Analysis and implementation review

Analysis: five bounded extractions remain needed; no new runtime implementation is
required. Preserve the original proposal/adoption v1 restrictions (C08), generation
and partial-outcome ledger boundary (C09), explicit sidecar trajectory/migration (C10),
semantic identity and selective-view edit constraints (C11), and still-used canonical
snapshot/lease protocol independently of obsolete original runtime plans (C12).

- [x] Draft ADRs 0019–0023 with native metadata and required original-template sections.
- [x] Link every candidate/source/index while retaining source ownership pending review.
- [x] Preserve detailed examples, commands, schemas, original headings/anchors, and evidence.
- [x] Mark obsolete minimal-slice runtime/tooling instructions historical with current owners.
- [x] Complete targeted deterministic checks and the final source/invariant/link audit.
- [x] Maintainer phase acceptance, including the explicit ADR 0020 wording reconciliation.
- [x] Transfer architectural ownership and retain detailed source references.

Reconciliation finding: `buildMemoryProposalGenerationProjection` includes current
same-scope Ember-owned `agent_inference` facts as existing context in addition to
user-testimony facts/preferences. The source claims only testimony is disclosed.
The proposal records the actual filter without permitting inferred-fact supersession,
new grounding evidence, or selector changes. It requires explicit phase review before
correcting source authority. Existing deterministic tests must not be claimed to prove
this additional branch unless they actually exercise it; read-only code inspection
provides the implementation evidence for that detail.

All new records are proposals describing existing boundaries. Creation dates are not
fabricated original decision dates. No provider, filesystem, or graph capability is
claimed beyond the source's evidence. Active package work and the original skill remain
protected throughout this documentation phase.

### M06 verification and second review — 2026-10-27

The combined targeted run passed **97 tests across eleven files**: proposal policy,
conversation-memory generation, delivery-before-send recovery, recent dialogue,
cross-surface continuity, conversation validation/evaluation, Markdown materialization,
graph feasibility, canonical model/store, and longitudinal acceptance. No live provider
or external model was used. Existing tests establish selected traces, not universal
behavior; the extra inferred-fact disclosure filter is corroborated by code inspection.

The second review checked the planned source destinations and all critical boundaries:

| Candidate / ADR | Preservation audit                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C08 / 0019      | Four proposal families, unsupported commitment, attribution/availability, confidence dimensions, deterministic IDs, revision/collision rejection, reciprocal user-testimony supersession, non-mutating assessment.                                                                                      |
| C09 / 0020      | Disclosed evidence allowlist, unknown candidate input, eight-candidate/zero-retry bound, no-proposal versus failure, attempt-first ledger, per-candidate partial commits, truthful terminal uncertainty, delivery intent before reflection; inferred-fact context conflict remains explicit for review. |
| C10 / 0021      | Seven implementation invariants, one active cursor as current mechanism, explicit membership above store, bounded selection, source provenance, fresh reset without canonical deletion, conservative v1 migration, independent delivery/awareness truth.                                                |
| C11 / 0022      | All twelve source invariants and six migration requirements, four layers, stable IDs, deterministic/scoped/escaped views, strict approval testimony and selective edit grammar, stale/drift/alias checks, partial/ahead publication, no cross-file transaction, graph adoption still deferred.          |
| C12 / 0023      | Full UTF-8/schema validation, revision increment, token-checked local lease, safe PID probing, explicit quiescent quarantine, malformed/foreign/indeterminate lock refusal, sync/rename/directory-sync uncertainty; obsolete Node24/provider instructions excluded.                                     |

All five source paths, headings, procedures, scenarios, and evidence are preserved.
There are exactly five new M06 records with numeric IDs 0019–0023, native frontmatter,
required template sections, implementation plans, and checkable verification. They
remain proposed; no source is retired or acceptance invented. The protected-file audit
confirmed all 1,412 captured package/configuration files and all 11 original ADR skill
files unchanged. Scoped formatting, strict lint, diff whitespace, index coverage,
and local link/anchor checks complete the final audit. M06 is ready for phase review,
not marked complete until acceptance and publication of source dispositions.

## M06 completion — 2026-10-27

- [x] Maintainer accepted ADRs 0019–0023 and the explicit ADR 0020 correction.
- [x] Publish native accepted metadata, source owners, and accepted index entries.
- [x] Correct generation disclosure wording to include current same-scope Ember-inferred
      facts as context; testimony-only supersession and disclosed grounding remain unchanged.
- [x] Clarify that disclosed-evidence allowlisting occurs after assessment and before
      adoption, matching current code without changing validation or execution order.
- [x] Keep source headings, procedures, examples, scenarios, and dated evidence intact.
- [x] Keep obsolete minimal-slice runtime instructions historical under current owners.

The previously recorded 97 deterministic tests passed for the unchanged implementation.
Acceptance changes documentation only. Final metadata/status, link/anchor, formatting,
strict lint, source traceability, original-skill, and protected-file audits verify
publication. M07 is the next domain phase; its decisions are not accepted by this review.
Earlier pending-review wording in the analysis/verification log records historical
pre-acceptance state and is superseded by this completion entry and the current task table.

## M07 — Capability, authority, and delegation phase review

Analysis yields five extractions, no new runtime feature work. Preserve C13's firewall
and consequential Calendar specialization, C14's explicit MCP mapping/effect matrix,
C15's representation-neutral proposal/authority/correlation semantics, C16's combined
delegation/context envelope and interruption recovery, and C17's currentness/provenance
reintegration gate. Keep detailed source contracts and procedures available.

Reconciliation: earlier specialist sources say no new ADR was warranted for local
schema refinements. ADR 0027 consolidates durable cross-cutting ownership constraints
under the approved migration, not a second semantic model or new immutable specialist
schema. On acceptance qualify that historical wording and link the single owner;
do not mint another ADR for the companion context-flow note. ADR 0012 continues to
own exec versus App Server/SDK choice. Original AI 7.0.93 references in MCP evidence
are historical; migration-time manifests use AI 7.0.153/MCP 2.0.45 without a package change.

- [x] Draft native ADRs 0024–0028 with implementation/verification and numeric filenames.
- [x] Link all six sources, five candidates, and the ADR index; preserve source authority.
- [x] Preserve Calendar exact action/attempt/reconciliation details in C13 and broad
      semantic approval boundaries in C15 without claiming generic implementation coverage.
- [x] Consolidate context/authority into C16, preserve interruption/retry currentness,
      and keep C17's canonical eligibility separate from actual canonical mutation.
- [x] Run targeted deterministic verification and a second source/link/metadata audit.
- [x] Maintainer phase acceptance of the batch and specialist historical-wording clarification.
- [x] Publish accepted source ownership while retaining existing paths/anchors/evidence.

### M07 verification and second review — 2026-10-27

All **98 deterministic tests across eight files** passed: firewall, AI SDK capability
execution, Calendar read/create, action-effects evaluation, MCP fixture, Codex specialist,
and specialist reintegration. No live model, remote MCP server, or actual Calendar
account was invoked. Existing tests are evidence for selected traces, not proof of
generic multi-principal approval, all cross-surface correlation or arbitrary external
effect reconciliation.

| Candidate / ADR | Second-review preservation audit                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C13 / 0024      | Selected bindings versus authority, schema versus semantic validation, pre/post-entry cancellation, occurrence limits, 8 KiB output, zero retries/four steps, noncanonical evidence, consequential pre-effect durability, Calendar scope/redaction/exact proposal/recovery and no unsafe retry.                                                  |
| C14 / 0025      | Explicit trusted stdio configuration, discovered-tool mapping, untrusted source descriptions, bounded discovery/lifecycle, all failure/effect rows, observed closure, normalized results, all five replacement conditions, excluded MCP features and dated version evidence.                                                                     |
| C15 / 0026      | Proposal fields, immutable exact approval events, independent required authority boundaries, non-approval sources, rejection/withdrawal aggregation, five correlation conditions, awareness versus delivery, pre-effect checks, expiry/staleness/supersession, consumed occurrence and unresolved representation questions.                      |
| C16 / 0027      | Both sources consolidated; four episode input meanings, explicit workspace/context/authority, source attribution, structured expansion requests, AS-DEL-00–08 responsibilities, currentness/re-evaluation, foreground/no-reattachment limits, intent-persistence failures, process-loss crash window and effects-plus-continued-work retry gate. |
| C17 / 0028      | All nine production steps, current lease-held checkpoint, attributed report/exit, isolated candidate/currentness reuse, shape versus disposition, provenance grouping without fabricated independence, atomic audit/disposition, optimistic-check limits, contradictory-audit rejection and eligibility without automatic canonical mutation.    |

Five native records are numbered 0024–0028 and remain proposed. All six source paths,
headings, detailed procedures, scenarios and evidence remain available with proposed
backlinks; no independent record was added for the authority/context companion.
The final audit checks required template sections/native metadata, complete index
coverage, all repository local link targets and M07-specific anchors, formatting,
strict lint and diff whitespace. All 1,412 protected package/configuration files and
all 11 original ADR skill files remain byte-for-byte unchanged from the phase start.

Review result: concrete plans, dependencies/non-goals, alternatives and checkable
verification are present. No runtime change is needed. The batch is ready for the
agreed phase review, including qualification of the old no-subordinate-ADR wording
when source ownership is transferred. M07 remains in progress until acceptance and
publication of those dispositions; M08 is not started by this review package.

## M07 completion — 2026-10-27

- [x] Accept ADRs 0024–0028 following maintainer phase review.
- [x] Publish accepted native metadata and index status, and decision owners in six sources.
- [x] Qualify the old no-subordinate-ADR rationale as historical: ADR 0027 consolidates
      durable ownership constraints without freezing local specialist schema; no separate
      authority/context ADR is added and ADR 0012 retains integration-surface ownership.
- [x] Preserve source procedures, failure/authority matrices, scenarios, headings and evidence.
- [x] Label adoption-era MCP/AI pins historical without dependency changes.

The previously recorded 98 deterministic tests passed for the unchanged implementation.
Final publication checks cover metadata/status, source/index links and anchors, formatting,
strict lint, whitespace, original-skill integrity and protected package/configuration
bytes. M08 is next; its decisions are not accepted by this approval. Earlier proposal/
review-pending notes are retained as pre-acceptance history and superseded by this entry
and the current task table.

## M08 — Analysis and phase review

Ten records consolidate thirteen sources. C18 combines opportunity/evaluator/silence;
C25 preserves both LangGraph evaluations but gives the later concrete objective-flow
deferral its own decision. Existing runtime/process-topology ADRs remain unchanged.
All other candidates retain separate cognition, concern, attention, contact, objective,
occurrence/delivery and setup/onboarding responsibilities.

- [x] Draft native sequential ADRs 0029–0038 with implementation and verification sections.
- [x] Preserve source paths/headings/procedures/evidence and add proposed backlinks/index.
- [x] Keep measured attention limitation and dated LangGraph footprint/triggers explicit.
- [x] Record the contact-decision implementation gap rather than claim it is implemented.
- [x] Complete targeted deterministic verification and a second source/metadata/link audit.
- [x] Phase acceptance, including exact-token historical qualification and acknowledged
      contact-decision gap with follow-up ownership.
- [x] Transfer accepted source decision ownership and retain supporting references.

### Reconciliation and follow-up scope

**M08-F01:** `ai/codex-opportunity.ts` now uses the typed AI SDK opportunity evaluator.
The older endogenous evaluator source still describes an exact-token reply protocol.
ADR 0029 proposes qualifying that section as historical and pointing to ADR 0017/current
adapter, preserving old evidence/probe context without adopting a second current protocol.

**M08-F02:** the proactive-contact source requires durable contact_decision_id,
evaluating/no_contact/create_intent and recovery of interrupted decisions. Current
`ProactiveContactStore` has an intent-only ledger plus policy/handoff/delivery evidence;
repository inspection found no implementation of the separate contact-decision ledger.
ADR 0033 preserves the semantic requirement and explicitly separates it from implemented
store/bridge behavior. Track the missing ledger/replay/recovery/no-contact verification
as follow-up implementation owned by the agency/contact boundary, requiring separately
scoped schema/runtime work. This migration does not alter active packages. Phase review
must acknowledge that acceptance of documentation does not complete that runtime work.

**M08-F03:** the 2026-09-07 LangGraph conceptual ports are evaluated possibilities,
not adopted contracts. The 2026-09-17 objective evidence defers adoption. Preserve both
versions/dates, representative Darwin ARM measurements versus actual Pi requirements,
all six revisit conditions and effect/replay/currentness safeguards; do not reinstall
packages, rerun live benchmarks or turn historical pins into current constraints.

### M08 verification and second review — 2026-10-27

All **210 tests across 24 files** passed for the unchanged implementation: opportunity
and durable lifecycle, structured/Codex evaluator, dormant concerns and restart,
attention control/selectivity, interruption, proactive intent/policy/Telegram recovery,
objectives/action composition, application/surface semantics, delivery recovery,
setup/onboarding/evaluation and redacted diagnostics. The run used deterministic
fixtures rather than live provider accounts, remote services or new dependencies.
Existing tests are not evidence for absent contact-decision/no_contact persistence.

| Candidate / ADR | Second-review preservation audit                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C18 / 0029      | Topic-free mechanism, bounded normal projection, no fake user input, exact typed decision/grounding validation, pure/durable split, silence versus failure/loss, two-commit lifecycle, legacy/restart metrics; old Codex tokens explicitly pending historical qualification.                                |
| C19 / 0030      | Dormancy as nonmutation, live responsibility versus selected attention, four controlled activation cases, explicit scoped discharge/provenance/applicability end, closed commitment exclusion without a new concern class.                                                                                  |
| C20 / 0031      | Runtime/principal/scope/mechanism plus exact projection-set epoch, validated prior cognition grounding, no quiet/failure cache, changed-state reopening, measured 25/22 calls and three saved repeats limited to fixture; time-sensitive unchanged-ID limitation remains explicit.                          |
| C21 / 0032      | Genuine completed-cognition handoff, separate candidate/urgency/authority, current/live/scope grounding, four pure outcomes, exact complete-set repetition, quiet-period distinction and missing source versus successful private-only result.                                                              |
| C22 / 0033      | Eight intent responsibility groups, required durable contact/no-contact decision, seven dispositions, identity/currentness/satisfaction, successor rules, correlated send fences and eight restart invariants; implemented intent store/bridge distinguished from absent decision ledger.                   |
| C23 / 0034      | Nine-step terminal-before-temporary policy order, currentness independent of revision equality, six deferral owner/condition rows, bounded quiet windows, provenance duplicate evidence, UTF-16 tie-break, fresh agency observer and opt-in production handoff; no send/authority from eligibility.         |
| C24 / 0035      | Explicit user-intent creation, five lifecycle states/orthogonal progress, terminal revision restraint, attributable checkpoints/latest-timestamp ties and causal concurrent chronology, fresh resume, next responsibility, cancellation/effects and exact objective/action correlation.                     |
| C25 / 0036      | Later dated deferral owns present recommendation; earlier conceptual seam stays unadopted, Darwin ARM footprint not actual Pi benchmark, replaceable operational state, all six revisit criteria and restart/effect/replay/upgrade spike cases preserved.                                                   |
| C26 / 0037      | Occurrence key and strict replay metadata, planned cognition crash boundary, durable expression/representation before send, independent attempts/awareness, retry-safe versus uncertain, sidecar/no cross-file transaction, transport-neutral principal/scope/privacy and explicit-explanation distinction. |
| C27 / 0038      | All nineteen setup invariants, seven state domains, explicit restore/create/use and unresolved forks, bounded verification/secret isolation, ordinary memory/onboarding, skip/defer/resume, typed evidence spans, cancellation/partial effects, lease-held binding and optional operator integrations.      |

Final structural audit: ten proposed native records, numbered 0029–0038, mapped to
thirteen retained sources. All baseline source headings remain unchanged, so source
anchors/procedures/evidence are preserved. Repository ADR numbering is complete and
unique from 0001 through 0038. Native template/status/index/local target and M08-anchor
checks pass. All 1,412 protected package/configuration files and all 11 original ADR
skill files remain byte-for-byte unchanged from phase start. Scoped formatting, strict
lint and diff-whitespace checks complete publication of this review package.

### Follow-up M08-F02 — Durable contact-decision implementation (open)

Owner: agency/contact lifecycle boundary; requires separately scoped runtime/schema
work approved by the maintainer, outside this documentation migration and active package
edits. The task is explicit so semantic ADR acceptance cannot hide incomplete behavior.

- [ ] Design versioned contact-decision storage/correlation alongside current intent state,
      including valid completed source and bounded durable no_contact bases.
- [ ] Persist evaluating before decision; crash-consistently relate create_intent to
      exactly one intent; establish no_contact without a synthetic intent.
- [ ] Make replay return established outcome; recover interrupted evaluation as unknown;
      block inconsistent correlations instead of recreating decisions or claiming silence.
- [ ] Add behavior tests for repeated no-contact, failure/abort, restart crash windows,
      source/replay correlation, missing intent counterpart and inspection redaction.

M08 review recommendation: records are concrete and ready for phase review. Confirm
M08-F01 historical token qualification and acknowledge M08-F02 as an open runtime
obligation. Approval would accept the documented semantics and bounded implementation
evidence, not certify that missing behavior already exists. No source decision owner
is transferred and M08 remains in progress until that review is completed.

## M08 completion — 2026-10-27

- [x] Maintainer accepted ADRs 0029–0038 and both phase-review qualifications.
- [x] Publish native accepted metadata/status and owners across thirteen source documents.
- [x] Qualify obsolete exact-token Codex guidance as history and link current typed control.
- [x] Explicitly label the unimplemented contact-decision/no_contact ledger in ADR 0033,
      its source and index; retain M08-F02 as open agency/contact implementation work.
- [x] Distinguish older LangGraph conceptual ports from later current adoption deferral.
- [x] Preserve source headings/anchors, procedures, scenarios and dated evidence.

The earlier 210 deterministic tests passed for the unchanged runtime. Final acceptance
checks cover native status/template, index/source ownership, links/anchors, source
headings, complete 0001–0038 numbering, formatting, strict lint, whitespace and protected
package/skill bytes. M09 reconciliation is next. This completion accepts documentation,
not missing M08-F02 behavior; its implementation checkboxes intentionally remain open.
Earlier pending-phase statements remain historical review evidence and are overridden
by this completion and the current task table.

## Final migration audit and completion — 2026-10-27

The maintainer authorized completing M09–M11 without further phase approval pauses.
All migration tasks M01–M11 are complete. This closes documentation work; it does not
claim the separately tracked runtime obligation M08-F02 is implemented.

### Delivered corpus and reconciliation

- **38 ADRs:** 37 accepted and one deprecated (0010), with unique complete numeric
  sequence 0001–0038, native status/date/decision-makers, required implementation plans
  and checkbox verification. The original nine accepted bodies/dates/statuses are
  preserved; additive current guidance names concrete code/test paths without silently
  selecting new representations or declaring unresolved semantic requirements solved.
- **119 baseline sources:** every source path has one completed final disposition.
  Architectural choices map to the 27 extracted candidate records; detailed implementation
  references, research, guides, sources and dated evidence retain their original knowledge
  responsibilities under explicit decision owners. Final sources were retained with
  owner notices rather than deleted, avoiding loss of procedures, schemas and anchors.
- **151 Markdown documents:** complete static directory/ADR navigation, clear retained
  research/evidence roles and historical labels. Catalogue contract/guide/evaluation remain
  historical; they do not impose active routing metadata or authoring/check commands.
- **40 acceptance scenario IDs/headings:** preserved exactly. Existing semantic baseline,
  partial package-manager supersession of ADR 0006, Telegram amendment in ADR 0008,
  historical supersession and open representation questions remain intact.
- **Original skill:** all 11 tracked files match the original bytes; no custom template,
  helper wrapper, metadata schema, discovery runtime or custom ADR checker was added.
  Numeric filenames are the maintainer's repository convention, not a skill modification.
- **Cutover:** root guidance and indexes own source reading, authority-sensitive navigation,
  ordinary document maintenance and history. Old skill/parser/tests/package commands/CI
  projections are removed; current runbook commands no longer invoke retired tools.

The original projection of 37 records became 38 because the withdrawn adapted-skill
policy is preserved as deprecated ADR 0010 and replacement governance is separately
accepted ADR 0014. This is explicit history, not an extra domain decision. Full source
references were retained deliberately where concise deletion would lose detailed
procedures/evidence; explicit ADR ownership prevents them competing as decision owners.
Original effort ranges remain planning estimates, not claimed measured human effort.

### Final verification

- `node --test "apps/**/*.test.ts" "tests/*.test.ts" "packages/core/src/**/*.test.ts"`:
  **678 passed, zero failed/skipped/cancelled**. Includes colocated core tests beyond
  the root acceptance glob; no live provider account or remote service was required.
- `node scripts/check-dependencies.ts`: passed for existing production roots.
- `node eval/endogenous/run.ts`: passed the deterministic 25-opportunity control,
  22 evaluator calls, three repetition deferrals, zero false positives/missed worthwhile
  cognition in that fixture. This is fixture evidence, not a general model-quality claim.
- Native lifecycle/template and static index coverage checks: all 38 ADRs and 151 docs pass.
- Final source map: 119 unique existing sources, all final disposition rows done.
- Local target/anchor audit: all checked documentation/root-guidance links resolve;
  five stale anchors were repaired without changing historical research conclusions.
- Scoped formatting, strict repository lint and `git diff --check`: passed.
- All 1,412 captured files under protected package/configuration paths, plus the relevant
  lockfile/configuration bytes, match phase-start bytes. Original ADR bodies and all 40
  scenario headings match their pre-reconciliation/original evidence respectively.

### Existing repository-check limitations

`npx tsc -p tsconfig.json` still reports the same two existing TS2322 errors at
`packages/core/src/ai/cognition.ts:220` and `:246`: SDK FinishReason includes
`interrupted`, absent from InferenceFinishReason. Those package files are unchanged.
The root `check` script also references an absent `test:types` script, and the previously
observed pnpm shim stalls in this environment. Direct Node/tool equivalents supplied
the evidence above; a fully green `pnpm check` is not claimed. No unrelated package,
TypeScript configuration, lockfile or toolchain fix was made to clear those limitations.

### Open work outside this migration

M08-F02 remains open, with its explicit agency/contact owner and implementation/test
checklist above: durable contact-decision/no_contact history, replay and interrupted-
evaluation recovery. The maintainer accepted the semantic record with that known gap.
Other historically unresolved questions (including forks/restore identity, general
privacy deletion/derivative repair and broader authority representations) remain
unselected requirements or future work, not implementation completeness claims.
No further documentation migration task or phase approval is pending.

## ADR directory relocation — 2026-10-28

The maintainer selected `docs/architecture/decisions/` as the ADR location. All 38 records and their
index moved together; repository links and root instructions follow the new path.
Record IDs, statuses, decision content and original skill remain unchanged.
The 119-source inventory retains original source names as historical labels while
its links resolve to current destinations. This relocation changes no packages.

## Post-migration legacy cleanup — 2026-10-28

The maintainer approved deleting the three root documentation-discovery Markdown files.
Their obsolete operational schema/commands/evaluation are available through Git history;
reusable governance is now explicit in docs/README.md. ADR 0014 records the dated scope
change. All 119 inventory entries remain traceable: these three now have removed/Git-
history dispositions rather than existing-source links. The current corpus has 148
Markdown documents, including the unchanged 38 ADR identities/statuses. Earlier 151-file
counts and retention claims describe the pre-cleanup audit, not the current tree.

The OpenClaw discovery research note is retained as independent external-system research.
No architectural decision is silently rewritten, no runtime work is claimed complete,
and the open contact-decision/no_contact implementation obligation remains open.

## Post-migration organization — 2026-10-28

The maintainer approved the four-folder organization and responsibility-based consolidation.
This tracker is now a historical completion record. Its source labels/counts and earlier
path-preservation statements describe prior snapshots; rewritten links point to current
records. Six redundant decision sources were consolidated, original source reports and
superseded designs were archived, procedures moved to guides, and dated evaluations to
research. Current navigation is docs/README.md. M08-F02 remains open and is owned directly
by accepted ADR 0033 rather than this completed plan. No package/runtime changes occurred.
