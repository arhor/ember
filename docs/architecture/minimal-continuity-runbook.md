---
summary: "Contributor runbook for operating, inspecting, validating, and running scripted or live Codex cognition through Ember's Node.js minimal continuity slice."
read_when:
  - "Running or reviewing the executable minimal continuity slice from issue #23"
  - "Diagnosing its local JSON store, cooperative lock, provider process, or restart probe"
  - "Performing the optional live-provider smoke test without treating it as acceptance evidence"
  - "Running the supported production Codex exec cognition backend with an existing local login"
role: guide
discovery_status: current
---

# Minimal Continuity Slice Runbook

This runbook operates the experiment specified by the
[Minimal Continuity Vertical Slice](minimal-continuity-slice.md). It does not
expand that design's semantic scope or its supported deployment boundary.

## Prerequisites and validation

The slice supports Node.js 26, with **26.8.1** as the reviewed minimum, on a local
Linux filesystem. Production execution uses Node.js built-ins and native erasable
TypeScript directly. A fresh checkout installs only the locked development checker
and Node ambient types with `npm ci`; there is no transpilation, bundle, generated
JavaScript tree, or background service.

From the repository root, run the complete gate:

```sh
node --version
npm ci
npm run check
npm test
```

`node bin/ember.ts` is the exact direct-source entry point. Node.js 26 executes
the erasable TypeScript without a loader or build step. The shorter `ember` name
is available after an optional package link or install.

## Initialize and inspect a store

Use an explicit local state path, principal, scope, direct provider command, and
positive finite timeout:

```sh
node bin/ember.ts init \
  --state /tmp/ember-continuity.json \
  --name Ember \
  --principal user-1

node bin/ember.ts check --state /tmp/ember-continuity.json
node bin/ember.ts inspect \
  --state /tmp/ember-continuity.json \
  --principal user-1 \
  --json
```

`init` refuses to overwrite a store. `check` validates the whole canonical
document without rendering retained payloads. `inspect` shows lineage, current
and historical meanings, explicit gaps, and operation evidence. Use `explain`
with a meaning ID to follow its evidence and supersession links, or `correct`
with a current fact/preference ID, replacement text, and an attributable reason.

## Run the deterministic provider and restart probe

The repository fixture lives outside Node's default `test/` discovery tree so
`node --test` never mistakes the interactive provider executable for a test file
and waits on its stdin.

```sh
node bin/ember.ts run \
  --state /tmp/ember-continuity.json \
  --principal user-1 \
  --scope project:ember/docs \
  --provider-command "$(command -v node)" \
  --provider-arg test-fixtures/providers/scripted-provider.ts \
  --provider-timeout-seconds 2
```

The following Bash transcript creates a fresh temporary store, captures the
dynamic meaning/evidence IDs, performs supersession and fixture-only withholding,
stops every foreground process cleanly, and finally reconstructs an explain
projection in a new process:

