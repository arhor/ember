---
summary: "Accepted issue #86 implementation decision adding one systemd-supervised resident Telegram long-poll transport worker while keeping canonical Ember work episodic, lease-bounded, and independent of transport process identity."
read_when:
  - "Implementing or reviewing a continuously open messaging transport under Ember's episodic runtime topology"
  - "Deciding whether a Telegram poller, resident transport worker, restart policy, or surface process may own canonical Ember state or continuity"
role: decision
discovery_status: current
---

# ADR 0008: Add a systemd-Supervised Resident Telegram Transport Worker Without Making It Ember's Runtime Owner

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decision class:** Implementation/runtime topology extension
- **Origin:** [Issue #86](https://github.com/arhor/ember/issues/86)
- **Parent epic:** [Issue #52](https://github.com/arhor/ember/issues/52)
- **Semantic baseline:** ADRs [0001](0001-continuity-belongs-to-ember.md) through [0005](0005-distinguish-operational-continuity.md)
- **Implementation baseline:** [ADR 0006](0006-adopt-typescript-on-nodejs-26.md), [ADR 0007](0007-use-systemd-supervised-episodic-runtime.md), and [Interaction Surface Boundary](../interaction-surface-boundary.md)

## Context

ADR 0007 deliberately rejected a permanently resident Ember daemon before a concrete
continuous transport or high-frequency coordination requirement existed. It also
named a continuously open surface as explicit evidence that could make a resident
service the smaller design later.

Issue #86 supplies that evidence. Telegram's supported pull integration is long
polling through `getUpdates`; running a new short Node process for every polling
interval would turn process churn into a polling mechanism, add avoidable latency,
and work against Telegram's own long-polling model. A webhook would avoid a resident
poller but would add a public HTTPS endpoint, certificate/reverse-proxy/firewall
surface, and webhook lifecycle that Ember does not otherwise need on its current
single-user systemd host.

The requirement is therefore narrower than "make Ember a resident daemon": keep one
transport wait resident while preserving the existing episodic ownership of canonical
state and cognition.

## Decision

Add one **systemd user service running a resident Telegram transport worker**.

The worker owns only:

- Bot API authentication from a local token file;
- `getUpdates` long polling;
- Telegram update parsing and configured private-chat filtering;
- handoff into the surface-independent interaction boundary; and
- `sendMessage` transport I/O.

It does **not** own Ember identity, canonical memory, durable occurrence truth,
authority, context selection, provider semantics, or the canonical writer lease while
idle.

The topology becomes:

```text
systemd --user manager
├── episodic Ember wake/recovery/specialist workers       (ADR 0007)
└── resident ember-telegram transport worker              (ADR 0008)
      └── accepted Telegram update
           └── short Ember runtime episode under StateStore lease
                └── existing cognition + interaction boundary
```

Canonical state and the interaction sidecar survive independently of the transport
worker and systemd unit.

## Writer ownership remains episodic

The Telegram worker must not acquire the `StateStore` writer lease before entering a
network wait.

For each accepted mapped update it:

1. acquires the normal writer lease;
2. reloads current canonical state;
3. starts one ordinary short runtime episode;
4. invokes `runSurfaceInteraction` with the configured principal/scope and Telegram
   transport evidence;
5. stops that runtime episode; and
6. releases the lease before polling again.

An unmapped/non-text update is rejected before any runtime episode or canonical write.

This keeps CLI/background contention inside the already-reviewed lease boundary and
prevents a quiet messaging surface from monopolizing canonical state merely because
its HTTP request is long-lived.

## Transport restart is not semantic retry

The generated Telegram unit uses `Restart=on-failure`, unlike work-bearing episodic
units from ADR 0007 which use `Restart=no`.

This is a deliberate application of ADR 0007's control-only restart exception:
restarting the poller performs no cognition, delivery, or external effect by itself.
Telegram retains unconfirmed updates. If an update is replayed after process loss, the
issue #85 `(surface_id, external_occurrence_id)` correlation resolves it to the
already-established Ember occurrence and cognition rather than invoking the provider
or delivery again.

A restart can therefore re-establish transport availability without claiming that
prior cognition or delivery should be replayed.

This does **not** authorize automatic retry of an uncertain `sendMessage`. Delivery
reconciliation remains #88 work.

## Long polling rather than webhook

For the first deployment, use `getUpdates` long polling.

Reasons:

- no inbound public network endpoint is required;
- no TLS certificate, reverse proxy, webhook secret, or public DNS is required;
- the current Linux/systemd host already supplies process supervision;
- an unconfirmed `update_id` composes directly with the durable replay boundary from
  #85; and
- the poller can be restarted safely without making systemd the source of occurrence
  truth.

The adapter fails closed if `getWebhookInfo` reports an active webhook. Switching the
bot to polling requires an explicit operator `deleteWebhook` action and does not drop
pending updates implicitly.

Webhook support may be reconsidered when Ember has an independently justified public
HTTP ingress or when deployment evidence shows the resident poller's cost is material.

## Direct Bot API integration

No Telegram npm runtime dependency is introduced. Node.js 26's built-in `fetch` and
AbortSignal are sufficient for the small method set required by #86:

- `getMe`;
- `getWebhookInfo`;
- `deleteWebhook`;
- `getUpdates`; and
- `sendMessage`.

This follows ADR 0006's dependency policy: a framework abstraction is not justified
for five concrete HTTP methods and one surface.

The implementation records the Bot API version it was reviewed against in the
Telegram runbook and keeps response data runtime-validated because network JSON
remains untrusted regardless of TypeScript declarations.

## Principal and privacy boundary

The first adapter maps one configured Telegram **private chat id** to one existing
Ember local principal and scope with provenance `configured_surface_mapping`.

This is deliberately not a general identity provider. Telegram username, chat id,
message id, update id, bot id, and thread id do not become canonical principal or
memory records. The adapter verifies the configured private-chat sender before
calling the shared boundary; #87 owns stronger cross-surface privacy/principal
semantics and broader mappings.

## Delivery evidence

The adapter preserves the issue #85 delivery lifecycle:

- successful `sendMessage` response -> `confirmed`, plus returned Telegram
  `message_id` as operational evidence;
- explicit Bot API rejection -> `failed`;
- network/protocol ambiguity after send may have begun -> `uncertain`.

The Telegram service never treats systemd process success, HTTP connectivity, or
message-id allocation as evidence that a human read the response.

## Shutdown

`SIGTERM`/`SIGINT` aborts the current long poll. The same AbortSignal is passed through
an active cognition/provider invocation. The unit uses `KillMode=mixed` and an
explicit stop timeout so the main worker gets an opportunity to close its short
runtime episode before systemd applies final cgroup termination.

Abrupt loss may leave a canonical runtime episode unclean. Existing `startRuntime`
recovery semantics preserve that gap on the next accepted update rather than
inventing a clean stop.

## Rejected alternatives

### Repeated short-poll workers

Rejected because Telegram explicitly supports long polling, while repeated process
activation would add a cadence, latency, process churn, and scheduler surface without
semantic benefit.

### Webhook as the first Telegram integration

Rejected for current deployment fit, not capability. It adds public ingress and TLS
operations not otherwise required by Ember's Raspberry-Pi/systemd target.

### General resident Ember daemon with channel registry

Rejected as broader than #86. One continuous Telegram wait does not yet justify
moving wake scheduling, specialist ownership, canonical writes, or all cognition into
one resident coordinator.

### Telegram framework dependency

Rejected because the required method set is small and Node core already provides the
HTTP runtime capability. A framework may be reconsidered if future Telegram features
make local protocol maintenance materially larger than the dependency cost.

## Consequences

- ADR 0007 remains governing for wake/recovery/specialist work and the principle that
  canonical work is not replayed merely because a process restarts.
- The literal "no resident Ember Node process" property from ADR 0007 is narrowed:
  #86 earns one resident **transport** process, not a resident canonical runtime owner.
- Idle Telegram availability now has attributable Node RSS/network cost; future
  resource measurement should include it.
- CLI and the Telegram surface continue to contend through the same writer lease only
  while real Telegram work is being committed, not during idle polling.
- A second continuous surface or broader shared coordination need may make one
  resident transport/cognition coordinator simpler than multiple workers; that is a
  future evidence question rather than an abstraction introduced here.

## Revisit triggers

Revisit this decision when:

- multiple continuous surfaces would otherwise require multiple resident Node
  workers with duplicated lifecycle/configuration;
- webhook/public HTTP ingress becomes independently justified;
- Telegram polling resource cost matters on the target host;
- lock contention between CLI/background/surface work becomes normal;
- live specialist steering or approvals require a shared continuous control plane;
- #87/#88 require identity, privacy, or delivery reconciliation that cannot remain at
  the current narrow surface boundary; or
- Telegram features expand enough that a maintained Bot API library is demonstrably
  smaller/safer than the local HTTP adapter.
