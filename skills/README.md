# Ember skills

Ember publishes reusable Agent Skills from this directory.

To make the repository documentation workflow available to local Codex and Claude Code, install it globally from the Ember repository:

```bash
npx skills add arhor/ember --skill ember-documentation --global --agent codex claude-code
```

The skill remains authored at `skills/ember-documentation/SKILL.md`; the `skills` CLI installs it into the selected agents' global skill locations. Its activation description is Ember-specific, so it should only be selected while working with Ember repository knowledge.

Inspect installed global skills with:

```bash
npx skills list --global
```

Refresh installed global skills with:

```bash
npx skills update --global
```

Remove the Ember documentation skill completely with:

```bash
npx skills remove --global ember-documentation
```

The global installation avoids adding agent-specific installation directories or a project `skills-lock.json` to an Ember checkout. For development of an unmerged skill revision, use a local source deliberately and clean up any project-local installation artifacts afterwards.
