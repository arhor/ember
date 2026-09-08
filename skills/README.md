# Ember skills

Ember publishes reusable Agent Skills from this directory.

To install the repository's documentation workflow into local Codex and Claude Code project environments, run from the repository root:

```bash
npx skills add . --skill ember-documentation --agent codex claude-code
```

The skill remains authored at `skills/ember-documentation/SKILL.md`; the `skills` CLI installs or links it into the selected agent-specific project locations.

Use `--copy` if the local environment does not support symlinks.
