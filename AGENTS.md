# Ember agent instructions

## Documentation

Ember keeps durable repository knowledge under `docs/` with explicit discovery metadata.

For coding, design, review, or documentation work that may depend on or change Ember's durable semantics, architecture, decisions, research, acceptance scenarios, or other documented contracts, use the `ember-documentation` skill before making implementation decisions. The skill defines how to discover, read, create, update, and validate repository documentation without duplicating the governing documentation contract here.

If the skill is unavailable in the current agent environment, follow `docs/documentation-discovery-guide.md` and `docs/documentation-discovery.md` directly.

## Linting and formatting

- After making code changes, run `npx oxlint --fix`, then run `npx oxfmt`
- Before finishing, run `npx oxlint --deny-warnings --format=agent`
