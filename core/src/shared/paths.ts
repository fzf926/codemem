import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";

export function getGlobalCodememDir(): string {
  const explicit = process.env.CODEMEM_GLOBAL_DIR;
  if (explicit) {
    return resolve(explicit);
  }

  const installDir = process.env.CODEMEM_HOME;
  if (installDir) {
    return resolve(dirname(installDir));
  }

  return join(process.env.HOME || "", ".codemem");
}

function safePathPart(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

export function getProjectStateKey(rootDir: string): string {
  const resolved = resolve(rootDir);
  const slug = safePathPart(basename(resolved));
  const hash = createHash("sha256").update(resolved).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

export function getProjectsRootDir(): string {
  return join(getGlobalCodememDir(), "projects");
}

export function getStateDir(rootDir: string): string {
  return join(getProjectsRootDir(), getProjectStateKey(rootDir));
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

export function getGlobalRegistryDir(): string {
  return join(getGlobalCodememDir(), "_system", "registry");
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

export function getGlobalProjectsRegistryFile(): string {
  return join(getGlobalRegistryDir(), "projects-registry.json");
}

export function getPackagesRegistryFile(rootDir: string): string {
  return join(getRegistryDir(rootDir), "packages-registry.json");
}

export function getProjectMarkerFile(rootDir: string): string {
  return join(getStateDir(rootDir), "project.json");
}

export function getGlobalStandardFile(rootDir: string): string {
  return join(getGlobalDocsDir(rootDir), "global-standard.md");
}

export function getDefaultProjectStandardRelativePath(project: string): string {
  return `docs/spec/project-standard.${project}.md`;
}

export function normalizeProjectDocPath(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const input = value.trim().replaceAll("\\", "/");
  const hasWindowsDrive = /^[A-Za-z]:\//.test(input);
  if (isAbsolute(input) || hasWindowsDrive || input.endsWith("/")) {
    throw new Error("projectDocPath must be a safe relative file path inside the project");
  }

  const normalized = normalize(input).replaceAll("\\", "/");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("projectDocPath must be a safe relative file path inside the project");
  }

  return normalized;
}

export function getProjectStandardRelativePath(rootDir: string, project: string, projectDocPath?: string): string {
  const explicit = normalizeProjectDocPath(projectDocPath);
  if (explicit) {
    return explicit;
  }

  try {
    const marker = JSON.parse(readFileSync(getProjectMarkerFile(rootDir), "utf8")) as { projectDocPath?: unknown };
    const fromMarker = typeof marker.projectDocPath === "string"
      ? normalizeProjectDocPath(marker.projectDocPath)
      : undefined;
    if (fromMarker) {
      return fromMarker;
    }
  } catch {
    // Missing or malformed markers fall back to the legacy project marker and then generated path.
  }

  try {
    const legacyMarker = JSON.parse(readFileSync(join(rootDir, ".codemem-project.json"), "utf8")) as { projectDocPath?: unknown };
    const fromLegacyMarker = typeof legacyMarker.projectDocPath === "string"
      ? normalizeProjectDocPath(legacyMarker.projectDocPath)
      : undefined;
    if (fromLegacyMarker) {
      return fromLegacyMarker;
    }
  } catch {
    // Missing or malformed legacy markers fall back to the generated path.
  }

  return getDefaultProjectStandardRelativePath(project);
}

export function getProjectStandardFile(rootDir: string, project: string, projectDocPath?: string): string {
  return join(rootDir, getProjectStandardRelativePath(rootDir, project, projectDocPath));
}

export function getStandardsConflictsFile(rootDir: string): string {
  return join(getReportsDir(rootDir), "standards-conflicts.md");
}

export function getTemplatesDir(rootDir: string): string {
  const explicit = process.env.CODEMEM_TEMPLATES_DIR;
  if (explicit) {
    return explicit;
  }

  const local = join(rootDir, "skills", "codemem", "templates");
  if (existsSync(local)) {
    return local;
  }

  const execTemplates = resolve(dirname(process.execPath), "..", "templates");
  if (existsSync(execTemplates)) {
    return execTemplates;
  }

  return local;
}
