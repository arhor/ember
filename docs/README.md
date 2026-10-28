# Ember Documentation

Read the relevant source documents before making implementation decisions. Consult
accepted records in the [ADR index](architecture/decisions/README.md) using the
repository `adr-skill`. Proposed ADRs do not govern implementation. Read historical
and superseded sources for provenance, following their replacement links.

Maintain these indexes when adding or moving documentation. Keep procedures,
scenarios, research, and evidence in their own documents. Record durable architectural
choices using the repository ADR skill; no custom routing metadata is required.

## Reading authority and resolving conflicts

Read relevant source documents before making implementation decisions. Project vision
and principles constrain purpose; accepted ADRs govern their stated scopes; acceptance
scenarios describe required observable behavior. Implementation references explain
those choices and guides own procedures within their scope. Research, evidence maps
and source reports support or challenge conclusions without independently accepting
architectural choices. Historical, deprecated and superseded material explains provenance,
not current governing policy; follow replacement links.

Resolve disagreements by source responsibility, accepted lifecycle and explicit scope,
not retrieval order, modification time, matching words or confidence of presentation.
If sources that should agree conflict, identify and resolve or surface the inconsistency
rather than silently selecting one.

When no index entry obviously fits a task, inspect nearby document headings, follow
source links and search the repository, including research/evidence or history when
needed. Absence from the current prompt or context does not mean knowledge is absent.
Update the owning document and its index when durable knowledge changes; avoid duplicate
sources of truth. No catalogue metadata or retired discovery command is required.

## Where knowledge lives

- [ADRs](architecture/decisions/README.md): accepted choices, rationale, constraints and lifecycle.
- [Architecture](architecture/README.md): current structure, contracts and acceptance scenarios.
- [Guides](guides/README.md): setup, development, deployment, evaluation procedures and recovery.
- [Research](research/README.md): syntheses, evidence maps, investigations and dated measurements.
  [Archived material](research/archive/README.md) is historical evidence, not current instructions.
- [Vision](vision.md) and [design principles](principles.md): project purpose and foundations.

Update the owning document and these indexes when knowledge changes. Decision rationale
belongs in its ADR; keep only implementation detail absent from that record in current
references. A runnable evaluation procedure belongs in guides; dated results belong in
research. Do not silently refresh historical evidence into current claims.
