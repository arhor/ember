---
summary: "Issue #89 evidence that CLI and Telegram are two restart-separated surfaces onto one continuing Ember, with the same lineage, selected durable meanings, commitment provenance, and truthful delivery state."
read_when:
  - "Validating continuity while switching between CLI and Telegram or another interaction surface"
  - "Changing cross-surface restart, context selection, principal provenance, delivery uncertainty, or surface transcript behavior"
role: evidence
discovery_status: current
---

# Cross-Surface Continuity Validation

> Status: deterministic repository proof for issue #89, plus an opt-in manual Telegram procedure. The deterministic proof uses real process boundaries and fresh provider processes while keeping Telegram transport network-free.

## Claim under test

CLI and Telegram are temporary interaction surfaces around one continuing Ember. Switching surfaces or restarting the process must not create a new lineage, a second surface-owned memory, or a requirement to replay either surface's transcript.

The proof follows ADR 0001, ADR 0003, and ADR 0005:

- continuity belongs to Ember rather than a process, surface, transport, provider thread, or transcript;
- cognition receives the least-sufficient permitted projection from Ember-owned state; and
- semantic occurrence, cognition completion, delivery, and uncertain external effect remain distinct across restart.

This validation deliberately measures those repository-owned semantics rather than conversational familiarity.

## Deterministic oracle

Run:

```bash
node --test tests/cross-surface-continuity.test.ts
```

The test creates a fresh Ember state and then crosses four independently executed cognition episodes:

| Step | Process/surface                   | Durable input                                                                        | Delivery observation              |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| 1    | fresh CLI process                 | establishes relationship, fact, preference, live commitment, then performs cognition | confirmed local output            |
| 2    | separate Telegram fixture process | continues from the same state with a stable Telegram occurrence id                   | confirmed Telegram send           |
| 3    | another Telegram fixture process  | continues again without either prior process/session                                 | outbound send becomes `uncertain` |
| 4    | fresh CLI process                 | continues locally from the same state after the ambiguous Telegram delivery          | confirmed local output            |

Every cognition invokes `tests/fixtures/providers/scripted-provider.ts` as a fresh child process. A shared deterministic counter proves four provider invocations rather than one hidden provider conversation. The only durable continuity-bearing inputs shared between episodes are Ember's state file and its operational interaction ledger.

The Telegram fixture driver is `tests/fixtures/surfaces/telegram-continuity-driver.ts`. It calls the production Telegram surface boundary with deterministic update/send fakes. It does not contain or require a real token, network connection, user chat id, or conversation capture.

## Evidence recorded by the oracle

### One lineage across both surfaces

Every captured provider projection and the final `ember inspect` view must carry the same `lineage_id` established before the first surface switch. Process exit, Telegram entry, another Telegram process, and return to CLI do not establish a successor lineage or surface-local Ember.

### Current durable meanings survive the switch

The first CLI episode establishes:

- one continuing relationship;
- one user-testimony fact;
- one preference in the active scope; and
- one live commitment to preserve cross-surface continuity.

The final canonical meaning snapshot must equal the snapshot taken after the first CLI episode. The test also requires the fact, preference, and commitment to remain in the selected meaning set for every cognition episode.

### Commitment and provenance survive restart

The cross-surface commitment keeps `prospective_lifecycle: live`. Provider projections after each restart still expose its original evidence roles, `user_command` and `ember_adoption`, rather than attributing the commitment to Telegram, the CLI, or a later provider invocation.

The selected fact remains `user_testimony` and retains `user:<principal>` as its source actor. A surface switch therefore cannot launder transport or model evidence into canonical user testimony.

### Transcript/session history is not continuity state

All four provider requests require:

```text
selection.raw_transcript_included = false
```

The captured surfaces are, in order:

```text
local_cli -> telegram_bot -> telegram_bot -> local_cli
```

