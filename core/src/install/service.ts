import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ensureDir, loadJson, saveJson } from "../shared/fs";
import { nowIso } from "../shared/time";

export interface InstallMetadata {
  schema: 1;
  updatedAt: string;
  managedInstallDir: string;
  activeSourceDir: string;
  binDir: string;
  shimFile: string;
  profileFile: string;
}

export interface InstallPathsOptions {
  homeDir?: string;
  installDir?: string;
  binDir?: string;
  profileFile?: string;
}

export interface InstallPaths {
  homeDir: string;
  managedInstallDir: string;
  binDir: string;
  shimFile: string;
  profileFile: string;
  metadataFile: string;
}

function defaultHomeDir(): string {
  return process.env.HOME || "";
}

function defaultProfileFile(homeDir: string): string {
  const shell = process.env.SHELL || "";
  return join(homeDir, shell.endsWith("bash") ? ".bashrc" : ".zshrc");
}

export function getInstallPaths(options: InstallPathsOptions = {}): InstallPaths {
  const homeDir = resolve(options.homeDir || defaultHomeDir());
  const managedInstallDir = resolve(options.installDir || process.env.CODEMEM_HOME || join(homeDir, ".codemem", "source"));
  const binDir = resolve(options.binDir || process.env.CODEMEM_BIN_DIR || join(homeDir, ".local", "bin"));
  const profileFile = resolve(options.profileFile || process.env.CODEMEM_PROFILE || defaultProfileFile(homeDir));

  return {
    homeDir,
    managedInstallDir,
    binDir,
    shimFile: join(binDir, "codemem"),
    profileFile,
    metadataFile: join(homeDir, ".codemem", "_system", "install.json"),
  };
}

export function loadInstallMetadata(options: InstallPathsOptions = {}): InstallMetadata | null {
  const { metadataFile } = getInstallPaths(options);
  const data = loadJson<InstallMetadata | null>(metadataFile, null);
  if (!data || data.schema !== 1) {
    return null;
  }
  return data;
}

export function saveInstallMetadata(metadata: InstallMetadata, options: InstallPathsOptions = {}): string {
  const { metadataFile } = getInstallPaths(options);
  ensureDir(dirname(metadataFile));
  saveJson(metadataFile, metadata);
  return metadataFile;
}

export function writeGlobalShim(sourceDir: string, options: InstallPathsOptions = {}): string {
  const { shimFile, binDir } = getInstallPaths(options);
  ensureDir(binDir);
  writeFileSync(shimFile, [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `exec "${resolve(sourceDir, "bin", "codemem")}" "$@"`,
    "",
  ].join("\n"));
  return shimFile;
}

export function syncManagedInstall(sourceDir: string, installDir: string): void {
  const from = resolve(sourceDir);
  const to = resolve(installDir);
  if (from === to) {
    return;
  }

  ensureDir(to);

  for (const entry of readdirSync(to)) {
    if (entry === ".git") {
      continue;
    }

    rmSync(join(to, entry), { recursive: true, force: true });
  }

  cpSync(from, to, {
    recursive: true,
    filter: (entry) => {
      const base = basename(entry);
      return base !== ".git" && base !== ".codemem" && base !== "node_modules" && !base.endsWith(".bun-build");
    },
  });
}

export function activateCodememSource(sourceDir: string, options: InstallPathsOptions = {}): { shimFile: string; metadataFile: string } {
  const paths = getInstallPaths(options);
  const shimFile = writeGlobalShim(sourceDir, options);
  const metadataFile = saveInstallMetadata({
    schema: 1,
    updatedAt: nowIso(),
    managedInstallDir: paths.managedInstallDir,
    activeSourceDir: resolve(sourceDir),
    binDir: paths.binDir,
    shimFile,
    profileFile: paths.profileFile,
  }, options);

  return { shimFile, metadataFile };
}

export function isManagedCodememShim(path: string, managedInstallDir: string, activeSourceDir?: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  const content = readFileSync(path, "utf8");
  return content.includes("codemem") && (
    content.includes(`${resolve(managedInstallDir, "bin", "codemem")}`) ||
    (activeSourceDir ? content.includes(`${resolve(activeSourceDir, "bin", "codemem")}`) : false) ||
    content.includes("/bin/codemem")
  );
}
