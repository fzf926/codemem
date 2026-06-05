import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import {
  getGlobalStandardFile,
  getLogsDir,
  getMetaDir,
  getPackagesRegistryFile,
  getProjectsRegistryFile,
  getStandardsConflictsFile,
  getStandardsPackagesDir,
  getStateDir,
  getProjectStandardFile,
  getRuntimeDir,
} from "./paths";

function copyInto(sourcePath: string, targetPath: string): void {
  mkdirSync(join(targetPath, ".."), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
}

function moveFileIfPresent(sourcePath: string, targetPath: string): void {
  if (!existsSync(sourcePath) || existsSync(targetPath)) {
    return;
  }
  copyInto(sourcePath, targetPath);
  rmSync(sourcePath, { force: true, recursive: true });
}

function mergeDirectoryIfPresent(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) {
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    if (!existsSync(targetPath)) {
      copyInto(sourcePath, targetPath);
    }
  }
  rmSync(sourceDir, { recursive: true, force: true });
}

export function migrateLegacyStateLayout(rootDir: string): void {
  const stateDir = getStateDir(rootDir);
  if (!existsSync(stateDir)) {
    return;
  }

  mergeDirectoryIfPresent(join(stateDir, ".standards-logs"), getLogsDir(rootDir));
  mergeDirectoryIfPresent(join(stateDir, ".standards-meta"), getMetaDir(rootDir));
  mergeDirectoryIfPresent(join(stateDir, "agent-runtime"), join(getRuntimeDir(rootDir), "agent-runtime"));
  mergeDirectoryIfPresent(join(stateDir, "packages"), getStandardsPackagesDir(rootDir));

  moveFileIfPresent(join(stateDir, "projects-registry.json"), getProjectsRegistryFile(rootDir));
  moveFileIfPresent(join(stateDir, "packages-registry.json"), getPackagesRegistryFile(rootDir));
  moveFileIfPresent(join(stateDir, "GLOBAL_STANDARD.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(stateDir, "docs", "global", "GLOBAL_STANDARD.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(stateDir, "STANDARDS_CONFLICTS.md"), getStandardsConflictsFile(rootDir));
  moveFileIfPresent(join(stateDir, "docs", "reports", "STANDARDS_CONFLICTS.md"), getStandardsConflictsFile(rootDir));

  for (const entry of readdirSync(stateDir)) {
    if (!entry.startsWith("PROJECT_STANDARD.") || !entry.endsWith(".md")) {
      continue;
    }
    const project = basename(entry, ".md").replace(/^PROJECT_STANDARD\./, "");
    moveFileIfPresent(join(stateDir, entry), getProjectStandardFile(rootDir, project));
  }

  const legacyProjectsDir = join(stateDir, "docs", "projects");
  if (existsSync(legacyProjectsDir)) {
    for (const entry of readdirSync(legacyProjectsDir)) {
      if (!entry.startsWith("PROJECT_STANDARD.") || !entry.endsWith(".md")) {
        continue;
      }
      const project = basename(entry, ".md").replace(/^PROJECT_STANDARD\./, "");
      moveFileIfPresent(join(legacyProjectsDir, entry), getProjectStandardFile(rootDir, project));
    }
  }
}
