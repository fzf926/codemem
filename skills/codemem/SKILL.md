---
name: dev-standards
description: |
  Record development standards during implementation, generate global and
  project-specific standards, track which projects installed the shared
  standard, and distribute the standard as a shareable install package.
---

## Purpose

Use this skill to turn development conventions into reusable project assets:

- Shared global standard documents
- Project-specific standard documents
- Conflict reports
- Project installation registry
- Shareable install packages

## Commands

- `./bin/codemem-init` - initialize a project and register it
- `./bin/codemem-capture` - append one development standard
- `./bin/codemem-build` - generate standard documents
- `./bin/codemem-package` - build a shareable package directory and .tgz
- `./bin/codemem-install` - install a shared package into another project
- `./bin/codemem-agent` - install or export agent-specific codemem integrations
- `./bin/codemem-projects` - list configured projects

## Workflow

### Step 1: Initialize a project

```bash
./bin/codemem-init --project <project_name> --owner <owner_name>
```

State created:

- `.codemem/_system/meta/standards/<project>.env`
- `.codemem/_system/logs/standards/<project>.jsonl`
- `.codemem/_system/registry/projects-registry.json`

### Step 2: Capture standards during development

```bash
./bin/codemem-capture \
  --project <project_name> \
  --type <general|architecture|code|api|data|security|testing|docs|ops|release> \
  --title "short title" \
  --rule "the actual standard sentence" \
  --priority <P0|P1|P2|P3> \
  --status <active|draft|deprecated> \
  --scope <project|global>
```

Guidelines:

- Keep each captured rule imperative and verifiable.
- Use one capture per rule.
- Promote only stable cross-project rules into `scope=global`.

### Step 3: Build documents

```bash
./bin/codemem-build --project <project_name> --lang zh
```

Outputs:

- `.codemem/docs/global/global-standard.md`
- `.codemem/docs/projects/project-standard.<project_name>.md`
- `.codemem/docs/reports/standards-conflicts.md`

### Step 4: Package the shared standard

```bash
./bin/codemem-package --project <project_name> --version <version> --lang zh
```

Outputs:

- `.codemem/_system/packages/standards/<package-id>-<version>/`
- `.codemem/_system/packages/standards/<package-id>-<version>.tgz`
- `.codemem/_system/packages/standards/<package-id>-<version>.tgz.sha256`
- `.codemem/_system/registry/packages-registry.json`

### Step 5: Install a shared package into another project

```bash
./bin/codemem-install \
  --package <package_dir_or_tgz> \
  --target <target_project_dir> \
  --project <target_project_name> \
  --owner <owner_name>
```

Install policy:

- 首次安装会返回 `installed`。
- 新版本覆盖旧版本时会返回 `upgraded`。
- 默认禁止降级安装；显式传入 `--allow-downgrade` 后会返回 `downgraded`。
- 默认禁止重复安装同一版本；显式传入 `--force` 后会返回 `reinstalled`。
- 默认禁止用不同的已安装包 ID 进行覆盖；显式传入 `--force` 后才允许替换。

### Step 6: Inspect configured projects

```bash
./bin/codemem-projects
```

## Runtime Layout

- `core/src/cli/` - CLI entrypoints
- `core/src/standards/` - standards capture and document rendering
- `core/src/registry/` - project and package registry
- `core/src/packaging/` - shareable package builder
- `core/src/installer/` - package installer
- `core/src/shared/` - shared helpers

## Argument reference

### `codemem-init`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name to register and initialize |
| `--owner` | Optional | `unknown` | - | project owner recorded in the registry |
| `--project-path` | Optional | `current working directory` | - | absolute or relative path of the project being registered |

### `codemem-capture`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name whose standards log will be updated |
| `--type` | Required | - | `general`, `architecture`, `code`, `api`, `data`, `security`, `testing`, `docs`, `ops`, `release` | standard category used for document grouping |
| `--title` | Required | - | - | short title shown in generated documents |
| `--rule` | Required | - | - | the actual enforceable standard sentence |
| `--priority` | Optional | `P2` | `P0`, `P1`, `P2`, `P3` | priority level for sorting and conflict review |
| `--status` | Optional | `active` | `active`, `draft`, `deprecated` | lifecycle state of the rule |
| `--scope` | Optional | `project` | `project`, `global` | whether the rule is project-only or promoted globally |
| `--source` | Optional | `manual` | - | where the rule came from, for traceability |
| `--lang` | Optional | `zh` | `zh`, `en` | language used in generated labels and copy |

### `codemem-build`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name to build documents for |
| `--lang` | Optional | `zh` | `zh`, `en` | language used for generated document copy |
| `--include-drafts` | Optional | `false` | `true`, `false` | include draft rules in the generated output |

### `codemem-package`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name whose standards should be packaged |
| `--version` | Optional | `0.1.0` | - | package version written into the manifest and archive name |
| `--lang` | Optional | `zh` | `zh`, `en` | language used for package-side generated documents |
| `--package-id` | Optional | `shared-standard-<project>` | - | custom package id override for the generated artifact |

### `codemem-install`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--package` | Required | - | - | path to the shared package directory or .tgz archive |
| `--target` | Required | - | - | target project directory that should receive the package |
| `--project` | Required | - | - | project name to register on the target side |
| `--owner` | Optional | `unknown` | - | owner recorded for the installed target project |
| `--force` | Optional | `false` | `true`, `false` | force reinstall or replace an existing installed standard |
| `--allow-downgrade` | Optional | `false` | `true`, `false` | allow installing an older version over a newer installed version |
| `--json` | Optional | `false` | `true`, `false` | print machine-readable install output |

### `codemem-agent`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--agent` | Optional | - | `codex`, `cursor`, `claude-code`, `all` | target code agent for install or export |
| `--target-dir` | Optional | `current working directory` | - | project directory to receive runtime files, or export output directory |
| `--skill-dir` | Optional | - | - | override the integration install directory for the selected agent; otherwise auto-detect common existing locations first and confirm non-default choices in interactive terminals |
| `--version` | Optional | `0.1.0` | - | exported package version |
| `--package-name` | Optional | `codemem-agent-kit` | - | exported package base name |
| `--lang` | Optional | `zh` | `zh`, `en` | language used in generated prompts and guidance |
| `--json` | Optional | `false` | `true`, `false` | print machine-readable output for install, detect, or export |

### `codemem-projects`

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--json` | Optional | `false` | `true`, `false` | print the registry as JSON instead of a table |

## Notes

- Runtime code lives in `core/src/`.
- Source templates live in `skills/codemem/templates/`.
- Installed agent integrations share one global templates directory under `~/.codex/skills/codemem/templates/`.
- State and artifacts live in `.codemem/`.
- Shareable packages declare compatibility metadata such as manifest schema,
  installer schema, tool version, and minimum Node.js runtime.
