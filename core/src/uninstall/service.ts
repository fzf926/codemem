import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadJson } from "../shared/fs";
import { safeCurrentWorkingDir } from "../shared/cwd";
import { getProjectStateKey } from "../shared/paths";

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

interface LegacyInstallMetadata {
  schema: 1;
  activeSourceDir?: string;
}

interface LegacyInstallPaths {
  managedInstallDir: string;
  binDir: string;
  profileFile: string;
  metadataFile: string;
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

function getLegacyInstallPaths(options: {
  homeDir: string;
  installDir?: string;
  binDir?: string;
  profileFile?: string;
}): LegacyInstallPaths {
  const homeDir = resolve(options.homeDir);
  const managedInstallDir = resolve(options.installDir || process.env.CODEMEM_HOME || join(homeDir, ".codemem", "source"));
  const binDir = resolve(options.binDir || process.env.CODEMEM_BIN_DIR || join(homeDir, ".local", "bin"));
  return {
    managedInstallDir,
    binDir,
    profileFile: resolve(options.profileFile || process.env.CODEMEM_PROFILE || defaultProfileFile(homeDir)),
    metadataFile: join(homeDir, ".codemem", "_system", "install.json"),
  };
}

function loadLegacyInstallMetadata(metadataFile: string): LegacyInstallMetadata | null {
  const data = loadJson<LegacyInstallMetadata | null>(metadataFile, null);
  if (!data || data.schema !== 1) {
    return null;
  }
  return data;
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

function safeRemoveShim(path: string, installDir: string, activeSourceDir: string | undefined, result: UninstallResult, dryRun: boolean): void {
  if (!existsSync(path)) {
    result.skipped.push(path);
    return;
  }

  const content = readText(path) || "";
  const isCodememShim = content.includes("codemem") && (
    content.includes(`${resolve(installDir, "bin", "codemem")}`)
    || (activeSourceDir ? content.includes(`${resolve(activeSourceDir, "bin", "codemem")}`) : false)
    || content.includes("/bin/codemem")
  );

  if (!isCodememShim) {
    result.kept.push(`${path} (not a codemem shim)`);
    return;
  }

  removePath(path, result, dryRun);
}

function getProjectStateDir(homeDir: string, targetDir: string): string {
  return join(resolve(homeDir), ".codemem", "projects", getProjectStateKey(targetDir));
}

function safeRemoveProjectData(homeDir: string, targetDir: string, result: UninstallResult, dryRun: boolean): void {
  const projectStateDir = getProjectStateDir(homeDir, targetDir);
  removePath(projectStateDir, result, dryRun);

  const legacyProjectDataDir = join(targetDir, ".codemem");
  if (existsSync(legacyProjectDataDir)) {
    const stat = lstatSync(legacyProjectDataDir);
    if (!stat.isDirectory()) {
      result.kept.push(`${legacyProjectDataDir} (not a directory)`);
      return;
    }
  }
  removePath(legacyProjectDataDir, result, dryRun);
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

function removeProjectMarker(targetDir: string, result: UninstallResult, dryRun: boolean): void {
  removePath(join(targetDir, ".codemem-project.json"), result, dryRun);
}

function removeProjectFromGlobalRegistry(installDir: string, targetDir: string, result: UninstallResult, dryRun: boolean): void {
  const registryFile = join(resolve(installDir, ".."), "_system", "registry", "projects-registry.json");
  const content = readText(registryFile);
  if (content === undefined) {
    result.skipped.push(registryFile);
    return;
  }

  const registry = JSON.parse(content) as { projects?: Array<{ projectPath?: string }>; updatedAt?: string };
  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  const next = projects.filter((item) => item.projectPath !== targetDir);

  if (next.length === projects.length) {
    result.skipped.push(registryFile);
    return;
  }

  registry.projects = next;
  registry.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  writeText(registryFile, `${JSON.stringify(registry, null, 2)}\n`, dryRun);
  result.removed.push(`${registryFile} entry for ${targetDir}`);
}

function removeProjectArtifacts(homeDir: string, installDir: string, targetDir: string, result: UninstallResult, dryRun: boolean): void {
  safeRemoveProjectData(homeDir, targetDir, result, dryRun);
  removeCursorRule(targetDir, result, dryRun);
  removeAgentsManagedBlock(targetDir, result, dryRun);
  removeGitignoreEntry(targetDir, result, dryRun);
  removeProjectMarker(targetDir, result, dryRun);
  removeProjectFromGlobalRegistry(installDir, targetDir, result, dryRun);
}

export function uninstallCodemem(options: UninstallOptions = {}): UninstallResult {
  const homeDir = options.homeDir || defaultHomeDir();
  const paths = getLegacyInstallPaths({
    homeDir,
    installDir: options.installDir,
    binDir: options.binDir,
    profileFile: options.profileFile,
  });
  const installDir = paths.managedInstallDir;
  const binDir = paths.binDir;
  const targetDir = resolve(options.targetDir || safeCurrentWorkingDir());
  const profileFile = paths.profileFile || defaultProfileFile(homeDir);
  const dryRun = options.dryRun === true;
  const metadata = loadLegacyInstallMetadata(paths.metadataFile);

  const result: UninstallResult = { removed: [], kept: [], skipped: [] };

  safeRemoveShim(join(binDir, "codemem"), installDir, metadata?.activeSourceDir, result, dryRun);
  removePath(join(homeDir, ".codex", "skills", "codemem"), result, dryRun);
  removePath(join(homeDir, ".claude", "commands", "codemem.md"), result, dryRun);
  removePath(installDir, result, dryRun);
  removePath(paths.metadataFile, result, dryRun);
  removeCodememProfileBlock(profileFile, result, dryRun);

  if (options.deleteProjectData) {
    removeProjectArtifacts(homeDir, installDir, targetDir, result, dryRun);
  } else {
    result.kept.push(getProjectStateDir(homeDir, targetDir));
    result.kept.push(join(targetDir, ".codemem"));
    result.kept.push(join(targetDir, ".cursor", "rules", "codemem-standards.mdc"));
    result.kept.push(join(targetDir, "AGENTS.md"));
    result.kept.push(join(targetDir, ".gitignore"));
    result.kept.push(join(targetDir, ".codemem-project.json"));
  }

  return result;
}
