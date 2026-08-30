---
summary: "Project purpose and success criteria for Ember as a persistent personal agent whose continuity outlives models, sessions, processes, and interfaces."
read_when:
  - "Evaluating whether a proposed feature belongs in Ember's core purpose"
  - "Changing assumptions about persistent identity, continuity, interfaces, capabilities, or the long-term product direction"
role: foundation
discovery_status: current
---

# Ember Vision

## Purpose

Ember is an experimental persistent personal agent runtime focused on continuity, memory, agency, and composable capabilities.

The project is not intended to be another coding agent, chatbot wrapper, or multi-channel automation framework. Its primary goal is to provide a durable home for a personal agent whose identity and accumulated context survive individual model calls, sessions, processes, interfaces, and eventually model replacements.

A model supplies cognition for a turn. Ember owns continuity.

## What Ember should feel like

The long-term target is closer to a colleague, companion, and autonomous personal agent than to a command dispatcher.

Ember should be able to:

- maintain a coherent identity across sessions;
- remember durable facts, experiences, decisions, preferences, and unfinished threads;
- distinguish remembered evidence from inference and external information;
- act through tools and external systems;
- delegate specialized work to specialist agents such as Codex rather than reimplementing their expertise;
- notice relevant events and decide whether they deserve attention;
- choose among acting, delegating, replying, remembering, deferring, asking, or deliberately doing nothing;
- remain inspectable enough that important state changes can be understood and corrected.

## What Ember is not

Ember should deliberately avoid becoming:

- a replacement for Codex, Claude Code, or other specialist coding agents;
- a framework whose value is measured by the number of built-in integrations;
- a monolithic prompt in which identity, memory, policy, and transient context are indistinguishable;
- a vector database that calls every retrieved text fragment "memory";
- a workflow engine where every event mechanically maps to an action;
- a product whose core agent loop can no longer be understood without reading hundreds of thousands of lines of code.

## Conceptual model

```text
                     Model
                       │
                       ▼
                ┌─────────────┐
                │ Ember Core  │
                └──────┬──────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
      Identity       Memory        Context
         │             │             │
         └─────────────┼─────────────┘
                       ▼
                     Agency
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Tools        Delegates      Events
          │            │
          │            ├── Codex
          │            ├── ACP agents
          │            └── future specialist runtimes
          │
          ├── MCP
          ├── local capabilities
          └── external services
```

Interfaces such as CLI, messaging, or voice should remain outside the identity and memory model:

```text
CLI ─────────────┐
Messaging ───────┼──▶ Ember
Voice ───────────┘
```

The interface is a window into the same persistent agent, not a separate agent instance.

## Central design hypothesis

A useful personal agent does not need a huge core if it can compose strong external capabilities.

Instead of growing Ember until it contains every specialist workflow, prefer boundaries that let Ember say, conceptually:

- "I can answer or reason about this myself."
- "I should use this tool."
- "This is specialist coding work; delegate the task to Codex."
- "This event is not important enough to interrupt the user."
- "This should become durable memory."

This project therefore treats *selection, continuity, and composition* as more important research areas than feature count.

## Research questions

The following questions are intentionally open at project inception:

1. What minimal state must survive process termination for the next Ember instance to be meaningfully continuous with the previous one?
2. Which parts of identity should be immutable principles, mutable self-model, relationship state, or learned preferences?
3. How should episodic history become durable memory without creating an ever-growing prompt or an unreliable pile of summaries?
4. Can provenance and evidence be retained strongly enough that Ember knows why it believes a memory?
5. How should memory contradictions, corrections, supersession, and forgetting work?
6. What should be deterministic code and what should be delegated to model judgment?
7. How should Ember decide whether an event deserves action or user interruption?
8. What is the cleanest boundary between Ember's own tools and delegated agent runtimes?
9. How do we measure whether added architectural complexity actually improves agent usefulness?
10. Which runtime language and persistence model best support these goals without turning implementation choices into identity-level constraints?

## Success criterion

A successful early Ember should not be judged by the number of tools it exposes.

A stronger criterion is this:

> After stopping Ember, changing the interface, and starting it again later, the agent should preserve enough identity, memory, relationships, open context, and capability awareness that the interaction feels like a continuation rather than a new chatbot session.

Everything else can grow around that ember.