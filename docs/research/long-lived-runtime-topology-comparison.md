---
summary: "Comparative snapshot of long-lived runtime topology in OpenClaw, Hermes, NanoBot, and Letta, with evidence and revisit triggers relevant to Ember ADR 0007."
read_when:
  - "Reviewing ADR 0007 or deciding whether Ember should replace episodic systemd workers with a resident runtime"
  - "Adding continuous interaction surfaces, resident transport/control-plane processes, or durable background execution"
  - "Comparing external agent runtimes for process ownership, session residency, restart recovery, or persistent-agent boundaries"
role: reference
discovery_status: current
---

# Long-Lived Runtime Topology Comparison

This note preserves a focused comparison of how several reviewed agent systems arrange
long-lived processes, sessions, durable state, background work, and restart recovery.
It supports [ADR 0007](../architecture/decisions/0007-use-systemd-supervised-episodic-runtime.md),
but it is not itself a governing decision.

The snapshot was checked on **2026-09-04** against the upstream commits linked below.
These systems evolve quickly, so implementation-specific details should be re-verified
before Ember relies on them for a later topology decision.

## Why this comparison exists

Earlier Ember research intentionally separated semantic continuity from implementation
mechanisms and explicitly did not choose a daemon, queue, IPC layer, actor model, or
process topology. Issue #81 and ADR 0007 later selected the first concrete unattended
runtime arrangement from Ember's demonstrated requirements.

That decision did not need a product-by-product runtime-topology survey. This note fills
that evidence gap without reopening the decision prematurely.

The comparison asks the same five questions of each system:

1. What process or service is expected to remain alive?
2. Where does an ordinary agent turn execute?
3. What survives between turns independently of process memory?
4. What owns background or delegated work after the initiating interaction returns?
5. What does restart recovery reconstruct, and what remains process-local?

The goal is not to rank the projects. Their topologies are strongly shaped by their
product surfaces and deployment goals.

## Comparative snapshot

| System              | Long-lived runtime locus                                                                                | Ordinary turn execution                                                                                                    | Durable state across turns                                                                                                       | Background / delegated work                                                                                                                  | Restart boundary                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenClaw**        | Resident Gateway acting as the local control plane for sessions, tools, events, and channel connections | Embedded agent runs are admitted through in-process queues with per-session serialization and global concurrency limits    | Gateway-owned session and agent state is persisted independently of an individual turn                                           | Native subagents are separate child sessions/runs in the Gateway task tree; external harnesses such as ACP/Codex may own execution elsewhere | Current subagent machinery includes bounded orphan/restart recovery from durable run state rather than treating process restart as proof of work outcome                                 |
| **Hermes**          | Resident messaging Gateway                                                                              | Gateway creates or reuses an `AIAgent` for a session and runs turns through that object                                    | SQLite is canonical for transcript/session data, with additional persisted session-routing metadata                              | Sessions with active background processes are protected from expiry; gateway lifecycle includes resume/recovery markers                      | Cached `AIAgent` instances are an in-memory performance projection and can be rebuilt from durable session state after restart                                                           |
| **NanoBot**         | Resident `nanobot gateway` process when channels/WebUI/cron/heartbeat are enabled                       | `AgentLoop` owns the channel-facing turn and `AgentRunner` owns the provider/tool loop inside the same application runtime | Session JSONL, long-term memory files, cron store, and other workspace state survive the process                                 | Subagents are scheduled as `asyncio.Task` objects inside the running process                                                                 | Durable conversation/memory state survives, but live `asyncio.Task` execution is process-local; no equivalent durable native-subagent replay contract was found in the inspected sources |
| **Letta Agent SDK** | Depends on backend: local SDK-managed App Server, remote App Server, or Letta-hosted state/runtime      | A temporary SDK session connects to a persistent agent/conversation and streams turns through the selected backend         | The agent is explicitly stateful and retains identity and long-term memory across conversations, models, and execution computers | Execution locality can differ from agent-state locality; cloud state can use managed sandboxes or connected computers                        | Closing a client/session does not define the lifetime of the persisted agent; runtime/session ownership is explicitly separate from agent continuity                                     |

## OpenClaw: resident control plane with durable run recovery

