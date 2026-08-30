---
summary: "Durable design constraints for Ember, including semantics-before-representation, continuity, provenance, bounded judgment, composable capabilities, delegation, agency, and inspectability."
read_when:
  - "Making an architecture or implementation choice that could trade away an established Ember design constraint"
  - "Reviewing whether a new abstraction, integration, memory mechanism, or autonomous behavior fits the project's governing principles"
role: foundation
discovery_status: current
---

# Ember Design Principles

These principles are intentionally stronger than implementation preferences. They are meant to constrain future design when feature pressure starts pulling the project in contradictory directions.

## Research rule: semantics before representation

During research, describe Ember primarily in terms of **what happens, what it means, and which responsibility belongs where**.

Prefer natural-language statements such as "the user said something", "Ember delegated a coding task", "new information contradicted an older memory", or "Ember decided not to interrupt the user".

Do not prematurely turn those ideas into proposed class names, event names, schemas, storage records, method signatures, package boundaries, or protocols. Concrete implementation vocabulary is appropriate when documenting how an existing project works, but Ember's own research should remain representation-neutral until the semantics are understood well enough to justify implementation choices.

## 1. Keep the core small

The fundamental agent loop should remain understandable without reading the entire repository.

Complexity belongs at explicit conceptual boundaries: memory, context selection, capabilities, delegation, persistence, and interfaces. A new integration should not require another special case in the basic reasoning-and-action cycle.

A small core is not minimalism for its own sake. It makes behavioral changes attributable and lets us measure whether additional scaffolding actually improves the agent.

## 2. Continuity before feature breadth

Identity, memory, durable state, and context reconstruction are more important to Ember than supporting many providers, channels, or tools.

A feature that helps Ember remember what matters is more central than a feature that adds another messaging platform.

## 3. Models are replaceable cognition providers

No specific LLM is Ember's source of truth.

Identity, durable memory, relationships, policies, capability awareness, and provenance must live outside model weights and outside one provider-specific transcript format.

Changing the selected model should alter cognition quality, not silently create a different persistent agent.

## 4. Identity is durable state, not merely a prompt

The system prompt is a temporary projection of persistent information into a model call.

Ember should distinguish at least conceptually between:

- stable identity principles;
- an evolving understanding of itself;
- user and relationship understanding;
- operating policies;
- transient conversational context.

How these ideas are represented and persisted is intentionally left open during research.

## 5. Raw history is evidence, not memory

Conversation transcripts and records of what happened are valuable because they preserve experience. They should not automatically become always-visible context.

Durable memory should be a curated interpretation derived from evidence, with links back to its sources whenever practical.

This keeps three concepts separate:

- **history**: what happened;
- **memory**: what remains useful to know;
- **context**: what is relevant right now.

## 6. Provenance travels with remembered information

A memory without origin is weaker than a memory with evidence.

Where practical, durable information should retain enough provenance to tell whether it came directly from the user, was inferred by Ember, came from the system itself, or originated in an external and potentially untrusted source, and whether newer information has superseded it.

The future implementation should make trust boundaries explicit rather than relying only on prose instructions to a model.

## 7. Bound model judgment with explicit rules

Use models where language understanding and interpretation add value. Use ordinary deterministic logic where hard rules are more appropriate, such as permissions, lifecycle, limits, eligibility, and invariants.

A useful semantic pattern is:

```text
first decide whether something is allowed and eligible
        ↓
let the model judge meaning where judgment is useful
        ↓
check that the result still respects the hard boundaries
```

This is especially important for memory promotion, background reflection, delegation, and proactive actions.

## 8. Capabilities compose

Ember should gain breadth through composable capabilities rather than by accumulating every implementation inside the core repository.

Prefer existing standards when they fit:

- MCP for tools and external capabilities;
- ACP or native supported interfaces for specialist agents;
- Agent Skills-compatible conventions for reusable procedural knowledge.

A custom Ember protocol should require a concrete reason that an existing boundary cannot express.

## 9. Delegation is capability, not hierarchy

A specialist agent is not necessarily a child personality of Ember.

Codex, Claude Code, or another specialist system can be treated as something Ember can ask to perform work that it is particularly good at. Ember remains responsible for deciding when to delegate, supplying relevant surrounding context, and understanding what the returned result means to the ongoing interaction.

Where a specialist system maintains its own conversation, tools, or execution state, Ember should respect that ownership rather than pretending to control internals it does not actually own.

## 10. Agency includes non-action

An autonomous personal agent must be able to decide that no action is appropriate.

For something that happens or something the user says, valid outcomes include:

- respond;
- act;
- delegate;
- remember;
- ask for clarification or approval;
- defer;
- deliberately remain silent;
- decline.

Initiative should not degenerate into "something happened, therefore send a notification" automation.

## 11. Background cognition must be bounded and auditable

Reflection, memory consolidation, review of new occurrences, and other background model activity can be useful, but they must have understandable triggers, budgets, inputs, outputs, and failure behavior.

Background activity should produce inspectable changes and should never be required for an interactive reply to succeed.

## 12. Interfaces do not own the agent

CLI is the first interface, not the architecture.

Future messaging or voice interfaces should communicate with the same persistent Ember. Channel-specific formatting and delivery concerns must remain outside identity and memory semantics.

## 13. Important changes should be inspectable and correctable

Automatic memory and identity evolution are powerful enough to deserve observability.

For important persistent changes, prefer designs that make it possible to answer:

- What changed?
- Why did it change?
- Which evidence caused it?
- Can it be corrected or superseded?

The concrete mechanism for versioning, history, or rollback should be chosen later from the requirements rather than assumed during research.

## 14. Graceful degradation beats brittle intelligence

Memory search, reflection, extensions, specialist agents, and external capabilities can fail.

A failure in an optional part of the system should usually reduce capability rather than destroy the entire conversational turn.

## 15. Measure marginal complexity

Whenever Ember gains a substantial new piece, ask what measurable property it improves:

- task success;
- recall quality;
- continuity;
- latency;
- token cost;
- reliability;
- security;
- interruption quality;
- maintainability.

Lines of code are not a quality metric, but unexplained architectural growth is a warning signal.

The project should preserve the ability to compare a small configuration with richer ones so that complexity has to earn its place.