import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ensureDir, loadJson, saveJson } from "../shared/fs";
import {
  getGlobalProjectsRegistryFile,
  getPackagesRegistryFile,
  getProjectMarkerFile,
  getProjectsRegistryFile,
  getRegistryDir,
} from "../shared/paths";
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
  projectDocPath?: string;
}

interface ProjectsRegistry {
  schema: number;
  updatedAt: string;
  projects: ProjectRecord[];
}

export interface ProjectMarker {
  schema: number;
  tool: "codemem";
  enabled: true;
  project: string;
  owner: string;
  mode: string;
  sourceProject: string;
  packageId: string;
  packageVersion: string;
  configuredAt: string;
  lastUpdatedAt: string;
  status: string;
  standardsPolicyVersion: number;
  projectDocPath?: string;
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
  ensureDir(dirname(getGlobalProjectsRegistryFile()));
  migrateLocalProjectsRegistryToGlobal(rootDir);
  return loadJson<ProjectsRegistry>(getGlobalProjectsRegistryFile(), {
    schema: 1,
    updatedAt: nowIso(),
    projects: [],
  });
}

function migrateLocalProjectsRegistryToGlobal(rootDir: string): void {
  const localRegistryFile = getProjectsRegistryFile(rootDir);
  const globalRegistryFile = getGlobalProjectsRegistryFile();

  if (!existsSync(localRegistryFile) || existsSync(globalRegistryFile)) {
    return;
  }

  saveJson(globalRegistryFile, loadJson(localRegistryFile, {
    schema: 1,
    updatedAt: nowIso(),
    projects: [],
  }));
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
  saveJson(getGlobalProjectsRegistryFile(), registry);
  saveProjectMarker(rootDir, normalized);
}

export function listProjects(rootDir: string): ProjectsRegistry {
  return loadProjectsRegistry(rootDir);
}

export function saveProjectMarker(rootDir: string, record: ProjectRecord): void {
  const marker: ProjectMarker = {
    schema: 1,
    tool: "codemem",
    enabled: true,
    project: record.project,
    owner: record.owner,
    mode: record.mode,
    sourceProject: record.sourceProject,
    packageId: record.packageId,
    packageVersion: record.packageVersion,
    configuredAt: record.configuredAt,
    lastUpdatedAt: record.lastUpdatedAt,
    status: record.status,
    standardsPolicyVersion: 1,
    ...(record.projectDocPath ? { projectDocPath: record.projectDocPath } : {}),
  };
  saveJson(getProjectMarkerFile(rootDir), marker);
}

export function loadProjectMarker(rootDir: string): ProjectMarker | null {
  return loadJson<ProjectMarker | null>(getProjectMarkerFile(rootDir), null);
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
