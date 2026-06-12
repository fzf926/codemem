# Skill JS Project Runtime Design

## Goal

Move the project-local `init`, `capture`, and `build` execution path into the installed `codemem` skill so agents can run these operations through a skill-owned JavaScript entrypoint instead of relying on global shell commands or compiled per-command binaries.

The global CLI remains responsible for install, upgrade, uninstall, packaging, package installation, project listing, and other distribution-level operations.

## Problem

Today the installed skill tells agents to run binaries such as:

```bash
CODEMEM_TEMPLATES_DIR="..." ~/.codex/skills/codemem/runtime/bin/codemem-init ...
CODEMEM_TEMPLATES_DIR="..." ~/.codex/skills/codemem/runtime/bin/codemem-capture ...
CODEMEM_TEMPLATES_DIR="..." ~/.codex/skills/codemem/runtime/bin/codemem-build ...
```

This works, but it makes the skill feel like a thin prompt wrapper around external commands. It also increases the chance that an agent misses the intended workflow because it must assemble shell commands from prose.

For project-local operations, the skill should carry the executable workflow with it.

## Scope

In scope:

- Add a skill-owned JavaScript entrypoint for `init`, `capture`, and `build` directly under `skills/codemem/scripts/`.
- Install that entrypoint into `~/.codex/skills/codemem/scripts/`.
- Update generated Codex, Cursor, and Claude Code guidance to call the skill JS entrypoint first.
- Keep behavior compatible with existing `.codemem/` state, logs, templates, and generated docs.
- Keep the global CLI available as a fallback and for non-project operations.

Out of scope:

- Moving `agent install`, `upgrade`, `uninstall`, `package`, `install`, or `projects` into the skill script.
- Removing the global `codemem` command.
- Changing the `.codemem/` state format.

## Recommended Architecture

Use a checked-in JavaScript project runtime as part of the skill itself:

```text
skills/codemem/
  SKILL.md
  scripts/
    codemem.mjs
  templates/
    *.template.md
```

The installed skill should contain:

```text
~/.codex/skills/codemem/
  SKILL.md
  meta.json
  scripts/codemem.mjs
  templates/
```

`scripts/codemem.mjs` exposes:

```bash
node ~/.codex/skills/codemem/scripts/codemem.mjs init ...
node ~/.codex/skills/codemem/scripts/codemem.mjs capture ...
node ~/.codex/skills/codemem/scripts/codemem.mjs build ...
```

The script should support the same arguments as the existing project-local commands:

- `init --root <project_root> --project <name> --owner <owner> --project-path <project_root>`
- `capture --root <project_root> --project <name> --type ... --title ... --rule ...`
- `build --root <project_root> --project <name> --lang zh|en`

`skills/codemem/scripts/codemem.mjs` is the source file that gets installed. It is not only a generated dist artifact. This keeps the skill self-contained and makes the shared skill directory reviewable: the prompt, templates, and executable project workflow live together.

## Runtime Implementation

Implement the project-local runtime directly in:

```text
skills/codemem/scripts/codemem.mjs
```

The script should be plain Node-compatible JavaScript with no Bun-only APIs and no TypeScript loader requirement. It should be able to run after the skill directory is copied to another machine.

The current standards behavior lives in `core/src/standards/service.ts` and is used by the CLI. The skill JS script may intentionally duplicate the small project-local subset needed for `init`, `capture`, and `build`, but tests must keep its behavior aligned with the CLI.

Do not make `codemem.mjs` exist only as:

```text
core/dist/skill-runtime/codemem.mjs
```

That kind of generated-only runtime makes the skill harder to review and share. A build step may validate or copy the script, but the canonical script should remain:

```text
skills/codemem/scripts/codemem.mjs
```

The script should:

- Parse the first positional argument as `init`, `capture`, or `build`.
- Implement the same argument names and validation rules as the existing project-local CLI commands.
- Write the same `.codemem/` metadata, JSONL logs, docs, project marker, and guidance files.
- Set template lookup through `CODEMEM_TEMPLATES_DIR` or a default relative to the installed skill directory.
- Print concise success output and useful error messages.

## Install Flow

`codemem agent install` should install:

```text
~/.codex/skills/codemem/scripts/codemem.mjs
~/.codex/skills/codemem/templates/
~/.codex/skills/codemem/SKILL.md
```

The installer should copy the script from:

```text
skills/codemem/scripts/codemem.mjs
```

The old runtime binary directory may remain temporarily for compatibility:

```text
~/.codex/skills/codemem/runtime/bin/
```

Guidance should prefer the JS entrypoint:

```bash
node "<skill_dir>/scripts/codemem.mjs" init --root <project_root> ...
node "<skill_dir>/scripts/codemem.mjs" capture --root <project_root> ...
node "<skill_dir>/scripts/codemem.mjs" build --root <project_root> ...
```

If Node is unavailable, guidance can fall back to the existing global CLI path. Since Node is already required for many agent environments, this should be acceptable as the primary path.

## Agent Guidance Changes

Generated skill instructions should stop emphasizing per-command binaries for project-local work and instead describe one stable command shape:

```bash
node "<skill_dir>/scripts/codemem.mjs" <init|capture|build> ...
```

The workflow rules stay the same:

- Read existing standards docs when present.
- Initialize missing project state.
- Capture stable conventions one rule at a time.
- Rebuild docs in the same pass when rules or state changed.
- Ask only for high-risk decisions.

## Compatibility

Existing projects remain compatible because:

- `.codemem/` state layout does not change.
- Standards logs remain JSONL.
- Generated docs remain in the same locations.
- Global CLI commands still exist.
- Existing runtime binaries can remain during one transition period.

After the JS runtime proves stable, a later cleanup can remove copied `runtime/bin` from skill installs if no supported agent still needs it.

## Error Handling

The JS runtime should:

- Reject unknown subcommands with a short usage message.
- Surface missing required arguments with clear names.
- Fail if `build` is run before the project log exists, matching current behavior.
- Resolve `<project_root>` predictably from `--root`, then current working directory.
- Print generated file paths after `init` and `build`.

## Testing

Add focused tests for:

- `skills/codemem/scripts/codemem.mjs` is present in source control.
- `codemem.mjs init` creates the same files as CLI `init`.
- `codemem.mjs capture` appends a standards log entry.
- `codemem.mjs build` generates the same docs as CLI `build`.
- `agent install --agent cursor` writes `scripts/codemem.mjs`.
- Generated Cursor/Codex/Claude instructions reference the JS entrypoint.
- Existing CLI tests continue to pass.

## Rollout Plan

1. Add `skills/codemem/scripts/codemem.mjs` as the checked-in skill runtime.
2. Update agent installation to copy that script into the installed skill `scripts/` directory.
3. Add optional build validation that the script is syntactically valid and executable with Node.
4. Update generated skill/agent guidance to call the JS entrypoint.
5. Add tests for direct JS execution and installed skill output.
6. Keep existing runtime binaries for compatibility during the transition.

## Open Decision

Node should be the default runner for `scripts/codemem.mjs`. Bun remains useful for repository builds and the global CLI, but the installed skill runtime should avoid requiring Bun in target projects.
