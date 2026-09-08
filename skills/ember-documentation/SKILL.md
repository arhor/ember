---
name: ember-documentation
description: Discover, read, create, update, and validate Ember repository documentation. Use for coding, design, review, research, or documentation work that may depend on or change Ember's durable semantics, architecture, decisions, acceptance scenarios, research conclusions, repository guidance, or other documented contracts. Also use when searching Ember repository knowledge, deciding whether documentation needs to change, or adding a new document under docs/.
---

# Ember Documentation

Use Ember's repository documentation as durable project knowledge. The generated catalogue is only a routing projection over source documents; it is never a source of truth.

## Discover before deciding

Before making implementation or review decisions that may depend on Ember's durable semantics or architecture, run:

```bash
node scripts/docs-discovery.mjs list
```

Use each entry's `summary` and `read_when` as natural-language routing hints. Select the smallest plausible set of current documents and read their source before relying on them. Relevance remains your judgment: a literal phrase mismatch does not prove that a document is irrelevant.

For a long selected document, inspect its structure first when useful:

```bash
node scripts/docs-discovery.mjs list --headings docs/path/to/document.md
```

Escalate discovery only when the task needs it:

```bash
node scripts/docs-discovery.mjs list --deep
node scripts/docs-discovery.mjs list --all
```

Use `--deep` for evidence, provenance, source research, or comparisons with reviewed external systems. Use `--all` for superseded or historical guidance and documentation-governance work.

If no `read_when` hint obviously matches, inspect nearby summaries, selected headings, ordinary repository search, deep discovery, and finally the history view as appropriate. Omission from the current prompt or model context is not evidence that repository knowledge does not exist.

## Read authority from source, not routing metadata

`role`, `discovery_status`, and role-specific lifecycle are separate concepts. In particular, `role: decision` does not mean an ADR is accepted, and `discovery_status: current` does not confer governing authority.

When authority or lifecycle matters, read the source document and follow Ember's documentation and research governance. If relevant documents conflict, do not resolve the conflict by catalogue order, path, modification time, number of matching hints, or apparent confidence. Identify the governing source and its lifecycle. A conflict among sources that should agree is a repository inconsistency to surface or resolve explicitly.

For the governing semantics and metadata rules, read `docs/documentation-discovery.md`. For command and authoring guidance, read `docs/documentation-discovery-guide.md`.

## Maintain documentation as part of the task

After changing code, design, or research, ask whether the task changed durable repository knowledge.

- If existing documented knowledge remains correct, do not churn documentation merely because code changed.
- If existing durable knowledge changed, prefer updating the document that already owns that responsibility.
- Create a new document only when the repository has gained a genuinely new durable knowledge responsibility that does not belong in an existing canonical document.

Before creating a document, run discovery and inspect nearby documents to make sure the responsibility does not already have an owner. Do not create parallel or convenience documents that duplicate an existing source of truth.

When adding or materially changing a participating `docs/**/*.md` document, update its discovery metadata in the same change. Read `docs/documentation-discovery.md` before assigning or changing `summary`, `read_when`, `role`, `discovery_status`, or supersession metadata rather than copying the schema into this skill.

When a new document supersedes old guidance, update the old document's discovery lifecycle according to the governing contract instead of leaving two apparently current sources competing for authority.

## Validate documentation changes

After adding or materially changing participating documentation, run:

```bash
npm run test:docs
node scripts/docs-discovery.mjs check
```

Fix validation failures before finishing. If documentation changed as a consequence of implementation work, also follow the repository's ordinary linting, formatting, and test instructions.

## Completion check

Before finishing a task that used this skill, verify:

1. The implementation or recommendation was informed by the smallest relevant set of current source documents.
2. Any authority-sensitive conclusion came from source governance, not catalogue metadata alone.
3. Durable knowledge changed by the task is reflected in the existing owning document, or in a justified new document.
4. Newly created or materially changed documents satisfy the discovery contract and validation checks.
5. No generated catalogue, heading projection, or ad hoc summary was treated as a new source of truth.
