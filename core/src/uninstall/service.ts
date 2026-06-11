import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface UninstallOptions {
  homeDir?: string;
  installDir?: string;
  binDir?: string;
  targetDir?: string;
  profileFile?: string;
  deleteProjectData?: boolean;
  dryRun?: boolean;
}

export interface UninstallResult {
  removed: string[];
  kept: string[];
  skipped: string[];
}

const AGENTS_MANAGED_START = "<!-- codemem:managed:start -->";
const AGENTS_MANAGED_END = "<!-- codemem:managed:end -->";

function defaultHomeDir(): string {
  return process.env.HOME || "";
}

function defaultProfileFile(homeDir: string): string {
  const shell = process.env.SHELL || "";
  return join(homeDir, shell.endsWith("bash") ? ".bashrc" : ".zshrc");
}

function removePath(path: string, result: UninstallResult, dryRun: boolean): void {
  if (!existsSync(path)) {
    result.skipped.push(path);
    return;
  }

  if (!dryRun) {
    rmSync(path, { recursive: true, force: true });
  }

  result.removed.push(path);
}

function readText(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  return readFileSync(path, "utf8");
}

function writeText(path: string, content: string, dryRun: boolean): void {
  if (!dryRun) {
    writeFileSync(path, content);
  }
}

function removeCodememProfileBlock(profileFile: string, result: UninstallResult, dryRun: boolean): void {
  const content = readText(profileFile);
  if (content === undefined) {
    result.skipped.push(profileFile);
    return;
  }

  const lines = content.split(/\r?\n/);
  const next: string[] = [];
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || "";

    if (line.trim() === "# codemem global command" && nextLine.includes("PATH=")) {
      index += 1;
      changed = true;
      continue;
    }

    next.push(line);
  }

  if (!changed) {
    result.skipped.push(profileFile);
    return;
  }

  writeText(profileFile, next.join("\n"), dryRun);
  result.removed.push(`${profileFile} codemem PATH block`);
}

function isCodememShim(path: string, installDir: string): boolean {
  const content = readText(path);
  if (content === undefined) {
    return false;
  }

  return content.includes("codemem") && (content.includes(`${installDir}/bin/codemem`) || content.includes("/bin/codemem"));
}

function safeRemoveShim(path: string, installDir: string, result: UninstallResult, dryRun: boolean): void {
  if (!existsSync(path)) {
    result.skipped.push(path);
    return;
  }

  if (!isCodememShim(path, installDir)) {
    result.kept.push(`${path} (not a codemem shim)`);
    return;
  }

  removePath(path, result, dryRun);
}

function safeRemoveProjectData(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  const projectDataDir = join(targetDir, ".codemem");
  if (!existsSync(projectDataDir)) {
    result.skipped.push(projectDataDir);
    return;
  }

  const stat = lstatSync(projectDataDir);
  if (!stat.isDirectory()) {
    result.kept.push(`${projectDataDir} (not a directory)`);
    return;
  }

  removePath(projectDataDir, result, dryRun);
}

function removeCursorRule(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  removePath(join(targetDir, ".cursor", "rules", "codemem-standards.mdc"), result, dryRun);
}

function removeAgentsManagedBlock(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  const agentsFile = join(targetDir, "AGENTS.md");
  const content = readText(agentsFile);
  if (content === undefined) {
    result.skipped.push(agentsFile);
    return;
  }

  if (!content.includes(AGENTS_MANAGED_START) || !content.includes(AGENTS_MANAGED_END)) {
    result.kept.push(`${agentsFile} (no codemem managed block)`);
    return;
  }

  const next = content
    .replace(new RegExp(`\\n?${AGENTS_MANAGED_START}[\\s\\S]*?${AGENTS_MANAGED_END}\\n?`), "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  const generatedOnly = next.trim() === "# AGENTS.md\n\nThis project uses codemem to capture and enforce development standards.";

  if (generatedOnly) {
    removePath(agentsFile, result, dryRun);
    return;
  }

  writeText(agentsFile, `${next}\n`, dryRun);
  result.removed.push(`${agentsFile} codemem managed block`);
}

function removeGitignoreEntry(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  const gitignoreFile = join(targetDir, ".gitignore");
  const content = readText(gitignoreFile);
  if (content === undefined) {
    result.skipped.push(gitignoreFile);
    return;
  }

  const lines = content.split(/\r?\n/);
  const next = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed !== ".codemem" && trimmed !== ".codemem/";
  });

  if (next.length === lines.length) {
    result.skipped.push(gitignoreFile);
    return;
  }

  writeText(gitignoreFile, next.join("\n").replace(/\n*$/, "\n"), dryRun);
  result.removed.push(`${gitignoreFile} .codemem entry`);
}

function removeProjectArtifacts(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  safeRemoveProjectData(targetDir, result, dryRun);
  removeCursorRule(targetDir, result, dryRun);
  removeAgentsManagedBlock(targetDir, result, dryRun);
  removeGitignoreEntry(targetDir, result, dryRun);
}

export function uninstallCodemem(options: UninstallOptions = {}): UninstallResult {
  const homeDir = options.homeDir || defaultHomeDir();
  const installDir = resolve(options.installDir || process.env.CODEMEM_HOME || join(homeDir, ".codemem", "source"));
  const binDir = resolve(options.binDir || process.env.CODEMEM_BIN_DIR || join(homeDir, ".local", "bin"));
  const targetDir = resolve(options.targetDir || process.cwd());
  const profileFile = options.profileFile || process.env.CODEMEM_PROFILE || defaultProfileFile(homeDir);
  const dryRun = options.dryRun === true;

  const result: UninstallResult = { removed: [], kept: [], skipped: [] };

  safeRemoveShim(join(binDir, "codemem"), installDir, result, dryRun);
  removePath(join(homeDir, ".codex", "skills", "codemem"), result, dryRun);
  removePath(join(homeDir, ".claude", "commands", "codemem.md"), result, dryRun);
  removePath(installDir, result, dryRun);
  removeCodememProfileBlock(profileFile, result, dryRun);

  if (options.deleteProjectData) {
    removeProjectArtifacts(targetDir, result, dryRun);
  } else {
    result.kept.push(join(targetDir, ".codemem"));
    result.kept.push(join(targetDir, ".cursor", "rules", "codemem-standards.mdc"));
    result.kept.push(join(targetDir, "AGENTS.md"));
    result.kept.push(join(targetDir, ".gitignore"));
  }

  return result;
}
