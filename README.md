# Ember

Ember is an experimental persistent personal agent runtime focused on continuity, memory, agency, and composable capabilities.

The project now includes its first executable experiment: a deliberately narrow,
standard-library-only continuity slice. It is not the final Ember runtime.

## Run the continuity slice

Python 3.12 or newer is required.

```bash
python -m pip install .
ember init --state ./ember-state.json --name Ember --principal user-1
ember check --state ./ember-state.json
```

See the [continuity slice contributor guide](docs/architecture/minimal-continuity-slice-runbook.md)
for the complete stop/restart probe, semantic commands, inspection and correction,
provider protocol, acceptance results, and deliberate limitations.

## Design work

- [Vision](docs/vision.md)
- [Design principles](docs/principles.md)
- [Initial architecture model](docs/architecture/initial-model.md)
- [Cross-cutting design directions](docs/architecture/design-directions.md)
- [Architecture acceptance scenarios](docs/architecture/acceptance-scenarios.md)
- [Minimal continuity vertical slice](docs/architecture/minimal-continuity-slice.md)
- [Continuity slice contributor guide](docs/architecture/minimal-continuity-slice-runbook.md)
- Architecture research:
  - [NanoBot](docs/research/nanobot.md)
  - [Hermes](docs/research/hermes.md)
  - [OpenClaw](docs/research/openclaw.md)
  - [Letta](docs/research/letta.md)