```bash
probe_dir=$(mktemp -d)
state_path="$probe_dir/ember.json"
provider_path="$(command -v node)"
run=(node bin/ember.ts run
  --state "$state_path"
  --principal user-1
  --scope project:ember/docs
  --provider-command "$provider_path"
  --provider-arg test-fixtures/providers/scripted-provider.ts
  --provider-timeout-seconds 2)

node bin/ember.ts init \
  --state "$state_path" --name Ember --principal user-1

printf '%s\n' \
  ':remember relationship relationship:user-1 relationship:user-1 Ember and user-1 are continuing collaborators' \
  ':remember fact user:user-1 home-server relationship:user-1 The home server is a Raspberry Pi 5' \
  ':prefer user:user-1 docs-rationale-detail project:ember/docs Prefer concise architectural rationale' \
  ':undertake restart-provenance-check project:ember/docs Check whether restart reconstruction preserves provenance without transcript replay' \
  ':remember episode first-continuity-experiment relationship:user-1 relationship:user-1 The first continuity experiment received a nickname' \
  ':quit' | "${run[@]}"

node bin/ember.ts inspect \
  --state "$state_path" --principal user-1 --json > "$probe_dir/before.json"
preference_a=$(node --input-type=module -e '
  import {readFileSync} from "node:fs";
  const view=JSON.parse(readFileSync(process.argv[1],"utf8"));
  console.log(view.current_meanings.find(item=>item.kind==="preference").meaning_id);
' "$probe_dir/before.json")
fact_id=$(node --input-type=module -e '
  import {readFileSync} from "node:fs";
  const view=JSON.parse(readFileSync(process.argv[1],"utf8"));
  console.log(view.current_meanings.find(item=>item.kind==="fact").meaning_id);
' "$probe_dir/before.json")
episode_id=$(node --input-type=module -e '
  import {readFileSync} from "node:fs";
  const view=JSON.parse(readFileSync(process.argv[1],"utf8"));
  console.log(view.current_meanings.find(item=>item.kind==="episode_meta").meaning_id);
' "$probe_dir/before.json")

printf ':attach-detail %s Cinder\n:quit\n' "$episode_id" | "${run[@]}"
detail_id=$(node --input-type=module -e '
  import {readFileSync} from "node:fs";
  const state=JSON.parse(readFileSync(process.argv[1],"utf8"));
  const episode=process.argv[2];
  console.log(state.evidence.find(item=>
    item.related_meaning_id===episode&&item.source_role==="user_command").evidence_id);
' "$state_path" "$episode_id")

printf ':supersede %s Prefer detailed architectural rationale\n:quit\n' \
  "$preference_a" | "${run[@]}"
printf ':fixture-withhold %s\n:quit\n' "$detail_id" | \
  EMBER_ENABLE_FIXTURE_FAULTS=1 "${run[@]}"

# Let real elapsed time pass if desired, then start a wholly new CLI/provider pair.
printf ':ask --explain %s,%s,%s Continue from durable state and explain the unavailable nickname\n:quit\n' \
  "$fact_id" "$preference_a" "$episode_id" | "${run[@]}"
node bin/ember.ts inspect \
  --state "$state_path" --principal user-1 --json
```

Each `:quit` commits a clean stop and releases the cooperative lock. The final
invocation starts a fresh Ember process and a fresh one-shot provider process.
Its response names the same lineage, relationship, sourced fact, current detailed
preference, live commitment, clean downtime boundary, and unavailable nickname
gap without reviving preference A or inventing `Cinder`. The authoritative
automated version is `test/longitudinal-acceptance.test.mjs`; it additionally
asserts canonical state and the exact bounded projection.

## Cooperative lock diagnosis and recovery

The sibling `<state>.lock` file is a cooperative exclusive-create lease, not a
kernel advisory lock. A live, foreign-host, permission-denied, indeterminate, or
malformed lock fails closed. Never delete it merely because it is old.

Inspect without mutation:

```sh
node bin/ember.ts lock-status --state /tmp/ember-continuity.json
```

Only after independently establishing that no writer can be running, copy the
exact same-host owner token from `lock-status` and quarantine an apparently stale
lock:

```sh
node bin/ember.ts quarantine-stale-lock \
  --state /tmp/ember-continuity.json \
  --owner-token EXACT_TOKEN \
  --confirm-quiescent
```

The command rechecks token and PID liveness and renames the lock. A malformed or
partially initialized lock has no trustworthy token, so it cannot use this
supported command; availability can be restored only by manual quarantine after
independent quiescence verification. PID reuse intentionally preserves an
availability failure rather than risking concurrent writers.

## Supported live Codex cognition

