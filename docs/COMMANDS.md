# Command Reference

This file is generated from the command registry in `core/src/cli/command-registry.ts`.

The command names below describe the logical CLI surface. This project no longer installs a shell-global `codemem` command; run commands from this source checkout with `bun run core/src/cli/<command>.ts --root . ...`, or let the installed skill use its bundled script runtime.

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
| `--project-doc-path` | Optional | - | - | relative path and filename for the generated project standard document |

Outputs:

- `~/.codemem/projects/<project_state_key>/_system/meta/standards/<project>.env`
- `~/.codemem/projects/<project_state_key>/_system/logs/standards/<project>.jsonl`
- `~/.codemem/projects/<project_state_key>/project.json`
- `~/.codemem/_system/registry/projects-registry.json`

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
| `--lang` | Optional | `zh` | `zh` | generated copy language; only zh is supported |

## `codemem build`

generate standard documents

```bash
codemem build --project <project_name> --lang zh
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--project` | Required | - | - | project name to build documents for |
| `--lang` | Optional | `zh` | `zh` | generated document language; only zh is supported |
| `--include-drafts` | Optional | `false` | `true`, `false` | include draft rules in the generated output |

Outputs:

- `~/.codemem/projects/<project_state_key>/docs/global/global-standard.md`
- `docs/spec/project-standard.<project_name>.md or configured --project-doc-path`
- `~/.codemem/projects/<project_state_key>/docs/reports/standards-conflicts.md`

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
| `--lang` | Optional | `zh` | `zh` | package-side generated document language; only zh is supported |
| `--package-id` | Optional | `shared-standard-<project>` | - | custom package id override for the generated artifact |

Outputs:

- `~/.codemem/projects/<project_state_key>/_system/packages/standards/<package-id>-<version>/`
- `~/.codemem/projects/<project_state_key>/_system/packages/standards/<package-id>-<version>.tgz`
- `~/.codemem/projects/<project_state_key>/_system/packages/standards/<package-id>-<version>.tgz.sha256`
- `~/.codemem/projects/<project_state_key>/_system/registry/packages-registry.json`

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
| `--lang` | Optional | `zh` | `zh` | generated prompt and guidance language; only zh is supported |
| `--json` | Optional | `false` | `true`, `false` | print machine-readable output for install, detect, or export |

Outputs:

- `skill scripts: ~/.codex/skills/codemem/scripts/`
- `skill runtime: ~/.codex/skills/codemem/runtime/bin/`
- `skill templates: ~/.codex/skills/codemem/templates/`
- `Codex: auto-detect ~/.codex/skills/codemem/SKILL.md`
- `Cursor: ~/.codex/skills/codemem/SKILL.md`
- `Claude Code: auto-detect existing <project>/.claude/commands/ or ~/.claude/commands/ before falling back`
- `~/.codemem/projects/<project_state_key>/_system/packages/agents/<package-name>-<version>/`
- `~/.codemem/projects/<project_state_key>/_system/packages/agents/<package-name>-<version>.tgz`

## `codemem upgrade`

rebuild this checkout and refresh shared agent resources

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
| `--lang` | Optional | `zh` | `zh` | regenerated prompt and guidance language; only zh is supported |
| `--pull` | Optional | `false` | `true`, `false` | run git pull --ff-only before rebuilding and reinstalling |

Outputs:

- `~/.codex/skills/codemem/SKILL.md`
- `skill scripts: ~/.codex/skills/codemem/scripts/`
- `skill runtime: ~/.codex/skills/codemem/runtime/bin/`
- `skill templates: ~/.codex/skills/codemem/templates/`

## `codemem uninstall`

clean codemem agent resources and optional project data

```bash
codemem uninstall
codemem uninstall --delete-project-data true --target-dir <project_dir>
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--target-dir` | Optional | `current working directory` | - | project directory whose generated codemem data may be deleted when --delete-project-data true is set |
| `--delete-project-data` | Optional | `false` | `true`, `false` | also delete generated project standards and codemem project-side references under <target-dir> |
| `--install-dir` | Optional | `~/.codemem/source` | - | legacy codemem source install directory to remove |
| `--bin-dir` | Optional | `~/.local/bin` | - | legacy directory containing the global codemem command shim |
| `--profile` | Optional | `~/.zshrc or ~/.bashrc` | - | shell profile file whose codemem PATH block should be removed |
| `--dry-run` | Optional | `false` | `true`, `false` | print what would be removed without deleting anything |

Outputs:

- `removes ~/.codex/skills/codemem/`
- `removes ~/.claude/commands/codemem.md when present`
- `removes legacy ~/.local/bin/codemem and ~/.codemem/source/ when present`
- `optionally removes ~/.codemem/projects/<project_state_key>/, legacy <target-dir>/.codemem/, .cursor/rules/codemem-standards.mdc, codemem AGENTS.md block, and legacy .gitignore entry`

## `codemem projects`

list configured projects

```bash
codemem projects
```

Arguments:

| Argument | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- |
| `--json` | Optional | `false` | `true`, `false` | print the registry as JSON instead of a table |
