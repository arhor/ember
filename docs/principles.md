# Ember Design Principles

These principles are intentionally stronger than implementation preferences. They are meant to constrain future design when feature pressure starts pulling the project in contradictory directions.

## 1. Keep the core small

The fundamental agent loop should remain understandable without reading the entire repository.

Complexity belongs at explicit boundaries: memory, context assembly, capabilities, delegation, persistence, and interfaces. A new integration should not require adding another special case to the core loop.

A small core is not minimalism for its own sake. It makes behavioral changes attributable and lets us measure whether additional scaffolding actually improves the agent.

## 2. Continuity before feature breadth

Identity, memory, durable state, and context reconstruction are more important to Ember than supporting many providers, channels, or tools.

A feature that helps Ember remember what matters is more central than a feature that adds another messaging platform.

## 3. Models are replaceable cognition providers

No specific LLM is Ember's source of truth.

Identity, durable memory, relationships, policies, capability state, and provenance must live outside model weights and outside one provider-specific transcript format.

Changing the selected model should alter cognition quality, not silently create a different persistent agent.

## 4. Identity is state, not merely a prompt

The system prompt is a projection of persistent state into a model call.

Ember should distinguish at least conceptually between:

- stable identity principles;
- an evolving self-model;
- user and relationship models;
- operating policies;
- transient conversational context.

These may eventually use different persistence and update rules.

## 5. Raw history is evidence, not memory

Conversation transcripts and event logs are valuable because they preserve what happened. They should not automatically become always-on context.

Durable memory should be a curated interpretation derived from evidence, with links back to its sources whenever practical.

This keeps three concepts separate:

- **history**: what happened;
- **memory**: what remains useful to know;
- **context**: what is relevant right now.

## 6. Provenance travels with remembered information

A memory without origin is weaker than a memory with evidence.

Where practical, durable state should record where it came from, when it was observed, whether it was user-authored, agent-derived, system-generated, or external/untrusted, and what newer information superseded it.

Trust decisions should be represented structurally rather than hidden in prose prompts.

## 7. Prefer deterministic boundaries around model judgment

Use models where language understanding and interpretation add value. Use deterministic code for lifecycle, limits, eligibility, authorization, provenance, state transitions, and invariants.

A good pattern is:

```text
deterministic eligibility
        ↓
 bounded model judgment
        ↓
deterministic validation
```

This is especially important for memory promotion, background reflection, delegation, and proactive actions.

## 8. Capabilities compose

Ember should gain breadth through composable capabilities rather than by accumulating every implementation inside the core repository.

Prefer existing standards when they fit:

- MCP for tools and external capabilities;
- ACP or native runtime adapters for specialist agents;
- Agent Skills-compatible conventions for reusable procedural knowledge.

A custom Ember protocol should require a concrete reason that an existing boundary cannot express.

## 9. Delegation is capability, not hierarchy

A specialist agent is not necessarily a child personality of Ember.

Codex, Claude Code, or another agent runtime can be treated as a stateful capability that owns a specialized execution loop. Ember owns the decision to delegate, the surrounding personal context, and interpretation of the result.

Runtime ownership must be explicit: whoever owns the loop also owns the parts of state and tool execution that cannot safely be rewritten from outside.

## 10. Agency includes non-action

An autonomous personal agent must be able to decide that no action is appropriate.

For an incoming message or event, valid outcomes include:

- respond;
- act;
- delegate;
- remember;
- ask for clarification or approval;
- defer;
- deliberately remain silent;
- decline.

Initiative should not degenerate into `event -> notification` automation.

## 11. Background cognition must be bounded and auditable

Reflection, memory consolidation, event review, and other background model calls can be useful, but they must have explicit triggers, budgets, inputs, outputs, and failure behavior.

Background work should produce inspectable state changes and should never be required for an interactive reply to succeed.

## 12. Interfaces do not own the agent

CLI is the first interface, not the architecture.

Future messaging or voice interfaces should communicate with the same persistent Ember state. Channel-specific formatting and delivery concerns must remain outside identity and memory semantics.

## 13. State changes should be inspectable and reversible where practical

Automatic memory and identity evolution are powerful enough to deserve observability.

For important persistent changes, prefer designs that make it possible to answer:

- What changed?
- Why did it change?
- Which evidence caused it?
- Can it be corrected or superseded?

For high-value state, versioning or an append-only evidence layer is preferable to silent mutation.

## 14. Graceful degradation beats brittle intelligence

Memory search, reflection, plugins, delegated runtimes, and external capabilities can fail.

A failure in an optional subsystem should usually reduce capability rather than destroy the entire conversational turn.

## 15. Measure marginal complexity

Whenever Ember gains a substantial subsystem, ask what measurable property it improves:

- task success;
- recall quality;
- continuity;
- latency;
- token cost;
- reliability;
- security;
- user interruption quality;
- maintainability.

Lines of code are not a quality metric, but unexplained architectural growth is a warning signal.

The project should preserve the ability to benchmark a small configuration against richer ones so that complexity has to earn its place.