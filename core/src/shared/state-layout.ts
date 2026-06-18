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
  const legacyStateDir = join(rootDir, ".codemem");
  if (!existsSync(legacyStateDir)) {
    return;
  }

  mergeDirectoryIfPresent(join(legacyStateDir, ".standards-logs"), getLogsDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, ".standards-meta"), getMetaDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "logs", "standards"), getLogsDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "meta", "standards"), getMetaDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "agent-runtime"), join(getRuntimeDir(rootDir), "agent-runtime"));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "runtime", "agent-runtime"), join(getRuntimeDir(rootDir), "agent-runtime"));
  mergeDirectoryIfPresent(join(legacyStateDir, "packages"), getStandardsPackagesDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "packages", "standards"), getStandardsPackagesDir(rootDir));

  moveFileIfPresent(join(legacyStateDir, "projects-registry.json"), getProjectsRegistryFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "_system", "registry", "projects-registry.json"), getProjectsRegistryFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "packages-registry.json"), getPackagesRegistryFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "_system", "registry", "packages-registry.json"), getPackagesRegistryFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "GLOBAL_STANDARD.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "global", "GLOBAL_STANDARD.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "global", "global-standard.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "STANDARDS_CONFLICTS.md"), getStandardsConflictsFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "reports", "STANDARDS_CONFLICTS.md"), getStandardsConflictsFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "reports", "standards-conflicts.md"), getStandardsConflictsFile(rootDir));

  for (const entry of readdirSync(legacyStateDir)) {
    if (!entry.startsWith("PROJECT_STANDARD.") || !entry.endsWith(".md")) {
      continue;
    }
    const project = basename(entry, ".md").replace(/^PROJECT_STANDARD\./, "");
    moveFileIfPresent(join(legacyStateDir, entry), getProjectStandardFile(rootDir, project));
  }

  const legacyProjectsDir = join(legacyStateDir, "docs", "projects");
  if (existsSync(legacyProjectsDir)) {
    for (const entry of readdirSync(legacyProjectsDir)) {
      if (!entry.endsWith(".md")) {
        continue;
      }
      const project = basename(entry, ".md")
        .replace(/^PROJECT_STANDARD\./, "")
        .replace(/^project-standard\./, "");
      moveFileIfPresent(join(legacyProjectsDir, entry), getProjectStandardFile(rootDir, project));
    }
  }

  rmSync(legacyStateDir, { recursive: true, force: true });
}
