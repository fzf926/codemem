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
bun run core/src/cli/init.ts --project codemem --owner <owner>
bun run core/src/cli/capture.ts --project codemem --type <type> --title "<title>" --rule "<rule>"
bun run core/src/cli/build.ts --project codemem --lang zh
bun run core/src/cli/package.ts --project codemem --version <version> --lang zh
bun run core/src/cli/upgrade.ts --agent cursor --target-dir <project_dir>
```

Guidelines:

- Use one `codemem-capture` call per rule.
- When a task establishes a reusable engineering convention, capture the new rule and regenerate standards docs in the same turn unless a high-risk decision needs confirmation.
- Prefer `bun run core/src/cli/upgrade.ts` when refreshing the local shared agent integration.

## Repository Structure

- `core/src/`: runtime implementation
- `skills/codemem/`: skill definition and templates
- `.codemem/`: generated docs, state, logs, registries, and package artifacts

## Editing Notes

- Keep business logic in `core/src/`; command entrypoints are thin files under `core/src/cli/`.
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
- Outside initialization, proactively capture and rebuild standards when a task establishes a reusable engineering convention, especially for:
  - architecture or design pattern refactors
  - replacing if/else or switch dispatch with strategies, factories, handlers, registries, or template methods
  - converting MQ or event consumer branching into topic factories, tag strategies, handler registries, or other reusable dispatch mechanisms
  - extracting reusable module boundaries, layered responsibilities, or domain service splits
  - unifying inconsistent implementations into one shared mechanism, base class, adapter, or orchestration flow
  - introducing stable conventions for MQ consumers, events, jobs, schedulers, controllers, or service orchestration
  - standardizing error handling, validation, logging, idempotency, retry, timeout, or fallback behavior
  - redesigning repository, cache, RPC, HTTP client, or persistence access patterns
  - introducing shared naming, packaging, configuration, or dependency injection conventions
  - reorganizing project structure, module boundaries, build layout, or deployment integration
  - defining reusable testing, mocking, fixture, contract, or migration patterns
- Do not require the user to explicitly mention codemem before recording these architecture or refactor-derived standards.
- When one of the signals above appears and the implementation lands on a reusable convention, capture the resulting rule(s) and rebuild the standards docs before the final response.
- Do not treat architecture or refactor-derived standards capture as an optional follow-up step after the code change is done.
- Aim to capture at least one evidenced rule per applicable checklist item and 20-40 well-supported standards on a normal project. If fewer than 20 are captured, explain what evidence was missing.
- Do not end with optional follow-up offers for obvious low-risk work. If the next step is clearly part of the user's request, complete it before the final response.
- Only pause for confirmation when project identity is uncertain, a change would overwrite meaningful user content, or a standards conflict cannot be resolved safely.
<!-- codemem:managed:end -->
