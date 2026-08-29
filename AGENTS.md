# Ember agent instructions

## Documentation discovery

Ember keeps durable repository knowledge under `docs/` with explicit discovery metadata. The generated catalogue is a routing projection over source documents, never a source of truth itself.

Before coding, design, review, or documentation work that can change or judge Ember's durable semantics or architecture, run:

```bash
python3 scripts/docs_discovery.py list
```

This includes work involving continuity, identity, memory, currentness, context selection, agency, delegation, authority, permissions, sessions, surfaces, long-running work, persistence, or cross-cutting capability behavior. A purely local implementation detail with already-established behavior may skip discovery when it cannot plausibly affect observable semantics or documented contracts.

Use each entry's `summary` and `read_when` as natural-language routing hints. Relevance remains your judgment. Do not interpret the catalogue as semantic ranking, and do not treat a literal phrase mismatch as proof that a document is irrelevant.

Select the smallest plausible set of current documents and read their source before relying on them. For a long selected document, inspect its structure first when useful:

```bash
python3 scripts/docs_discovery.py list --headings docs/path/to/document.md
```

Use deeper discovery when the task asks why a conclusion exists, challenges evidence, needs provenance, reconstructs research, or compares a reviewed external system:

```bash
python3 scripts/docs_discovery.py list --deep
```

Use the history view when investigating superseded guidance, repository evolution, or documentation governance:

```bash
python3 scripts/docs_discovery.py list --all
```

`role`, `discovery_status`, and any role-specific lifecycle are separate concepts. In particular, `role: decision` does not mean an ADR is accepted, and `discovery_status: current` does not confer governing authority. When authority or lifecycle matters, read the source document and follow Ember's existing documentation and research governance.

If relevant documents conflict, never resolve the conflict by catalogue order, file path, modification time, number of matching hints, or apparent confidence. Identify the governing source and its lifecycle. Foundations, active decisions, acceptance scenarios, current design, canonical research, guides, evidence, and preserved source material have different responsibilities. A conflict among sources that should agree is a repository inconsistency to surface or resolve explicitly.

If no `read_when` hint obviously matches, inspect nearby summaries, then selected headings, ordinary repository search, deep discovery, and finally the history view as appropriate. Omission from the current prompt or model context is not evidence that repository knowledge does not exist.

When adding or materially changing a participating `docs/**/*.md` document, update its discovery metadata as part of the same change and run:

```bash
python3 -m unittest discover -s tests -p 'test_docs_discovery.py' -v
python3 scripts/docs_discovery.py check
```

See `docs/documentation-discovery.md` for the governing contract and `docs/documentation-discovery-guide.md` for authoring and command guidance. Do not duplicate the documentation tree here.