Issue [#46](https://github.com/arhor/ember/issues/46) promotes Codex `exec` into
the normal CLI path. Use an installed Codex CLI with its existing ChatGPT login;
Ember does not read, copy, persist, or broker the login credential:

```sh
codex login status

node bin/ember.ts run \
  --state /tmp/ember-continuity.json \
  --principal user-1 \
  --scope project:ember/docs \
  --provider codex \
  --provider-timeout-seconds 120
```

The isolated invocation deliberately ignores `config.toml`, so its supported
default authentication route is Codex's packaged `file` store in
`$CODEX_HOME/auth.json`. If the existing login uses another runtime-owned store,
pass the matching Codex overrides before `exec` and probe that same route first:

```sh
codex login status -c 'cli_auth_credentials_store="keyring"'

node bin/ember.ts run \
  --state /tmp/ember-continuity.json \
  --principal user-1 \
  --scope project:ember/docs \
  --provider codex \
  --codex-arg -c \
  --codex-arg 'cli_auth_credentials_store="keyring"' \
  --provider-timeout-seconds 120
```

`auto` is also supported. When the login was created with Codex's
`secret_auth_storage` feature, pass and probe `--enable secret_auth_storage` as
an additional `--codex-arg`. These options select Codex-owned credential
storage; Ember still never reads or copies credential material. Other custom
auth routing (managed login/workspace restrictions or alternate ChatGPT base
URLs) is not inferred from ignored user configuration and must likewise be
supplied explicitly through `--codex-arg` and validated with the installed
runtime before use.

Ordinary input now flows through Ember's current bounded projection and
`runCognition` reintegration path. `--provider codex` defaults to the `codex`
executable on `PATH`; `--codex-command PATH` can select another installed binary.
The production adapter starts a fresh ephemeral Codex thread for every turn in a
new temporary cwd containing only Ember's generated result schema. It ignores
project rules and user configuration, uses the read-only Codex sandbox, forwards
only a small allowlist of process environment needed to locate the runtime and
its runtime-owned login, and never forwards `OPENAI_API_KEY`. It also disables
Apps/Connectors, plugins, and skill instructions so account-derived connector
context and user-level `$CODEX_HOME/skills` or `$HOME/.agents/skills` metadata
cannot augment the model-visible episode.

Codex JSONL and stdout are bounded to 1 MiB, stderr diagnostics to 64 KiB, and the
final response is checked both by Codex's output schema and Ember's independent
`ProviderResult` validator. An external thread ID, when present, is retained only
on the cognition episode as operational evidence. It is not projected as memory,
used as lineage, or resumed. The adapter never retries automatically.

Press `Ctrl-C` during a model turn to request cancellation of that invocation.
Ember records `cancellation_requested` only after observing the direct child exit;
it does not claim remote cancellation, rollback, or absence of effects. A timeout
is recorded separately as `timed_out`. If direct-child termination cannot be
observed after bounded `SIGTERM`/`SIGKILL` handling, the outcome remains
`outcome_unknown`.

Run the opt-in synthetic production smoke path without placing a subscription in
CI:

```sh
npm run smoke:codex
```

The smoke creates temporary synthetic canonical state containing one deliberately
out-of-scope marker and a temporary user-level skill containing another marker,
invokes the production adapter, checks that neither marker appears in the answer,
checks bounded selection and descriptor-only reintegration, prints a sanitized
summary plus the transient reply, and removes its temporary store. The user-skill
marker check is a regression smoke, not proof of nonvisibility; the explicit
`skills.include_instructions=false` control supplies that boundary. The smoke
requires network access and a working local Codex login using the default
file-store route.

This smoke test is non-deterministic and non-gating. It can reveal provider
presentation or integration problems, but it cannot replace the canonical state,
projection, lifecycle, and scripted-response assertions in CI. Never place API
keys, provider output, stderr, or transcript text in the canonical store. The
Codex runtime remains an external same-user process, not Ember's authority or
continuity owner. Its own sandbox is defense in depth; direct-child termination
handling cannot confirm remote cancellation or contain already-created effects.

For repeatable multi-episode evaluation with controlled state changes, Ember
restarts, and explicit fresh/reused external threads, use the separate
[Longitudinal Continuity Harness](longitudinal-continuity-harness.md). Its
deterministic runner is CI-safe; its live Codex mode is independently opt-in and
reports Ember state/projection assertions separately from empirical model
observations.

## Known operational boundary

The experiment supports one cooperating foreground writer and one canonical JSON
document on a local Linux filesystem. A crash can leave a lock requiring explicit
recovery. A failure after rename but before directory synchronization makes
durability indeterminate and requires reload plus validation. Multi-host stores,
network filesystems, automatic lock recovery, daemon operation, hostile-provider
containment, retries, external actions, and background cognition remain outside
the slice.
