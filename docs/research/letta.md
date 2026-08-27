# Letta Architecture Notes

Reviewed against the current Letta documentation available on 2026-08-27.

Sources:

- [Letta documentation](https://docs.letta.com/)
- [Attaching and detaching memory blocks](https://docs.letta.com/tutorials/attaching-detaching-blocks/)
- [Agent API / AgentState](https://docs.letta.com/api/resources/agents)
- [Agent blocks API](https://docs.letta.com/api/typescript/resources/agents/subresources/blocks)

## What problem does it solve?

Letta is explicitly built around stateful agents. Its central idea is that an agent is not only a model invocation plus transcript; it has durable state that can be reconstructed, inspected, and manipulated independently of a single conversation turn.

This makes Letta useful to Ember less as an execution-loop reference and more as a reference for **persistent agent state as a first-class domain model**.

## Agent state

Letta exposes an `AgentState` persisted in its database. The API describes this state as containing the information necessary to recreate a persisted agent.

Relationships around an agent include, among other things:

- memory blocks;
- identities;
- tools;
- archives;
- files/sources;
- approval state.

This is an important contrast with systems where most persistent semantics are inferred from a workspace directory and one transcript.

## Memory blocks

Memory blocks are structured, persistent sections of context that can be attached to or detached from an agent.

A block can exist independently of the agent and can be shared across agents. Blocks have metadata such as label, size limit, read-only state, tags, and other lifecycle properties.

Conceptually:

```text
Block
  │
  ├── exists independently
  ├── persists independently
  └── can be attached/detached
            │
            ▼
          Agent
```

This gives memory a useful property: **access to memory is a relationship**, not necessarily ownership by one agent object.

Letta also exposes archival memory separately from always-visible memory blocks, allowing large retrieved information to remain outside active context until needed.

## What works well?

### 1. Persistent agent state is explicit

This aligns strongly with Ember's vision.

The persisted thing should be more than a transcript. A future model invocation should be able to reconstruct the same logical agent from durable state.

### 2. Memory has independent identity and lifecycle

A memory object does not have to be embedded forever inside one monolithic agent record.

For Ember this suggests useful possibilities:

- attach project-specific context temporarily;
- maintain relationship or identity blocks under stricter write policies;
- share selected knowledge with delegated or auxiliary processes without exposing all personal memory;
- revoke access without deleting the underlying information.

### 3. Active context and archival storage are different concepts

This reinforces the same lesson found in Hermes, NanoBot, and OpenClaw: always-visible state should be small and deliberate.

### 4. Tools and capabilities are relationships too

Letta's attach/detach model for tools is conceptually attractive for Ember's capability layer. An agent can have a dynamic capability set without those capabilities becoming part of its identity.

## What may scale poorly for Ember?

### 1. Server-centric domain complexity

Letta is a platform for managing many persisted agents. Ember initially targets one deeply continuous personal agent.

We do not need to inherit multi-tenant resource-management abstractions merely because they make sense for a server product.

### 2. Generic blocks can still become semantic buckets

Blocks are a stronger primitive than one giant prompt file, but a block model alone does not answer Ember-specific questions about:

- episodic vs semantic memory;
- self-model vs relationship model;
- provenance;
- contradiction and supersession;
- open threads and intentions;
- what an agent is allowed to update about its own identity.

Ember should use typed semantics where those distinctions matter instead of representing every concept as "a block with a label."

### 3. Persistence is not continuity by itself

Saving enough fields to recreate an agent object is necessary, but Ember also cares about *how* identity and relationship state evolve over time and how those changes remain evidence-backed.

## What should Ember borrow?

- treat persistent agent state as a first-class domain object;
- distinguish canonical state from the prompt projection shown to a model;
- let active memory/context be attachable and budgeted rather than globally injected;
- separate active memory from larger archival/evidence stores;
- model capabilities as relationships that can be attached, removed, or constrained;
- consider access control to memory independently from memory ownership.

## What should Ember deliberately do differently?

- optimize first for one persistent personal agent rather than a general multi-agent management server;
- create stronger domain types than generic memory blocks where identity and continuity require them;
- preserve source evidence and supersession relationships explicitly;
- keep an inspectable event/history layer beneath derived state;
- design initiative and attention as part of the agent lifecycle, not merely another scheduled message source.

## Ember takeaway

Letta is the strongest reference in this set for the idea that:

> The persistent agent itself is a domain object, while the prompt is only one runtime representation of that object.

That idea should probably sit near the center of Ember.