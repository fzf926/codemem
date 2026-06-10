import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { detectAgentInstallations, exportAgentPackage, installAgent, type AgentId } from "../agent/service";
import { parseArgs } from "../shared/args";

function renderHelp(): string {
  return [
    "codemem agent",
    "",
    "install or export agent-specific codemem integrations",
    "",
    "Usage:",
    "",
    "  codemem agent install [--agent codex|cursor|claude-code] [--target-dir <project_dir>] [--skill-dir <dir>] [--lang zh|en]",
    "  codemem agent detect [--agent codex|cursor|claude-code] [--target-dir <project_dir>] [--skill-dir <dir>]",
    "  codemem agent export [--agent codex|cursor|claude-code|all] [--target-dir <output_dir>] [--version <version>] [--lang zh|en]",
    "",
    "Notes:",
    "",
    "  - `install` defaults to interactive agent selection when `--agent` is omitted.",
    "  - `export` defaults to exporting all agent integrations when `--agent` is omitted.",
    "  - when `--skill-dir` is omitted, codemem agent auto-detects common existing install locations before falling back to defaults.",
    "  - in interactive terminals, a detected non-default directory is confirmed before use.",
    "  - `--skill-dir` overrides the detected agent integration install location.",
    "  - `--json` prints machine-readable output.",
  ].join("\n");
}

function getSubcommand(argv: string[]): string | undefined {
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        index += 1;
      }
      continue;
    }
    return token;
  }
  return undefined;
}

function validateAgent(value: string | undefined, allowed: string[]): string | undefined {
  if (!value) {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new Error(`Unsupported agent: ${value}. Allowed values: ${allowed.join(", ")}.`);
  }
  return value;
}

async function confirmDetectedSkillDir(input: {
  agent: AgentId;
  detectedSkillDir: string;
  defaultSkillDir: string;
}): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return true;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question([
      `Detected an existing ${input.agent} integration directory:`,
      `  ${input.detectedSkillDir}`,
      `Default fallback would be:`,
      `  ${input.defaultSkillDir}`,
      "Use the detected directory? [Y/n] ",
    ].join("\n"));

    const normalized = answer.trim().toLowerCase();
    return normalized === "" || normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

async function main(argv = process.argv): Promise<void> {
  const args = parseArgs(argv);
  if (args.get("help") === "true") {
    console.log(renderHelp());
    return;
  }

  const subcommand = getSubcommand(argv);
  const rootDir = resolve(args.get("root") || process.cwd());
  const lang = args.get("lang") || "zh";
  const json = args.get("json") === "true";

  if (!subcommand || !["install", "detect", "export"].includes(subcommand)) {
    throw new Error(`Unknown or missing subcommand.\n\n${renderHelp()}`);
  }

  if (subcommand === "install") {
    const result = await installAgent({
      rootDir,
      agent: validateAgent(args.get("agent"), ["codex", "cursor", "claude-code"]) as AgentId | undefined,
      targetDir: resolve(args.get("target-dir") || process.cwd()),
      skillDir: args.get("skill-dir") ? resolve(args.get("skill-dir")!) : undefined,
      lang,
      confirmDetectedSkillDir: !args.get("skill-dir") && !json ? confirmDetectedSkillDir : undefined,
    });

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Installed codemem agent integration`);
    console.log(`Agent: ${result.agent}`);
    console.log(`Project target: ${result.targetDir}`);
    console.log(`Runtime: ${result.runtimeBinDir}`);
    console.log(`Templates: ${result.templatesDir}`);
    console.log(`Integration: ${result.integrationPath}`);
    return;
  }

  if (subcommand === "detect") {
    const detections = detectAgentInstallations({
      agent: validateAgent(args.get("agent"), ["codex", "cursor", "claude-code"]) as AgentId | undefined,
      targetDir: resolve(args.get("target-dir") || process.cwd()),
      skillDir: args.get("skill-dir") ? resolve(args.get("skill-dir")!) : undefined,
    });

    if (json) {
      console.log(JSON.stringify(detections, null, 2));
      return;
    }

    for (const item of detections) {
      console.log(`${item.agent}: ${item.configured ? "configured" : "missing"}`);
      console.log(`  target: ${item.targetDir}`);
      console.log(`  skill: ${item.skillDir}`);
      console.log(`  reason: ${item.selectionReason}`);
      console.log(`  integration: ${item.integrationPath}`);
      console.log(`  runtime: ${item.runtimeBinDir}`);
      console.log(`  templates: ${item.templatesDir}`);
    }
    return;
  }

  const result = exportAgentPackage({
    rootDir,
    agent: validateAgent(args.get("agent"), ["codex", "cursor", "claude-code", "all"]) as AgentId | "all" | undefined,
    targetDir: args.get("target-dir") ? resolve(args.get("target-dir")!) : undefined,
    version: args.get("version") || "0.1.0",
    lang,
    packageName: args.get("package-name") || "codemem-agent-kit",
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Exported codemem agent package`);
  console.log(`Agent scope: ${result.agent}`);
  console.log(`Package directory: ${result.packageDir}`);
  console.log(`Package archive: ${result.archiveFile}`);
  console.log(`Archive digest: ${result.digestFile}`);
}

await main();
