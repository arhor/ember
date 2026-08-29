# Minimal Continuity Slice Contributor Guide

> Status: executable experiment for issue
> [#23](https://github.com/arhor/ember/issues/23), not a production runtime or a
> final Ember architecture.

This guide reproduces the implementation of the approved
[minimal continuity design](minimal-continuity-slice.md). The experiment asks
whether a completely stopped process can later reconstruct a bounded cognition
for the recognised same Ember from Ember-owned durable meaning, without replaying
a provider conversation or inventing experience during downtime.

## Requirements and installation

- Python 3.12 or newer;
- a local filesystem with same-directory atomic replacement and advisory `flock`;
- one locally asserted principal, one state document, and one cooperating writer;
- a trusted same-user provider executable that speaks the protocol below.

There are no runtime or test dependencies outside the Python standard library.

```bash
python -m pip install .
ember --help
```

For source-tree development without installation, prefix commands with
`PYTHONPATH=src python -m ember`.

## Canonical state and integrity boundary

`--state PATH` names one schema-v1 UTF-8 JSON continuity document. It contains
lineage and its fixture constitutive boundary, evidence, meanings, explicit
supersession links, runtime episodes, and cognition selection manifests. Provider
reply text and provider session state are not canonical.

The store validates the complete document on every load and candidate commit. A
cooperating writer holds an advisory lock, checks the expected monotonic revision,
writes and synchronizes a same-directory temporary file, atomically replaces the
canonical path, and then synchronizes the directory. Failure after replacement
but before directory synchronization is reported as an indeterminate durability
outcome. Recovery validates whichever complete canonical revision the path exposes.

This is an integrity boundary among cooperating Ember commands, not a security
sandbox. The document is plaintext. A same-user provider may have ambient file,
process, environment, or network access even though Ember deliberately passes no
store path or mutation API. Copied stores, network filesystems, hostile providers,
backups, restore, and fork identity are unsupported.

## Provider protocol

Each cognition starts a fresh process using an executable plus argument vector,
without a shell. Ember writes one UTF-8 JSON object and EOF to stdin:

```json
{
  "contract_version": 1,
  "cognition_id": "cognition-...",
  "projection": {},
  "input": {"text": "..."}
}
```

The provider must write exactly one UTF-8 JSON object to stdout and exit zero:

```json
{
  "contract_version": 1,
  "reply": "A non-empty transient reply",
  "used_meaning_ids": ["meaning-..."]
}
```

`used_meaning_ids` must be a subset of the supplied projection. Unknown result
fields, empty replies, extra or malformed stdout, more than 1 MiB of stdout,
non-zero exit, unavailability, and timeout fail the cognition without changing
durable semantic meaning. Ember retains at most a current 64 KiB stderr diagnostic
for display; it is not persisted. There is no automatic retry.

The deterministic fixture provider is
`tests/fixtures/scripted_provider.py`. It is an acceptance oracle, not a model.
A live provider smoke test is intentionally optional and non-authoritative: its
prose cannot compensate for broken state, and presentation differences do not
change canonical continuity.

## Reproduce the longitudinal restart probe

Set convenient shell variables without reusing system option names:

```bash
EMBER_STATE_PATH="$PWD/ember-state.json"
EMBER_PROVIDER_PATH="$PWD/tests/fixtures/scripted_provider.py"
```

Initialize one lineage and start the first foreground process:

```bash
ember init \
  --state "$EMBER_STATE_PATH" \
  --name Ember \
  --principal user-1

ember run \
  --state "$EMBER_STATE_PATH" \
  --principal user-1 \
  --scope project:ember/docs \
  --provider-command python \
  --provider-arg "$EMBER_PROVIDER_PATH" \
  --provider-timeout-seconds 5
```

Enter the fixture operations one line at a time. Commands with spaces in their
final text do not require quotes; shell-like quoting is supported.

```text
:remember relationship relationship:user-1 relationship:user-1 Ember and user-1 are continuing collaborators
:remember fact user:user-1 home-server relationship:user-1 The home server is a Raspberry Pi 5
:prefer user:user-1 docs-rationale-detail project:ember/docs Prefer concise architectural rationale
:undertake restart-provenance-check project:ember/docs Check whether restart reconstruction preserves provenance without transcript replay
:remember episode first-continuity-experiment relationship:user-1 relationship:user-1 The first continuity experiment received a nickname
:quit
```

`:quit` commits `clean_stop_at`, exits the process, and leaves no worker, provider
thread, scheduler, or daemon. Inspect the state to obtain stable generated IDs:

```bash
ember inspect --state "$EMBER_STATE_PATH" --principal user-1 --json
ember explain --state "$EMBER_STATE_PATH" --principal user-1 MEANING_ID
```

In a later `ember run`, exercise the remaining transitions using the IDs returned
by inspection:

```text
:attach-detail EPISODE_MEANING_ID Cinder
:supersede PREFERENCE_A_ID Prefer detailed architectural rationale
:quit
```

The automated test harness then enables and invokes its deliberately
non-production `:fixture-withhold DETAIL_EVIDENCE_ID` fault command in a separate
foreground run. Normal `ember run` refuses this command; only the test harness
sets the `EMBER_ENABLE_FIXTURE_FAULTS=1` gate.
It removes the complete optional payload and digest, retains a non-revealing
descriptor and independently supported episode meta-memory, and records a
`fixture_fault`. This is retrieval unavailability, not deletion or forgetting;
do not use the command as a data-erasure mechanism.

After time passes, start a completely fresh process and request the bounded
history and gap explicitly:

```text
:ask --explain FACT_ID,PREFERENCE_A_ID,EPISODE_MEANING_ID Continue from durable state and explain the unavailable nickname
:quit
```

The recorded projection must contain current preference B, labelled historical A,
user-testimony provenance for the fact, a last-known-live commitment requiring a
currentness check, a typed unavailable-detail gap, and the known clean-stop
recovery account. It must not contain a prior provider transcript or claim
cognition during the stopped interval.

## Inspection, correction, and validation

Human and JSON inspection are semantic views rather than raw file dumps:

```bash
ember inspect --state "$EMBER_STATE_PATH" --principal user-1
ember inspect --state "$EMBER_STATE_PATH" --principal user-1 --json
ember explain --state "$EMBER_STATE_PATH" --principal user-1 MEANING_ID
ember check --state "$EMBER_STATE_PATH"
```

`inspect` groups current, historical/superseded, live/discharged, gaps, runtime
evidence, and cognition manifests. `explain` follows one meaning to source
evidence, predecessor/successor, related detail, and cognition selections. A
wrong principal is rejected before retained payload is rendered. `check` performs
structural and semantic validation and renders no retained payload.

Only a current `fact` or `preference` can be corrected in this slice:

```bash
ember correct \
  --state "$EMBER_STATE_PATH" \
  --principal user-1 \
  MEANING_ID \
  --text "Corrected current meaning" \
  --reason "The user corrected the earlier statement"
```

Correction creates new user-attributed evidence and a reciprocal supersession
transition. It does not edit the earlier content or provenance into a false past.
Constitutive revision, relationship governance, overlapping scope, deletion, and
rollback are refused because their semantics are not defined by this experiment.

## Tests and recorded evaluation

Run the same commands used in CI:

```bash
PYTHONPATH=src python -m compileall -q src tests
PYTHONPATH=src python -m unittest discover -s tests -v
python -m pip wheel . --no-deps --wheel-dir /tmp/ember-wheel
```

The deterministic suite records the first-slice result as executable assertions:

| Acceptance input | Recorded deterministic evidence |
|---|---|
| [AS-CONT-01](acceptance-scenarios.md#as-cont-01) | Separate OS processes, fresh provider invocations, one lineage, relationship/fact/commitment recovery, bounded reconstruction, clean downtime account, and no persisted provider reply/session. |
| [AS-MEM-01](acceptance-scenarios.md#as-mem-01) | B is current in the exact scope; A remains immutable, attributable, reciprocally linked, and labelled `superseded`. |
| [AS-MEM-04](acceptance-scenarios.md#as-mem-04) | The nickname payload occurs once before withholding and zero times afterward; episode meta-memory and a typed `unavailable_detail` gap survive. |

The suite additionally covers malformed and semantically invalid state, stale
revision, interrupted temporary files, post-replace durability uncertainty,
provider timeout/unavailability/non-zero/malformed/extra/oversized/empty output,
unsupported provider-result mutations, pending versus displayed delivery, wrong
principal, projection selection, provenance, and correction boundaries.

The scripted response check is deliberately weaker than the canonical-state
oracle. It proves that the supplied semantics can be expressed reproducibly; it
does not prove that an arbitrary live model will always express them truthfully.

## ADR completion review

| Decision | How the slice treats it |
|---|---|
| [ADR-0001](decisions/0001-continuity-belongs-to-ember.md) | Directly exercised: lineage and constitutive meaning survive processes and fresh provider episodes outside transcripts. Provider replacement quality and fork/restore remain unproved. |
| [ADR-0002](decisions/0002-preserve-persistent-meaning.md) | Directly exercised: evidence, owner, scope, provenance, currentness, supersession, prospective lifecycle, and typed gaps remain inspectable. General consolidation and deletion remain deferred. |
| [ADR-0003](decisions/0003-use-least-sufficient-permitted-projections.md) | Directly exercised: ordinary and explicit explain projections are bounded and retain semantic labels. General relevance judgment and disclosure policy remain deferred. |
| [ADR-0004](decisions/0004-separate-capability-from-authority.md) | Respected as a constraint: the protocol contains no store mutation, tool, or outward-action authority. Same-user ambient capability is explicitly not confused with authority or claimed to be sandboxed. |
| [ADR-0005](decisions/0005-distinguish-operational-continuity.md) | Directly exercised for runtime/cognition lifecycle, recovery, expression occurrence, delivery status, failures, and truthful gaps. Durable work, effects, retries, and multi-surface delivery remain deferred. |

The representation choices are exactly the provisional choices approved by the
design: Python 3.12 standard library, one JSON document, advisory lock plus
revision and atomic replacement, foreground CLI, two-mode deterministic
projection, one-shot provider subprocess, explicit promotion, UTC timestamps,
random stable IDs, and schema version 1. Package and function boundaries are local
implementation details and make no broader architectural commitment.

## Deliberate limitations

There is no daemon, scheduled or endogenous cognition, multiple surface, multiple
principal, authentication, encrypted store, hostile-provider isolation, external
tool, authority engine, delegation, MCP/ACP, durable work engine, queue, retry,
vector search, automatic memory extraction, plugin system, provider thread,
backup/restore, fork resolution, or production observability. Context policy is a
fixed fixture projector, and state size is intentionally tiny.

Those omissions are part of the result. A later feature should be justified by a
failing acceptance scenario or measured limitation rather than folded into this
baseline pre-emptively.
