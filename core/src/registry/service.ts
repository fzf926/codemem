import { basename } from "node:path";
import { ensureDir, loadJson, saveJson } from "../shared/fs";
import { getPackagesRegistryFile, getProjectsRegistryFile, getRegistryDir } from "../shared/paths";
import { migrateLegacyStateLayout } from "../shared/state-layout";
import { nowIso } from "../shared/time";

export interface ProjectRecord {
  project: string;
  owner: string;
  mode: string;
  projectPath: string;
  packageId: string;
  packageVersion: string;
  packageFile: string;
  sourceProject: string;
  configuredAt: string;
  lastUpdatedAt: string;
  status: string;
}

interface ProjectsRegistry {
  schema: number;
  updatedAt: string;
  projects: ProjectRecord[];
}

interface PackageRecord {
  packageId: string;
  version: string;
  sourceProject: string;
  artifactDir: string;
  artifactFile: string;
  builtAt: string;
}

interface PackagesRegistry {
  schema: number;
  updatedAt: string;
  packages: PackageRecord[];
}

function loadProjectsRegistry(rootDir: string): ProjectsRegistry {
  migrateLegacyStateLayout(rootDir);
  ensureDir(getRegistryDir(rootDir));
  return loadJson<ProjectsRegistry>(getProjectsRegistryFile(rootDir), {
    schema: 1,
    updatedAt: nowIso(),
    projects: [],
  });
}

function loadPackagesRegistry(rootDir: string): PackagesRegistry {
  migrateLegacyStateLayout(rootDir);
  ensureDir(getRegistryDir(rootDir));
  return loadJson<PackagesRegistry>(getPackagesRegistryFile(rootDir), {
    schema: 1,
    updatedAt: nowIso(),
    packages: [],
  });
}

export function upsertProject(rootDir: string, record: Omit<ProjectRecord, "lastUpdatedAt" | "status"> & { status?: string }): void {
  const registry = loadProjectsRegistry(rootDir);
  const normalized: ProjectRecord = {
    ...record,
    lastUpdatedAt: nowIso(),
    status: record.status || "configured",
  };
  const index = registry.projects.findIndex((item) => {
    if (item.project !== normalized.project) return false;
    if (item.projectPath && normalized.projectPath) {
      return item.projectPath === normalized.projectPath;
    }
    return true;
  });
  if (index === -1) {
    registry.projects.push(normalized);
  } else {
    registry.projects[index] = {
      ...registry.projects[index],
      ...normalized,
    };
  }
  registry.updatedAt = nowIso();
  saveJson(getProjectsRegistryFile(rootDir), registry);
}

export function listProjects(rootDir: string): ProjectsRegistry {
  return loadProjectsRegistry(rootDir);
}

export function registerPackage(rootDir: string, record: Omit<PackageRecord, "builtAt">): void {
  const registry = loadPackagesRegistry(rootDir);
  const normalized: PackageRecord = {
    ...record,
    builtAt: nowIso(),
  };
  const index = registry.packages.findIndex((item) => item.packageId === normalized.packageId && item.version === normalized.version);
  if (index === -1) {
    registry.packages.push(normalized);
  } else {
    registry.packages[index] = {
      ...registry.packages[index],
      ...normalized,
    };
  }
  registry.updatedAt = nowIso();
  saveJson(getPackagesRegistryFile(rootDir), registry);
}

export function formatProjectsTable(rootDir: string): string {
  const registry = listProjects(rootDir);
  if (registry.projects.length === 0) {
    return "No configured projects found.\n";
  }
  const lines = [
    [
      "PROJECT".padEnd(24),
      "MODE".padEnd(12),
      "OWNER".padEnd(16),
      "PACKAGE".padEnd(28),
      "UPDATED",
    ].join(" "),
  ];
  for (const project of registry.projects) {
    const packageLabel = project.packageVersion
      ? `${project.packageId || project.sourceProject || basename(project.project)}@${project.packageVersion}`
      : "-";
    lines.push([
      project.project.padEnd(24),
      project.mode.padEnd(12),
      project.owner.padEnd(16),
      packageLabel.padEnd(28),
      project.lastUpdatedAt,
    ].join(" "));
  }
  return `${lines.join("\n")}\n`;
}