Observed against OpenClaw commit
[`8c6653a78dec033933dc8a04b07883f416f8b484`](https://github.com/openclaw/openclaw/tree/8c6653a78dec033933dc8a04b07883f416f8b484).

Principal sources:

- [Why OpenClaw](https://github.com/openclaw/openclaw/blob/8c6653a78dec033933dc8a04b07883f416f8b484/docs/start/why-openclaw.md)
- [Subagents](https://github.com/openclaw/openclaw/blob/8c6653a78dec033933dc8a04b07883f416f8b484/docs/tools/subagents.md)

The Gateway is not only a transport adapter. OpenClaw describes it as the local trusted
control plane and makes it the owner of channel connections and the control-plane API.
The CLI, UI, and other surfaces attach to that resident locus.

Ordinary inbound agent work does not require one operating-system process per session.
OpenClaw serializes runs through an in-process queue, preserves per-session serialization,
and applies a global concurrency lane across sessions. Native subagents appear as
separate child sessions/runs in the Gateway's task model rather than as a requirement
for one resident agent process per semantic agent.

The most relevant later-stage lesson is recovery. Current subagent documentation
includes bounded restart/orphan recovery using persisted run information. The useful
Ember pressure is not "copy OpenClaw's database"; it is:

> once resident execution owns consequential background work, durable admission and
> recovery evidence are more meaningful than blindly restarting a failed process.

This supports ADR 0007's existing refusal to use automatic `Restart=` replay as a
semantic work-recovery mechanism.

## Hermes: resident Gateway plus warm per-session agent objects

Observed against Hermes Agent commit
[`63279301bcbdc185c1b07b98a9312eb0c862f26d`](https://github.com/NousResearch/hermes-agent/tree/63279301bcbdc185c1b07b98a9312eb0c862f26d).

Principal sources:

- [Session lifecycle](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/docs/session-lifecycle.md)
- [Gateway internals](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/website/docs/developer-guide/gateway-internals.md)
- [Agent cache pressure](https://github.com/NousResearch/hermes-agent/blob/63279301bcbdc185c1b07b98a9312eb0c862f26d/gateway/agent_cache_pressure.py)

Hermes also uses a long-lived Gateway, but its session implementation makes the
in-memory layer especially visible. The Gateway maintains an LRU cache of `AIAgent`
instances keyed by session so a long conversation can reuse prompt-prefix/cache state
between turns. The documented idle TTL is one hour.

That warm object is not the durable conversation. Hermes separately persists session
routing metadata and uses SQLite as the canonical session/transcript store. The same
lifecycle documentation covers restart recovery, queued concurrent messages, session
expiry, and markers such as `resume_pending`.

For Ember this is a useful caution as much as a pattern:

> a resident session object may be an efficient execution cache, but it should remain a
> rebuildable projection rather than becoming the authoritative location of continuity.

That distinction becomes important on constrained hardware and whenever more than one
process can observe or mutate durable state.

## NanoBot: compact resident async runtime, process-local live tasks

Observed against NanoBot commit
[`b04aeeac0e6806aea5c7d00a314a208b4e10c713`](https://github.com/HKUDS/nanobot/tree/b04aeeac0e6806aea5c7d00a314a208b4e10c713).

Principal sources:

- [Architecture](https://github.com/HKUDS/nanobot/blob/b04aeeac0e6806aea5c7d00a314a208b4e10c713/docs/architecture.md)
- [Subagent implementation](https://github.com/HKUDS/nanobot/blob/b04aeeac0e6806aea5c7d00a314a208b4e10c713/nanobot/agent/subagent.py)

`nanobot gateway` starts enabled channels, the WebSocket/WebUI surface, cron, system jobs
such as Dream and heartbeat, and a health endpoint. Inside that application,
`AgentLoop` owns channel/session-facing turn orchestration while `AgentRunner` owns the
model/tool loop.

The durable layer is deliberately simple and inspectable: sessions are JSONL files,
long-term memory lives in workspace files, and cron jobs have their own persistent
store.

Native subagents, however, are launched with `asyncio.create_task(...)`. That gives a
clean example of a boundary Ember has already identified semantically:

> persistent session state and persistent work execution are different properties.

The inspected sources make live subagent execution part of the current event loop.
Conversation and memory can survive a Gateway restart even though an in-memory task
cannot. This does not make NanoBot wrong; it shows the cost/benefit point of a compact
runtime that has not turned every background operation into a durable-execution system.

## Letta: persistent agent state separated from active runtime sessions

Observed against Letta Agent SDK commit
[`9ae7b8792cb5ce0a80a681dc08824222967d458e`](https://github.com/letta-ai/letta-agent-sdk/tree/9ae7b8792cb5ce0a80a681dc08824222967d458e).

Principal sources:

- [Letta Agent SDK README](https://github.com/letta-ai/letta-agent-sdk/blob/9ae7b8792cb5ce0a80a681dc08824222967d458e/README.md)
- [SDK exports and session API](https://github.com/letta-ai/letta-agent-sdk/blob/9ae7b8792cb5ce0a80a681dc08824222967d458e/src/index.ts)

The SDK states the boundary unusually plainly: create an agent once, then resume it from
anywhere. Agent identity and long-term memory persist across conversations, models, and
the computers on which execution occurs.

Runtime locality is configurable. In cloud mode agent state is hosted by Letta while
tools may execute in a managed sandbox or on a connected computer. In local mode the
SDK can start a local App Server; in remote mode an existing App Server owns that side
of execution. Client disposal and session disposal have their own lifecycle and do not
define the persisted agent's lifetime.

The strongest transferable lesson for Ember is ontological rather than mechanical:

> continuing agent, durable conversation/state, active session, and current execution
> environment are separate things even when one implementation happens to colocate
> them.

That aligns directly with Ember's existing separation between identity, sessions,
surfaces, and process continuity.

## What the comparison says about ADR 0007

The comparison does **not** provide evidence to replace ADR 0007 today.

OpenClaw, Hermes, and NanoBot all have product reasons to keep a resident Gateway:
they directly own continuous messaging/WebSocket surfaces, runtime coordination, or
scheduled application services. Ember's requirements at the time of issue #81 were
narrower: unattended topic-free wake-up and operational ownership of specialist work,
without a demonstrated need for a permanently open inbound transport or resident
scheduler.

A resident Node process would therefore have bought capabilities Ember had not yet
earned while adding permanent RSS, event-loop lifetime, readiness/liveness semantics,
and pressure for an IPC/control boundary. The systemd-supervised episodic design remains
a defensible smaller topology for the current requirement set.

The external systems do reinforce four constraints for implementation and later review:

1. **Persistent identity must remain outside process memory.** Letta makes this separation
   especially explicit; all four systems preserve meaningful state outside one model
   call.
2. **Warm runtime objects are projections, not continuity.** Hermes demonstrates both the
   performance value and the coherence cost of keeping per-session agent objects warm.
3. **Live tasks are not automatically durable work.** NanoBot's `asyncio.Task` subagents
   make the process-local boundary concrete.
4. **Recovery needs evidence, not process replay.** OpenClaw's newer durable subagent
   recovery strengthens ADR 0007's choice to reconcile uncertain work instead of using
   supervisor restart as semantic retry.

## Revisit trigger: continuous interaction surfaces

The most important likely revisit trigger is Ember's first continuously connected
secondary interaction surface.

When a future Telegram or equivalent transport genuinely needs a process to remain
available for inbound events, the topology comparison should no longer be framed only
as "episodic workers versus one resident Ember daemon." At least two shapes deserve
explicit comparison:

```text
resident Ember service
├── continuous transport
├── runtime coordination
└── cognition / specialist work
```

and:

```text
small resident transport/control plane
└── durable admission / activation
    └── episodic Ember cognition and specialist workers
```

OpenClaw, Hermes, and NanoBot provide evidence for the first family. Letta's separation
of persistent agent state from active runtime/session locality provides useful pressure
for the second.

ADR 0007 already lists continuous surfaces, high opportunity frequency, live specialist
steering, and excessive worker-spawn complexity as revisit triggers. This comparison
adds implementation evidence behind those triggers without deciding the later answer in
advance.

## Non-conclusions

This note does not establish that:

- Ember should eventually copy OpenClaw's Gateway;
- a resident control plane must own cognition;
- session caches are intrinsically harmful;
- process-local tasks are insufficient for every background activity;
- Letta's server/resource model is appropriate for a single personal agent;
- a messaging surface automatically requires a permanent Ember process rather than an
  adapter, socket-activated service, externally hosted ingress, or another topology.

Those are future requirement-driven decisions. The durable conclusion here is narrower:
external agent systems separate persistence and execution in materially different ways,
and Ember should preserve that distinction when its own runtime grows.
