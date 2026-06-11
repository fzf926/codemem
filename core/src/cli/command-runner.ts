import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentId } from "../agent/service";
import { buildPackage } from "../packaging/service";
import { installPackage } from "../installer/service";
import { uninstallCodemem } from "../uninstall/service";
import { formatProjectsTable, listProjects } from "../registry/service";
import { run } from "../shared/process";
import { buildStandards, captureRule, initProject } from "../standards/service";
import type { CommandSpec } from "./command-registry";
import { loadCommandArgs } from "./runtime";

interface CommandContext {
  args: Map<string, string>;
  rootDir: string;
}

type CommandHandler = (context: CommandContext) => void;

function resolveDirectoryArg(value: string | undefined): string {
  if (!value || value === "current working directory") {
    return process.cwd();
  }
  return resolve(value);
}

function detectUpgradeAgent(targetDir: string): AgentId {
  const homeDir = process.env.HOME || "";
  const sharedSkillDir = join(homeDir, ".codex", "skills", "codemem");
  const sharedRuntimeDir = join(sharedSkillDir, "runtime", "bin");
  const sharedTemplatesDir = join(sharedSkillDir, "templates");
  const hasSharedResources = existsSync(sharedRuntimeDir) && existsSync(sharedTemplatesDir);

  if (hasSharedResources && existsSync(join(sharedSkillDir, "meta.json"))) {
    return "cursor";
  }

  if (hasSharedResources && existsSync(join(sharedSkillDir, "agents", "openai.yaml"))) {
    return "codex";
  }

  const projectClaudeCommand = join(targetDir, ".claude", "commands", "codemem.md");
  const homeClaudeCommand = join(homeDir, ".claude", "commands", "codemem.md");
  if (hasSharedResources && (existsSync(projectClaudeCommand) || existsSync(homeClaudeCommand))) {
    return "claude-code";
  }

  throw new Error("Could not auto-detect an installed agent integration. Pass --agent explicitly.");
}

const commandHandlers: Record<CommandSpec["id"], CommandHandler> = {
  init({ args, rootDir }) {
    const project = args.get("project")!;
    const owner = args.get("owner")!;
    const projectPath = resolveDirectoryArg(args.get("project-path"));

    const result = initProject({ rootDir, project, owner, projectPath });
    console.log(`Initialized project '${project}'`);
    console.log(`Meta: ${result.metaFile}`);
    console.log(`Log:  ${result.logFile}`);
    console.log(`Agents guide: ${result.agentsFile}`);
    console.log(`Cursor rule: ${result.cursorRuleFile}`);
    console.log(`Git ignore: ${result.gitignoreFile}`);
  },
  capture({ args, rootDir }) {
    const project = args.get("project")!;
    const title = args.get("title")!;

    captureRule({
      rootDir,
      project,
      type: args.get("type")!,
      title,
      rule: args.get("rule")!,
      priority: args.get("priority")!,
      status: args.get("status")!,
      scope: args.get("scope")!,
      source: args.get("source")!,
      lang: args.get("lang")!,
    });

    console.log(`Captured standard for '${project}': ${title}`);
  },
  build({ args, rootDir }) {
    const project = args.get("project")!;
    const lang = args.get("lang")!;
    const includeDrafts = args.get("include-drafts") === "true";

    for (const file of buildStandards({ rootDir, project, lang, includeDrafts })) {
      console.log(`Generated: ${file}`);
    }
  },
  package({ args, rootDir }) {
    const project = args.get("project")!;
    const version = args.get("version")!;
    const lang = args.get("lang")!;
    const packageId = args.get("package-id") === "shared-standard-<project>"
      ? `shared-standard-${project}`
      : args.get("package-id")!;

    const result = buildPackage({ rootDir, project, version, lang, packageId });
    console.log(`Package directory: ${result.artifactDir}`);
    console.log(`Package archive: ${result.artifactFile}`);
    console.log(`Archive digest: ${result.artifactFile}.sha256`);
  },
  install({ args, rootDir }) {
    const packagePath = args.get("package")!;
    const target = args.get("target")!;
    const project = args.get("project")!;
    const owner = args.get("owner")!;
    const json = args.get("json") === "true";

    const result = installPackage({
      rootDir,
      packagePath,
      target,
      project,
      owner,
      force: args.get("force") === "true",
      allowDowngrade: args.get("allow-downgrade") === "true",
      json,
    });

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Install action: ${result.action}`);
    console.log(
      `Compatibility: codemem ${result.compatibility.hostCodememVersion} satisfies ${result.compatibility.requiredCodememVersion}; Node requirement ${result.compatibility.requiredNodeVersion}`,
    );
    console.log(`Installed package into ${resolve(target)}`);
  },
  agent() {
    throw new Error("codemem agent uses its own entrypoint. Run `codemem agent` instead.");
  },
  upgrade({ args, rootDir }) {
    const targetDir = resolveDirectoryArg(args.get("target-dir"));
    const agent = (args.get("agent") as AgentId | undefined) || detectUpgradeAgent(targetDir);
    const lang = args.get("lang")!;
    const pull = args.get("pull") === "true";
    const skillDir = args.get("skill-dir") ? resolve(args.get("skill-dir")!) : undefined;

    if (pull) {
      run("git", ["pull", "--ff-only"], { cwd: rootDir });
    }

    run("bash", ["scripts/build.sh"], { cwd: rootDir });

    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "run",
        "core/src/cli/agent.ts",
        "--root",
        rootDir,
        "install",
        "--agent",
        agent,
        "--target-dir",
        targetDir,
        "--lang",
        lang,
        ...(skillDir ? ["--skill-dir", skillDir] : []),
      ],
      cwd: rootDir,
      stdout: "pipe",
      stderr: "inherit",
      env: process.env,
    });

    if (result.exitCode !== 0) {
      throw new Error("codemem upgrade failed while reinstalling agent resources.");
    }

    console.log("Updated codemem global resources");
    console.log(`Agent: ${agent}`);
    if (pull) {
      console.log("Git: pulled latest changes with --ff-only");
    }
    process.stdout.write(result.stdout.toString());
  },
  uninstall({ args }) {
    const result = uninstallCodemem({
      targetDir: resolveDirectoryArg(args.get("target-dir")),
      installDir: args.get("install-dir") && args.get("install-dir") !== "~/.codemem/source" ? resolve(args.get("install-dir")!) : undefined,
      binDir: args.get("bin-dir") && args.get("bin-dir") !== "~/.local/bin" ? resolve(args.get("bin-dir")!) : undefined,
      profileFile: args.get("profile") && args.get("profile") !== "~/.zshrc or ~/.bashrc" ? resolve(args.get("profile")!) : undefined,
      deleteProjectData: args.get("delete-project-data") === "true",
      dryRun: args.get("dry-run") === "true",
    });

    console.log(args.get("dry-run") === "true" ? "codemem uninstall dry run" : "codemem uninstalled");
    for (const path of result.removed) {
      console.log("Removed: " + path);
    }
    for (const path of result.kept) {
      console.log("Kept: " + path);
    }
    for (const path of result.skipped) {
      console.log("Skipped: " + path);
    }
  },
  projects({ args, rootDir }) {
    if (args.get("json") === "true") {
      console.log(JSON.stringify(listProjects(rootDir), null, 2));
      return;
    }

    process.stdout.write(formatProjectsTable(rootDir));
  },
};

export function runCommand(id: CommandSpec["id"], argv = process.argv): void {
  const args = loadCommandArgs(id, argv);
  const rootDir = resolve(args.get("root") || process.cwd());
  commandHandlers[id]({ args, rootDir });
}