Each projection receives only its own `current_input`. The final CLI projection must not contain either prior Telegram input, and Telegram projections must not contain the fake chat id or Telegram update identifiers.

Ordinary user input is still retained by the existing canonical evidence model as attributable `user_command` evidence with `payload_mode: retained_optional`. That retained occurrence evidence is not a transport transcript and does not automatically become a current meaning or later cognition context. The oracle therefore requires both Telegram inputs to remain attributable in evidence while proving that neither is promoted to a meaning or selected into the returning CLI projection. The fake chat id and Telegram update ids remain operational interaction metadata, and provider reply text remains outside canonical state.

### Restart is a real operational boundary

The first CLI process exits before Telegram begins. Each Telegram fixture is a new Node process, and the final CLI interaction is another new Node process. Later projections must therefore reconstruct from durable Ember state rather than process memory.

The Telegram and returning CLI projections assert a `known_clean_stop_interval` recovery account with no Ember cognition claimed during the supported downtime interval.

### Delivery uncertainty does not become semantic continuity

The second Telegram fixture deliberately loses the outbound acknowledgement after the send boundary. The interaction ledger records the attempt as `uncertain`; its cognition remains `completed` with canonical `delivery_status: pending`.

The subsequent CLI cognition still receives the same selected durable meanings and lineage, and its own confirmed delivery becomes `displayed`. The pending Telegram delivery is neither rewritten as successful nor promoted into a canonical meaning merely because another surface is available.

### Principal and delivery provenance remain surface-specific

The interaction ledger must record four accepted occurrences and four delivery intents. CLI occurrences retain `explicit_local_argument`; Telegram occurrences retain `configured_surface_mapping` and their stable external update ids. Delivery outcomes are expected to be:

```text
confirmed -> confirmed -> uncertain -> confirmed
```

Those operational differences coexist with one semantic lineage and one canonical meaning snapshot.

## What this proves and what it does not

The deterministic oracle proves Ember's current repository boundary under controlled transport and provider behavior. It is stronger than an in-process helper test because every surface transition discards the previous Node process and provider process.

It does not prove:

- that Telegram's public network is always available;
- that a human read a `confirmed` Telegram message;
- exactly-once external delivery;
- continuity quality for every real model/provider behavior; or
- that future group/shared-device Telegram mappings have the same privacy assumptions as the current configured private-chat surface.

The live transport smoke below checks the concrete Telegram deployment path separately. Real-model continuity remains additionally covered by the longitudinal/process-restart harness from issues #54 and #55.

## Opt-in manual Telegram end-to-end procedure

Use the existing [Telegram Surface Runbook](telegram-surface-runbook.md) to create the bot token file and local Telegram configuration. Keep the token, real chat id, local state path, and captured provider requests outside version control.

For the cleanest surface-only proof, configure Telegram's provider as the repository scripted process provider first. A real Codex or Cursor provider can then be substituted as a second, optional smoke because the continuity claim must not depend on provider-thread reuse.

### 1. Establish Ember state through CLI

Use one local state path, principal, and active scope for the whole procedure. Initialize only when starting from a fresh state:

```bash
node bin/ember.ts init \
  --state "$STATE" \
  --name Ember \
  --principal "$PRINCIPAL"
```

Start CLI cognition using the same active scope that the Telegram configuration will map:

```bash
node bin/ember.ts run \
  --state "$STATE" \
  --principal "$PRINCIPAL" \
  --scope "$SCOPE" \
  --provider-command node \
  --provider-arg tests/fixtures/providers/scripted-provider.ts \
  --provider-timeout-seconds 5
```

On a fresh state, establish a small controlled continuity vector before the first ordinary message. For example:

```text
:remember relationship relationship:<principal> relationship:<principal> Continuing collaborators across surfaces
:remember fact user:<principal> cross-surface-fact <scope> Cross-surface continuity fixture
:prefer user:<principal> cross-surface-detail <scope> Prefer concise continuity evidence
:undertake cross-surface-proof <scope> Preserve continuity while switching surfaces
CLI live checkpoint
:quit
```

