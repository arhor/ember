# Architecture Research

This directory records source-level reconnaissance of existing agent systems before Ember commits to its own implementation architecture.

The goal is not to rank projects or copy one wholesale. Each note asks the same questions:

1. What problem does the project solve?
2. How does its architecture approach that problem?
3. Which boundaries appear to work well?
4. Which parts are consequences of product breadth rather than agent quality?
5. What should Ember borrow?
6. What should Ember deliberately design differently?

Reviewed systems:

- [NanoBot](nanobot.md) — compact execution core and layered memory consolidation.
- [Hermes](hermes.md) — mature agent runtime patterns, prompt tiers, searchable sessions, and isolated delegation.
- [OpenClaw](openclaw.md) — runtime ownership, specialist harnesses, provenance-aware memory, and gated promotion.
- [Letta](letta.md) — persisted agent state and independently attachable memory/capability resources.

The current synthesis lives in [Initial Architecture Model](../architecture/initial-model.md).
