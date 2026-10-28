# Architecture Decision Records (ADR)

An Architecture Decision Record (ADR) captures an important architecture decision along with its context and consequences.

## Conventions

- Directory: `{ADR_DIR}`
- Naming: `NNNN-title-with-dashes.md`, e.g. `0001-adopt-adrs.md`.
- Allocate one above the maximum existing prefix across all statuses; never reuse gaps.
- Keep the README index in numeric order; dates belong in frontmatter.
- Status values: `proposed`, `accepted`, `rejected`, `deprecated`, `superseded`

## Workflow

- Create a new ADR as `proposed`.
- Discuss and iterate.
- When the team commits: mark it `accepted` (or `rejected`).
- If replaced later: create a new ADR and mark the old one `superseded` with a link.

## ADRs