Record a local inspection snapshot:

```bash
node bin/ember.ts inspect --state "$STATE" --principal "$PRINCIPAL" --json > /tmp/ember-before-telegram.json
```

Note the lineage id and the controlled meaning ids. Do not copy unrelated private memory into a test report.

### 2. Enter through real Telegram

Point the Telegram configuration at the same `$STATE`, `$PRINCIPAL`, and `$SCOPE`. Verify long polling before serving:

```bash
node bin/ember-telegram.ts check --config "$TELEGRAM_CONFIG"
node bin/ember-telegram.ts serve --config "$TELEGRAM_CONFIG"
```

Send a unique ordinary message such as:

```text
Telegram live cross-surface checkpoint
```

After receiving Ember's reply, stop the foreground worker cleanly with `Ctrl-C`. No CLI transcript or provider session should be copied into Telegram configuration.

### 3. Restart Telegram and exercise the same state again

Start `serve` again from a new process and send another unique checkpoint. This confirms that the live transport can re-enter the same Ember after worker restart rather than relying on the first worker's memory.

Stop the worker cleanly, then inspect the same state again:

```bash
node bin/ember.ts inspect --state "$STATE" --principal "$PRINCIPAL" --json > /tmp/ember-after-telegram.json
```

The lineage and controlled current meanings should match the pre-Telegram snapshot. The interaction section should now contain Telegram occurrences/deliveries with configured principal provenance and transport-local ids, while those ids remain absent from canonical meanings.

### 4. Return to CLI

Start a fresh CLI process on the same state and scope using a fresh provider process or a deliberately fresh real-provider invocation:

```bash
node bin/ember.ts run \
  --state "$STATE" \
  --principal "$PRINCIPAL" \
  --scope "$SCOPE" \
  --provider-command node \
  --provider-arg tests/fixtures/providers/scripted-provider.ts \
  --provider-timeout-seconds 5
```

Send:

```text
CLI live checkpoint after Telegram restart
```

Then quit and inspect once more. The cross-surface proof succeeds when:

- lineage is unchanged across the CLI/Telegram/CLI sequence;
- the controlled current meanings and live commitment remain present with original provenance;
- no step required replaying the earlier CLI or Telegram transcript;
- Telegram ids are operational inspection evidence rather than canonical meaning;
- each successful send has its own delivery evidence; and
- any genuine delivery ambiguity remains pending/uncertain instead of being inferred from later CLI success.

### 5. Optional real-provider pass

After the deterministic-provider live Telegram pass succeeds, repeat the same surface sequence with the locally configured Codex or Cursor provider. Treat that as model-behavior evidence, not as a replacement for the deterministic oracle. A surprising model response should be diagnosed against the captured projection and canonical inspection before being interpreted as continuity loss.

## Definition-of-done mapping

| Issue #89 requirement                                        | Repository proof                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| controlled scenario crosses surfaces on one canonical state  | real CLI process, separate Telegram process, and fresh CLI process share one state file                                       |
| lineage, meanings, commitments, provenance remain consistent | captured projections plus before/final inspection assertions                                                                  |
| transcript/session history is not required                   | fresh processes/provider invocations; `raw_transcript_included=false`; prior Telegram text excluded from final CLI projection |
| least-sufficient context remains surface-appropriate         | identical selected durable meaning set for the controlled scope; transport ids excluded from cognition                        |
| restart preserves continuity                                 | every surface transition crosses a complete Node-process boundary with recovery assertions                                    |
| delivery uncertainty does not create false semantic state    | uncertain Telegram delivery stays pending while later CLI cognition continues unchanged                                       |
| proof is reproducible without hidden chat history            | deterministic test and fixture driver are token/network-free; manual live procedure is fully repository-described             |
