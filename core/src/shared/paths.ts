import { join } from "node:path";

export function getStateDir(rootDir: string): string {
  return join(rootDir, ".codemem");
}

export function getDocsDir(rootDir: string): string {
  return join(getStateDir(rootDir), "docs");
}

export function getGlobalDocsDir(rootDir: string): string {
  return join(getDocsDir(rootDir), "global");
}

export function getProjectDocsDir(rootDir: string): string {
  return join(getDocsDir(rootDir), "projects");
}

export function getReportsDir(rootDir: string): string {
  return join(getDocsDir(rootDir), "reports");
}

export function getSystemDir(rootDir: string): string {
  return join(getStateDir(rootDir), "_system");
}

export function getLogsDir(rootDir: string): string {
  return join(getSystemDir(rootDir), "logs", "standards");
}

export function getMetaDir(rootDir: string): string {
  return join(getSystemDir(rootDir), "meta", "standards");
}

export function getRuntimeDir(rootDir: string): string {
  return join(getSystemDir(rootDir), "runtime");
}

export function getRegistryDir(rootDir: string): string {
  return join(getSystemDir(rootDir), "registry");
}

export function getPackagesRootDir(rootDir: string): string {
  return join(getSystemDir(rootDir), "packages");
}

export function getStandardsPackagesDir(rootDir: string): string {
  return join(getPackagesRootDir(rootDir), "standards");
}

export function getAgentPackagesDir(rootDir: string): string {
  return join(getPackagesRootDir(rootDir), "agents");
}

export function getProjectsRegistryFile(rootDir: string): string {
  return join(getRegistryDir(rootDir), "projects-registry.json");
}

export function getPackagesRegistryFile(rootDir: string): string {
  return join(getRegistryDir(rootDir), "packages-registry.json");
}

export function getGlobalStandardFile(rootDir: string): string {
  return join(getGlobalDocsDir(rootDir), "global-standard.md");
}

export function getProjectStandardFile(rootDir: string, project: string): string {
  return join(getProjectDocsDir(rootDir), `project-standard.${project}.md`);
}

export function getStandardsConflictsFile(rootDir: string): string {
  return join(getReportsDir(rootDir), "standards-conflicts.md");
}

export function getTemplatesDir(rootDir: string): string {
  return join(rootDir, "skills", "codemem", "templates");
}
