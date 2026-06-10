# Command Reference

This file is generated from the command registry in `core/src/cli/command-registry.ts`.

## `codemem init`

initialize a project and register it

```bash
codemem init --project <project_name> --owner <owner_name>
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name to register and initialize |
| `--owner` | Optional | `unknown` | - | project owner recorded in the registry |
| `--project-path` | Optional | `current working directory` | - | absolute or relative path of the project being registered |

Outputs:

- `.codemem/_system/meta/standards/<project>.env`
- `.codemem/_system/logs/standards/<project>.jsonl`
- `.codemem/_system/registry/projects-registry.json`

## `codemem capture`

append one development standard

```bash
codemem capture \
  --project <project_name> \
  --type <general|architecture|code|api|data|security|testing|docs|ops|release> \
  --title "short title" \
  --rule "the actual standard sentence" \
  --priority <P0|P1|P2|P3> \
  --status <active|draft|deprecated> \
  --scope <project|global>
```

Arguments:

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

## `codemem build`

generate standard documents

```bash
codemem build --project <project_name> --lang zh
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name to build documents for |
| `--lang` | Optional | `zh` | `zh`, `en` | language used for generated document copy |
| `--include-drafts` | Optional | `false` | `true`, `false` | include draft rules in the generated output |

Outputs:

- `.codemem/docs/global/global-standard.md`
- `.codemem/docs/projects/project-standard.<project_name>.md`
- `.codemem/docs/reports/standards-conflicts.md`

## `codemem package`

build a shareable package directory and .tgz

```bash
codemem package --project <project_name> --version <version> --lang zh
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name whose standards should be packaged |
| `--version` | Optional | `0.1.0` | - | package version written into the manifest and archive name |
| `--lang` | Optional | `zh` | `zh`, `en` | language used for package-side generated documents |
| `--package-id` | Optional | `shared-standard-<project>` | - | custom package id override for the generated artifact |

Outputs:

- `.codemem/_system/packages/standards/<package-id>-<version>/`
- `.codemem/_system/packages/standards/<package-id>-<version>.tgz`
- `.codemem/_system/packages/standards/<package-id>-<version>.tgz.sha256`
- `.codemem/_system/registry/packages-registry.json`

## `codemem install`

install a shared package into another project

```bash
codemem install \
  --package <package_dir_or_tgz> \
  --target <target_project_dir> \
  --project <target_project_name> \
  --owner <owner_name>
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--package` | Required | - | - | path to the shared package directory or .tgz archive |
| `--target` | Required | - | - | target project directory that should receive the package |
| `--project` | Required | - | - | project name to register on the target side |
| `--owner` | Optional | `unknown` | - | owner recorded for the installed target project |
| `--force` | Optional | `false` | `true`, `false` | force reinstall or replace an existing installed standard |
| `--allow-downgrade` | Optional | `false` | `true`, `false` | allow installing an older version over a newer installed version |
| `--json` | Optional | `false` | `true`, `false` | print machine-readable install output |

Install outcomes:

- 首次安装会返回 `installed`。
- 新版本覆盖旧版本时会返回 `upgraded`。
- 默认禁止降级安装；显式传入 `--allow-downgrade` 后会返回 `downgraded`。
- 默认禁止重复安装同一版本；显式传入 `--force` 后会返回 `reinstalled`。
- 默认禁止用不同的已安装包 ID 进行覆盖；显式传入 `--force` 后才允许替换。

## `codemem agent`

install or export agent-specific codemem integrations

```bash
codemem agent install
codemem agent install --agent codex --target-dir <project_dir>
codemem agent detect --agent codex --target-dir <project_dir>
codemem agent export --agent all --target-dir <output_dir>
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--agent` | Optional | - | `codex`, `cursor`, `claude-code`, `all` | target code agent for install or export |
| `--target-dir` | Optional | `current working directory` | - | project directory to receive runtime files, or export output directory |
| `--skill-dir` | Optional | - | - | override the integration install directory for the selected agent; otherwise auto-detect common existing locations first and confirm non-default choices in interactive terminals |
| `--version` | Optional | `0.1.0` | - | exported package version |
| `--package-name` | Optional | `codemem-agent-kit` | - | exported package base name |
| `--lang` | Optional | `zh` | `zh`, `en` | language used in generated prompts and guidance |
| `--json` | Optional | `false` | `true`, `false` | print machine-readable output for install, detect, or export |

Outputs:

- `~/.codex/skills/codemem/runtime/bin/`
- `~/.codex/skills/codemem/templates/`
- `Codex: auto-detect ~/.codex/skills/codemem/SKILL.md`
- `Cursor: ~/.codex/skills/codemem/SKILL.md`
- `Claude Code: auto-detect existing <project>/.claude/commands/ or ~/.claude/commands/ before falling back`
- `.codemem/_system/packages/agents/<package-name>-<version>/`
- `.codemem/_system/packages/agents/<package-name>-<version>.tgz`

## `codemem upgrade`

rebuild codemem and reinstall the latest shared agent resources

```bash
codemem upgrade --agent cursor --target-dir <project_dir>
codemem upgrade --agent codex --target-dir <project_dir> --pull true
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--agent` | Optional | - | `codex`, `cursor`, `claude-code` | target code agent whose shared integration should be refreshed; auto-detected from installed integrations when omitted |
| `--target-dir` | Optional | `current working directory` | - | project directory used as the working project context during reinstall |
| `--skill-dir` | Optional | - | - | override the integration install directory for the selected agent |
| `--lang` | Optional | `zh` | `zh`, `en` | language used in regenerated prompts and guidance |
| `--pull` | Optional | `false` | `true`, `false` | run git pull --ff-only before rebuilding and reinstalling |

Outputs:

- `~/.codex/skills/codemem/SKILL.md`
- `~/.codex/skills/codemem/runtime/bin/`
- `~/.codex/skills/codemem/templates/`

## `codemem projects`

list configured projects

```bash
codemem projects
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--json` | Optional | `false` | `true`, `false` | print the registry as JSON instead of a table |
