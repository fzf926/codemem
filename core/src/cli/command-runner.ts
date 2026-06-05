import { resolve } from "node:path";
import { buildPackage } from "../packaging/service";
import { installPackage } from "../installer/service";
import { formatProjectsTable, listProjects } from "../registry/service";
import { buildStandards, captureRule, initProject } from "../standards/service";
import type { CommandSpec } from "./command-registry";
import { loadCommandArgs } from "./runtime";

interface CommandContext {
  args: Map<string, string>;
  rootDir: string;
}

type CommandHandler = (context: CommandContext) => void;

const commandHandlers: Record<CommandSpec["id"], CommandHandler> = {
  init({ args, rootDir }) {
    const project = args.get("project")!;
    const owner = args.get("owner")!;
    const projectPath = resolve(args.get("project-path") || process.cwd());

    const result = initProject({ rootDir, project, owner, projectPath });
    console.log(`Initialized project '${project}'`);
    console.log(`Meta: ${result.metaFile}`);
    console.log(`Log:  ${result.logFile}`);
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
    throw new Error("codemem-agent uses its own entrypoint. Run ./bin/codemem-agent instead.");
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
