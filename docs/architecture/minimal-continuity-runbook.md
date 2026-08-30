---
summary: "Contributor runbook for operating, inspecting, validating, and manually probing Ember's Node.js minimal continuity slice."
read_when:
  - "Running or reviewing the executable minimal continuity slice from issue #23"
  - "Diagnosing its local JSON store, cooperative lock, provider process, or restart probe"
  - "Performing the optional live-provider smoke test without treating it as acceptance evidence"
role: guide
discovery_status: current
---

# Minimal Continuity Slice Runbook

This runbook operates the experiment specified by the
[Minimal Continuity Vertical Slice](minimal-continuity-slice.md). It does not
expand that design's semantic scope or its supported deployment boundary.

## Prerequisites and validation

The slice supports Node.js 24.x on a local Linux filesystem. It uses only Node.js
built-ins: there is no dependency installation, build, bundle, generated code, or
background service.

From the repository root, run the complete gate:

```sh
node --version
node --test
node --test tests/docs-discovery.test.mjs tests/docs-discovery-repository.test.mjs
node scripts/docs-discovery.mjs check
npm run check
```

`node bin/ember.mjs` is the exact no-install entry point. The shorter `ember`
name is available only after an optional package link or install.

## Initialize and inspect a store

Use an explicit local state path, principal, scope, direct provider command, and
positive finite timeout:

```sh
node bin/ember.mjs init \
  --state /tmp/ember-continuity.json \
  --name Ember \
  --principal user-1

node bin/ember.mjs check --state /tmp/ember-continuity.json
node bin/ember.mjs inspect \
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
node bin/ember.mjs run \
  --state /tmp/ember-continuity.json \
  --principal user-1 \
  --scope project:ember/docs \
  --provider-command "$(command -v node)" \
  --provider-arg test-fixtures/providers/scripted-provider.mjs \
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
run=(node bin/ember.mjs run
  --state "$state_path"
  --principal user-1
  --scope project:ember/docs
  --provider-command "$provider_path"
  --provider-arg test-fixtures/providers/scripted-provider.mjs
  --provider-timeout-seconds 2)

node bin/ember.mjs init \
  --state "$state_path" --name Ember --principal user-1

printf '%s\n' \
  ':remember relationship relationship:user-1 relationship:user-1 Ember and user-1 are continuing collaborators' \
  ':remember fact user:user-1 home-server relationship:user-1 The home server is a Raspberry Pi 5' \
  ':prefer user:user-1 docs-rationale-detail project:ember/docs Prefer concise architectural rationale' \
  ':undertake restart-provenance-check project:ember/docs Check whether restart reconstruction preserves provenance without transcript replay' \
  ':remember episode first-continuity-experiment relationship:user-1 relationship:user-1 The first continuity experiment received a nickname' \
  ':quit' | "${run[@]}"

node bin/ember.mjs inspect \
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
node bin/ember.mjs inspect \
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
node bin/ember.mjs lock-status --state /tmp/ember-continuity.json
```

Only after independently establishing that no writer can be running, copy the
exact same-host owner token from `lock-status` and quarantine an apparently stale
lock:

```sh
node bin/ember.mjs quarantine-stale-lock \
  --state /tmp/ember-continuity.json \
  --owner-token EXACT_TOKEN \
  --confirm-quiescent
```

The command rechecks token and PID liveness and renames the lock. A malformed or
partially initialized lock has no trustworthy token, so it cannot use this
supported command; availability can be restored only by manual quarantine after
independent quiescence verification. PID reuse intentionally preserves an
availability failure rather than risking concurrent writers.

## Optional live-provider smoke test

A live adapter may replace the scripted provider if it implements the versioned
single-request/single-result JSON protocol from the design. Configure it only as
a direct executable plus argument vector; the runtime never invokes a shell.

This smoke test is non-deterministic and non-gating. It can reveal provider
presentation or integration problems, but it cannot replace the canonical state,
projection, lifecycle, and scripted-response assertions in CI. Never place API
keys, provider output, stderr, or transcript text in the canonical store. The
provider is a trusted same-user subprocess, not a sandbox; it retains ambient OS
capabilities, and direct-child timeout handling does not contain descendants.

## Known operational boundary

The experiment supports one cooperating foreground writer and one canonical JSON
document on a local Linux filesystem. A crash can leave a lock requiring explicit
recovery. A failure after rename but before directory synchronization makes
durability indeterminate and requires reload plus validation. Multi-host stores,
network filesystems, automatic lock recovery, daemon operation, hostile-provider
containment, retries, external actions, and background cognition remain outside
the slice.
