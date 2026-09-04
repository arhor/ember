---
summary: "Reference investigation of Letta's persisted agent state, independently attachable memory blocks, archival knowledge, and separation of capabilities from identity."
read_when:
  - "Comparing Ember with a stateful-agent platform when reasoning about durable agent state or memory lifecycle"
  - "Investigating detachable memory, active-versus-archival context, or capability separation through Letta"
role: reference
discovery_status: current
---

# Letta Architecture Notes

Reviewed against the current Letta documentation available on 2026-08-27.

Sources:

- [Letta documentation](https://docs.letta.com/)
- [Attaching and detaching memory blocks](https://docs.letta.com/tutorials/attaching-detaching-blocks/)
- [Agent API / AgentState](https://docs.letta.com/api/resources/agents)
- [Agent blocks API](https://docs.letta.com/api/typescript/resources/agents/subresources/blocks)

## What problem does it solve?

Letta is explicitly built around stateful agents. Its central idea is that an agent is not only a model invocation plus transcript; it has durable state that can be reconstructed, inspected, and manipulated independently of a single conversation turn.

This makes Letta useful to Ember less as an execution-loop reference and more as a reference for **persistence being part of the agent's identity rather than merely conversation history**.

## Agent state

Letta exposes a persisted `AgentState` containing the information necessary to recreate an agent. Related persisted resources include memory blocks, identities, tools, archives, files/sources, and approval state.

For Ember, the important observation is not the `AgentState` structure itself. It is that Letta treats "the agent that continues to exist" as something distinct from one transcript or one prompt.

## Memory blocks

Letta implements persistent memory as structured blocks that can exist independently and be attached to or detached from an agent. Blocks have their own metadata and lifecycle.

This gives Letta a useful property: access to remembered information does not necessarily imply that the information is permanently embedded inside one monolithic agent record.

Letta also separates archival memory from always-visible memory blocks, reinforcing the idea that a large body of recoverable knowledge does not need to occupy the model's attention all the time.

## What works well?

### The continuing agent is explicit

This aligns strongly with Ember's vision.

What survives should be more than a transcript. A later model invocation should be able to continue from durable identity, memory, relationships, and other relevant state rather than reconstructing the agent accidentally from chat history alone.

### Remembered information can have an independent lifecycle

Letta's implementation suggests a broader semantic possibility for Ember: some information may remain durable while its relevance to the current conversation, project, or specialist task changes over time.

For example, Ember may know something without needing to show it to every model call, and it may temporarily expose selected context to a specialist without exposing everything personal it knows.

### Active context and archival knowledge are different concepts

This reinforces the same lesson found in Hermes, NanoBot, and OpenClaw: information that is always present should be small and deliberate, while much larger history can remain available on demand.

### Capabilities need not define identity

Letta's attach/detach approach to tools reinforces a useful semantic distinction for Ember: what Ember **can currently do** is not the same as **who Ember is**.

## What may scale poorly for Ember?

### Letta solves a broader server problem

Letta is a platform for managing many persisted agents. Ember initially targets one deeply continuous personal agent.

We should not inherit multi-agent resource-management abstractions simply because they are natural for a server product.

### Generic blocks do not answer Ember-specific continuity questions

Blocks are stronger than one giant prompt file, but the abstraction alone does not tell us how to think about:

- remembered experiences versus durable facts;
- self-understanding versus understanding of another person;
- where a belief came from;
- what happens when two memories conflict;
- unfinished matters and intentions;
- what Ember is allowed to revise about its own identity.

These distinctions should be understood semantically before deciding how to represent them.

### Persistence is necessary but not sufficient for continuity

Saving enough information to recreate an agent is only part of the problem. Ember also cares about how identity, relationships, and memory evolve over time, and whether important changes remain understandable and evidence-backed.

## What should Ember borrow conceptually?

- treat the continuing agent as something durable beyond one transcript or model call;
- keep canonical continuity separate from whatever subset is shown to the model right now;
- allow remembered information to remain durable without always occupying active context;
- distinguish always-relevant context from larger recoverable history;
- keep capabilities conceptually separate from identity;
- consider who may access particular remembered information independently from who originally created it.

## What should Ember explore differently?

- optimize first for one persistent personal agent rather than a general multi-agent management service;
- understand identity, relationships, experiences, memories, and unfinished matters in their own terms before selecting generic storage abstractions for them;
- preserve enough evidence to explain where important remembered beliefs came from and how they were corrected;
- keep a recoverable account of what happened beneath later interpretations of it;
- treat attention and initiative as part of continuity, not merely another source of scheduled messages.

## Ember takeaway

Letta is the strongest reference in this set for the idea that:

> The agent that continues over time is something durable, while the prompt is only a temporary view assembled for one act of cognition.

That idea should probably sit near the center of Ember.
