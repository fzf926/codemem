export interface CommandArgSpec {
  name: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
  values?: string[];
}

export interface CommandSpec {
  id: "init" | "capture" | "build" | "package" | "install" | "projects" | "agent" | "upgrade" | "uninstall";
  binName: string;
  devScript: string;
  summary: string;
  example: string | string[];
  args?: CommandArgSpec[];
  outputs?: string[];
}

export const commandSpecs: CommandSpec[] = [
  {
    id: "init",
    binName: "codemem-init",
    devScript: "dev:init",
    summary: "initialize a project and register it",
    example: "codemem init --project <project_name> --owner <owner_name>",
    args: [
      {
        name: "--project",
        description: "project name to register and initialize",
        required: true,
      },
      {
        name: "--owner",
        description: "project owner recorded in the registry",
        defaultValue: "unknown",
      },
      {
        name: "--project-path",
        description: "absolute or relative path of the project being registered",
        defaultValue: "current working directory",
      },
      {
        name: "--project-doc-path",
        description: "relative path and filename for the generated project standard document",
      },
    ],
    outputs: [
      ".codemem/_system/meta/standards/<project>.env",
      ".codemem/_system/logs/standards/<project>.jsonl",
      ".codemem-project.json",
      "~/.codemem/_system/registry/projects-registry.json",
    ],
  },
  {
    id: "capture",
    binName: "codemem-capture",
    devScript: "dev:capture",
    summary: "append one development standard",
    example: [
      "codemem capture \\",
      "  --project <project_name> \\",
      "  --type <general|architecture|code|api|data|security|testing|docs|ops|release> \\",
      "  --title \"short title\" \\",
      "  --rule \"the actual standard sentence\" \\",
      "  --priority <P0|P1|P2|P3> \\",
      "  --status <active|draft|deprecated> \\",
      "  --scope <project|global>",
    ],
    args: [
      {
        name: "--project",
        description: "project name whose standards log will be updated",
        required: true,
      },
      {
        name: "--type",
        description: "standard category used for document grouping",
        required: true,
        values: ["general", "architecture", "code", "api", "data", "security", "testing", "docs", "ops", "release"],
      },
      {
        name: "--title",
        description: "short title shown in generated documents",
        required: true,
      },
      {
        name: "--rule",
        description: "the actual enforceable standard sentence",
        required: true,
      },
      {
        name: "--priority",
        description: "priority level for sorting and conflict review",
        defaultValue: "P2",
        values: ["P0", "P1", "P2", "P3"],
      },
      {
        name: "--status",
        description: "lifecycle state of the rule",
        defaultValue: "active",
        values: ["active", "draft", "deprecated"],
      },
      {
        name: "--scope",
        description: "whether the rule is project-only or promoted globally",
        defaultValue: "project",
        values: ["project", "global"],
      },
      {
        name: "--source",
        description: "where the rule came from, for traceability",
        defaultValue: "manual",
      },
      {
        name: "--lang",
        description: "generated copy language; only zh is supported",
        defaultValue: "zh",
        values: ["zh"],
      },
    ],
  },
  {
    id: "build",
    binName: "codemem-build",
    devScript: "dev:build",
    summary: "generate standard documents",
    example: "codemem build --project <project_name> --lang zh",
    args: [
      {
        name: "--project",
        description: "project name to build documents for",
        required: true,
      },
      {
        name: "--lang",
        description: "generated document language; only zh is supported",
        defaultValue: "zh",
        values: ["zh"],
      },
      {
        name: "--include-drafts",
        description: "include draft rules in the generated output",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
    outputs: [
      ".codemem/docs/global/global-standard.md",
      ".codemem/docs/projects/project-standard.<project_name>.md or configured --project-doc-path",
      ".codemem/docs/reports/standards-conflicts.md",
    ],
  },
  {
    id: "package",
    binName: "codemem-package",
    devScript: "dev:package",
    summary: "build a shareable package directory and .tgz",
    example: "codemem package --project <project_name> --version <version> --lang zh",
    args: [
      {
        name: "--project",
        description: "project name whose standards should be packaged",
        required: true,
      },
      {
        name: "--version",
        description: "package version written into the manifest and archive name",
        defaultValue: "0.1.0",
      },
      {
        name: "--lang",
        description: "package-side generated document language; only zh is supported",
        defaultValue: "zh",
        values: ["zh"],
      },
      {
        name: "--package-id",
        description: "custom package id override for the generated artifact",
        defaultValue: "shared-standard-<project>",
      },
    ],
    outputs: [
      ".codemem/_system/packages/standards/<package-id>-<version>/",
      ".codemem/_system/packages/standards/<package-id>-<version>.tgz",
      ".codemem/_system/packages/standards/<package-id>-<version>.tgz.sha256",
      ".codemem/_system/registry/packages-registry.json",
    ],
  },
  {
    id: "install",
    binName: "codemem-install",
    devScript: "dev:install",
    summary: "install a shared package into another project",
    example: [
      "codemem install \\",
      "  --package <package_dir_or_tgz> \\",
      "  --target <target_project_dir> \\",
      "  --project <target_project_name> \\",
      "  --owner <owner_name>",
    ],
    args: [
      {
        name: "--package",
        description: "path to the shared package directory or .tgz archive",
        required: true,
      },
      {
        name: "--target",
        description: "target project directory that should receive the package",
        required: true,
      },
      {
        name: "--project",
        description: "project name to register on the target side",
        required: true,
      },
      {
        name: "--owner",
        description: "owner recorded for the installed target project",
        defaultValue: "unknown",
      },
      {
        name: "--force",
        description: "force reinstall or replace an existing installed standard",
        defaultValue: "false",
        values: ["true", "false"],
      },
      {
        name: "--allow-downgrade",
        description: "allow installing an older version over a newer installed version",
        defaultValue: "false",
        values: ["true", "false"],
      },
      {
        name: "--json",
        description: "print machine-readable install output",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
  },
  {
    id: "agent",
    binName: "codemem-agent",
    devScript: "dev:agent",
    summary: "install or export agent-specific codemem integrations",
    example: [
      "codemem agent install",
      "codemem agent install --agent codex --target-dir <project_dir>",
      "codemem agent detect --agent codex --target-dir <project_dir>",
      "codemem agent export --agent all --target-dir <output_dir>",
    ],
    args: [
      {
        name: "--agent",
        description: "target code agent for install or export",
        values: ["codex", "cursor", "claude-code", "all"],
      },
      {
        name: "--target-dir",
        description: "project directory to receive runtime files, or export output directory",
        defaultValue: "current working directory",
      },
      {
        name: "--skill-dir",
        description: "override the integration install directory for the selected agent; otherwise auto-detect common existing locations first and confirm non-default choices in interactive terminals",
      },
      {
        name: "--version",
        description: "exported package version",
        defaultValue: "0.1.0",
      },
      {
        name: "--package-name",
        description: "exported package base name",
        defaultValue: "codemem-agent-kit",
      },
      {
        name: "--lang",
        description: "generated prompt and guidance language; only zh is supported",
        defaultValue: "zh",
        values: ["zh"],
      },
      {
        name: "--json",
        description: "print machine-readable output for install, detect, or export",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
    outputs: [
      "skill scripts: ~/.codex/skills/codemem/scripts/",
      "skill runtime: ~/.codex/skills/codemem/runtime/bin/",
      "skill templates: ~/.codex/skills/codemem/templates/",
      "Codex: auto-detect ~/.codex/skills/codemem/SKILL.md",
      "Cursor: ~/.codex/skills/codemem/SKILL.md",
      "Claude Code: auto-detect existing <project>/.claude/commands/ or ~/.claude/commands/ before falling back",
      ".codemem/_system/packages/agents/<package-name>-<version>/",
      ".codemem/_system/packages/agents/<package-name>-<version>.tgz",
    ],
  },
  {
    id: "upgrade",
    binName: "codemem-upgrade",
    devScript: "dev:upgrade",
    summary: "rebuild this checkout and refresh shared agent resources",
    example: [
      "codemem upgrade --agent cursor --target-dir <project_dir>",
      "codemem upgrade --agent codex --target-dir <project_dir> --pull true",
    ],
    args: [
      {
        name: "--agent",
        description: "target code agent whose shared integration should be refreshed; auto-detected from installed integrations when omitted",
        values: ["codex", "cursor", "claude-code"],
      },
      {
        name: "--target-dir",
        description: "project directory used as the working project context during reinstall",
        defaultValue: "current working directory",
      },
      {
        name: "--skill-dir",
        description: "override the integration install directory for the selected agent",
      },
      {
        name: "--lang",
        description: "regenerated prompt and guidance language; only zh is supported",
        defaultValue: "zh",
        values: ["zh"],
      },
      {
        name: "--pull",
        description: "run git pull --ff-only before rebuilding and reinstalling",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
    outputs: [
      "~/.codex/skills/codemem/SKILL.md",
      "skill scripts: ~/.codex/skills/codemem/scripts/",
      "skill runtime: ~/.codex/skills/codemem/runtime/bin/",
      "skill templates: ~/.codex/skills/codemem/templates/",
    ],
  },
  {
    id: "uninstall",
    binName: "codemem-uninstall",
    devScript: "dev:uninstall",
    summary: "clean codemem agent resources and optional project data",
    example: [
      "codemem uninstall",
      "codemem uninstall --delete-project-data true --target-dir <project_dir>",
    ],
    args: [
      {
        name: "--target-dir",
        description: "project directory whose generated codemem data may be deleted when --delete-project-data true is set",
        defaultValue: "current working directory",
      },
      {
        name: "--delete-project-data",
        description: "also delete generated project standards and codemem project-side references under <target-dir>",
        defaultValue: "false",
        values: ["true", "false"],
      },
      {
        name: "--install-dir",
        description: "legacy codemem source install directory to remove",
        defaultValue: "~/.codemem/source",
      },
      {
        name: "--bin-dir",
        description: "legacy directory containing the global codemem command shim",
        defaultValue: "~/.local/bin",
      },
      {
        name: "--profile",
        description: "shell profile file whose codemem PATH block should be removed",
        defaultValue: "~/.zshrc or ~/.bashrc",
      },
      {
        name: "--dry-run",
        description: "print what would be removed without deleting anything",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
    outputs: [
      "removes ~/.codex/skills/codemem/",
      "removes ~/.claude/commands/codemem.md when present",
      "removes legacy ~/.local/bin/codemem and ~/.codemem/source/ when present",
      "optionally removes <target-dir>/.codemem/, .cursor/rules/codemem-standards.mdc, codemem AGENTS.md block, and .gitignore entry",
    ],
  },
  {
    id: "projects",
    binName: "codemem-projects",
    devScript: "dev:projects",
    summary: "list configured projects",
    example: "codemem projects",
    args: [
      {
        name: "--json",
        description: "print the registry as JSON instead of a table",
        defaultValue: "false",
        values: ["true", "false"],
      },
    ],
  },
];

export function getCommandSpec(id: CommandSpec["id"]): CommandSpec {
  const spec = commandSpecs.find((item) => item.id === id);
  if (!spec) {
    throw new Error(`Unknown command id: ${id}`);
  }
  return spec;
}

export function getCliSource(id: CommandSpec["id"]): string {
  return `core/src/cli/${id}.ts`;
}
