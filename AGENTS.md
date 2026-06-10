# AGENTS.md

This repository uses `codemem` to record and enforce project development standards.

## Read Standards First

Before making code changes, architectural decisions, or workflow recommendations, read these files when they exist:

1. `.codemem/docs/global/global-standard.md`
2. `.codemem/docs/projects/project-standard.codemem.md`
3. `.codemem/docs/reports/standards-conflicts.md`

Behavior rules:

- Treat the project standard as the closest project-specific source of truth.
- Treat the global standard as the default cross-project baseline.
- If the conflict report shows unresolved contradictions, do not silently pick one. Call out the conflict and ask for confirmation when the choice matters.
- If the standards docs are missing, fall back to the repository source and CLI workflows below.

## Codemem Workflows

Use the local CLI when you need to update standards state or regenerate docs:

```bash
./bin/codemem-init --project codemem --owner <owner>
./bin/codemem-capture --project codemem --type <type> --title "<title>" --rule "<rule>"
./bin/codemem-build --project codemem --lang zh
./bin/codemem-package --project codemem --version <version> --lang zh
./bin/codemem-upgrade
```

Guidelines:

- Use one `codemem-capture` call per rule.
- Do not regenerate standards docs silently after changing rules; recommend regeneration first unless the user explicitly asks for it.
- Prefer `./bin/codemem-upgrade` when refreshing the local shared agent integration.

## Repository Structure

- `core/src/`: runtime implementation
- `bin/`: thin command wrappers
- `skills/codemem/`: skill definition and templates
- `.codemem/`: generated docs, state, logs, registries, and package artifacts

## Editing Notes

- Keep business logic in `core/src/`, not in `bin/`.
- Treat `skills/codemem/SKILL.md.tmpl` as the source for generated `skills/codemem/SKILL.md`.
- If you change standards generation or agent behavior, re-run `bash scripts/build.sh` and relevant tests.

<!-- codemem:managed:start -->
## Codemem Standards

Before making code changes, architecture decisions, or workflow recommendations, read these files when they exist:

1. `.codemem/docs/global/global-standard.md`
2. `.codemem/docs/projects/project-standard.codemem.md`
3. `.codemem/docs/reports/standards-conflicts.md`

Behavior rules:

- Treat the project standard as the closest project-specific source of truth.
- Treat the global standard as the default cross-project baseline.
- If the conflict report shows unresolved contradictions, do not silently pick one. Call out the conflict and ask for confirmation when the choice matters.
- If standards docs are missing, initialize or regenerate them through the local codemem CLI before relying on unstated conventions.
- Default to finishing initialization, standards capture, and document regeneration in one pass.
- During initialization scans, cover this required checklist before deciding the scan is complete:
  - overall directory structure
  - architecture design principles
  - class naming conventions
  - method naming conventions
  - variable naming conventions
  - business layer boundaries
  - annotation usage
  - parameter validation
  - exception handling
  - data access
  - MapStruct usage
  - pagination queries
  - cache usage
  - enum and constant definitions
  - logging
  - performance requirements
  - null handling
  - unit testing
  - module extension rules for adding new business modules
- Aim to capture at least one evidenced rule per applicable checklist item and 20-40 well-supported standards on a normal project. If fewer than 20 are captured, explain what evidence was missing.
- Do not end with optional follow-up offers for obvious low-risk work. If the next step is clearly part of the user's request, complete it before the final response.
- Only pause for confirmation when project identity is uncertain, a change would overwrite meaningful user content, or a standards conflict cannot be resolved safely.
<!-- codemem:managed:end -->
