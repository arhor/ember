# Ember agent instructions

## Node.js environment

Before running Node.js, pnpm, or other repository tooling, run `nvm use` from the repository root. If `nvm` is not available as a shell command and `$NVM_DIR/nvm.sh` exists, run `source "$NVM_DIR/nvm.sh" && nvm use` instead.

- Treat `.nvmrc` as the source of truth for the Node.js version.
- Do not guess or select a Node.js version from `package.json`, CI configuration, the system default, or installed versions before trying `nvm use`.
- If both initialization approaches fail, stop immediately and report the failure to the user. Do not investigate, switch Node.js versions, or attempt other workarounds unless the user explicitly asks you to.

## Documentation

Ember keeps durable repository knowledge under `docs/`. Start at
[documentation navigation](docs/README.md) and consult relevant sources before
making implementation decisions. Use the repository `adr-skill` to consult and
maintain architectural decisions in `docs/architecture/decisions/`.

Accepted ADRs govern their stated scope; proposed records are proposals. Preserve
historical and superseded labels and follow replacement links. Keep research,
evidence, guides, and acceptance scenarios in their own documents. Update the
owning source when durable knowledge changes, and maintain directory indexes when
adding or moving documentation. No catalogue routing metadata is required.

## Linting and formatting

- After making code changes, run `npx oxlint --fix`, then run `npx oxfmt`
- Before finishing, run `npx oxlint --deny-warnings --format=agent`
