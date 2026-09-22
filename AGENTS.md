# Ember agent instructions

## Node.js environment

Before running Node.js, npm, npx, or other repository tooling, run `nvm use` from the repository root. If `nvm` is not available as a shell command and `$NVM_DIR/nvm.sh` exists, run `source "$NVM_DIR/nvm.sh" && nvm use` instead.

- Treat `.nvmrc` as the source of truth for the Node.js version.
- Do not guess or select a Node.js version from `package.json`, CI configuration, the system default, or installed versions before trying `nvm use`.
- If both initialization approaches fail, stop immediately and report the failure to the user. Do not investigate, switch Node.js versions, or attempt other workarounds unless the user explicitly asks you to.

## Documentation

Ember keeps durable repository knowledge under `docs/` with explicit discovery metadata.

For coding, design, review, research, or documentation work that may depend on or change Ember's durable semantics, architecture, decisions, acceptance scenarios, research conclusions, repository guidance, or other documented contracts, use the `ember-documentation` skill before making implementation decisions.

The skill defines how to discover, read, create, update, and validate repository documentation. Keep the detailed workflow there rather than duplicating the documentation tree or discovery contract here.

If the skill is unavailable in the current agent environment, follow `docs/documentation-discovery-guide.md` and `docs/documentation-discovery.md` directly.

## Linting and formatting

- After making code changes, run `npx oxlint --fix`, then run `npx oxfmt`
- Before finishing, run `npx oxlint --deny-warnings --format=agent`
