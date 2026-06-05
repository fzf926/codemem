import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { upsertProject } from "../registry/service";
import { sha256File } from "../shared/hash";
import { run, runTar } from "../shared/process";
import { nowToken } from "../shared/time";
import { compareVersions, satisfiesMinVersion } from "../shared/version";

export interface InstallOptions {
  rootDir: string;
  packagePath: string;
  target: string;
  project: string;
  owner: string;
  force?: boolean;
  allowDowngrade?: boolean;
  json?: boolean;
}

interface PackageManifest {
  schema?: number;
  packageId: string;
  version: string;
  sourceProject: string;
  compatibility?: {
    installerSchema?: number;
    generatedBy?: {
      tool?: string;
      version?: string;
    };
    requires?: {
      codemem?: string;
    };
    runtimes?: {
      node?: string;
    };
  };
  integrity?: {
    algorithm?: string;
    archiveSha256?: string;
    files?: Record<string, string>;
  };
}

interface InstalledStandardState {
  packageId?: string;
  packageVersion?: string;
}

export type InstallAction = "installed" | "upgraded" | "downgraded" | "reinstalled";

export interface InstallResult {
  action: InstallAction;
  packageId: string;
  packageVersion: string;
  target: string;
  compatibility: {
    hostCodememVersion: string;
    requiredCodememVersion: string;
    requiredNodeVersion: string;
  };
}

function loadInstalledState(targetDir: string): InstalledStandardState | null {
  const stateFile = join(targetDir, ".codemem", "installed-standard.json");
  if (!existsSync(stateFile)) {
    return null;
  }

  return JSON.parse(readFileSync(stateFile, "utf8")) as InstalledStandardState;
}

function loadHostToolVersion(rootDir: string): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as { version?: string };
    return packageJson.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function assertSupportedSchema(manifest: PackageManifest, hostToolVersion: string): void {
  const schema = manifest.schema ?? 1;
  if (schema !== 1) {
    throw new Error(`Unsupported package schema: ${schema}. Expected schema 1.`);
  }

  const installerSchema = manifest.compatibility?.installerSchema ?? 1;
  if (installerSchema !== 1) {
    throw new Error(`Unsupported installer schema: ${installerSchema}. Expected installer schema 1.`);
  }

  const requiredCodemem = manifest.compatibility?.requires?.codemem;
  if (requiredCodemem && !satisfiesMinVersion(hostToolVersion, requiredCodemem)) {
    throw new Error(
      `Package requires codemem ${requiredCodemem}, but current host is ${hostToolVersion}.`,
    );
  }
}

function determineInstallAction(
  existing: InstalledStandardState | null,
  manifest: PackageManifest,
): InstallAction {
  if (!existing?.packageVersion) {
    return "installed";
  }

  const diff = compareVersions(manifest.version, existing.packageVersion);
  if (diff > 0) {
    return "upgraded";
  }
  if (diff < 0) {
    return "downgraded";
  }
  return "reinstalled";
}

function assertIntegrity(packageDir: string, manifest: PackageManifest): void {
  const integrity = manifest.integrity;
  if (!integrity?.files) {
    throw new Error("Integrity check failed: package manifest is missing integrity.files.");
  }
  if ((integrity.algorithm || "sha256") !== "sha256") {
    throw new Error(`Integrity check failed: unsupported integrity algorithm ${integrity.algorithm}.`);
  }

  for (const [file, expected] of Object.entries(integrity.files)) {
    const actual = sha256File(join(packageDir, "payload", file));
    if (actual !== expected) {
      throw new Error(
        `Integrity check failed for ${file}. Expected ${expected} but got ${actual}.`,
      );
    }
  }
}

function assertInstallAllowed(
  existing: InstalledStandardState | null,
  manifest: PackageManifest,
  options: InstallOptions,
): void {
  if (!existing?.packageVersion) {
    return;
  }

  if (existing.packageId && existing.packageId !== manifest.packageId && !options.force) {
    throw new Error(
      `Refusing to replace installed package ${existing.packageId}@${existing.packageVersion} with ${manifest.packageId}@${manifest.version} without --force`,
    );
  }

  const diff = compareVersions(manifest.version, existing.packageVersion);
  if (diff === 0 && !options.force) {
    throw new Error(
      `Refusing to reinstall ${manifest.packageId}@${manifest.version} because the same version is already installed. Use --force to reinstall.`,
    );
  }

  if (diff < 0 && !options.allowDowngrade && !options.force) {
    throw new Error(
      `Refusing to downgrade ${manifest.packageId} from ${existing.packageVersion} to ${manifest.version}. Use --allow-downgrade to continue.`,
    );
  }
}

export function installPackage(options: InstallOptions): InstallResult {
  const resolvedPackagePath = resolve(options.packagePath);
  const resolvedTarget = resolve(options.target);
  let packageDir = resolvedPackagePath;
  let cleanupDir = "";

  if (!existsSync(resolvedPackagePath)) {
    throw new Error(`Package path not found: ${resolvedPackagePath}`);
  }

  if (resolvedPackagePath.endsWith(".tgz")) {
    const unpackDir = join(tmpdir(), `codemem-install-${nowToken()}`);
    mkdirSync(unpackDir, { recursive: true });
    runTar(["-xzf", resolvedPackagePath, "-C", unpackDir]);
    const entries = readdirSync(unpackDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    if (entries.length === 0) {
      throw new Error(`No package directory found after extracting: ${resolvedPackagePath}`);
    }
    packageDir = join(unpackDir, entries[0].name);
    cleanupDir = unpackDir;
  }

  if (!existsSync(join(packageDir, "install.mjs"))) {
    throw new Error(`install.mjs not found in package directory: ${packageDir}`);
  }

  const manifest = JSON.parse(readFileSync(join(packageDir, "standard-package.json"), "utf8")) as PackageManifest;
  const hostToolVersion = loadHostToolVersion(options.rootDir);
  assertSupportedSchema(manifest, hostToolVersion);
  assertIntegrity(packageDir, manifest);
  const existingInstall = loadInstalledState(resolvedTarget);
  const action = determineInstallAction(existingInstall, manifest);
  assertInstallAllowed(existingInstall, manifest, options);

  const args = [
    join(packageDir, "install.mjs"),
    "--target",
    resolvedTarget,
    "--project",
    options.project,
    "--owner",
    options.owner,
  ];
  if (options.force) {
    args.push("--force");
  }
  if (options.allowDowngrade) {
    args.push("--allow-downgrade");
  }
  if (options.json) {
    args.push("--json");
  }

  if (options.json) {
    const result = spawnSync(process.execPath, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "Package installer failed").trim());
    }
  } else {
    run(process.execPath, args);
  }

  upsertProject(options.rootDir, {
    project: options.project,
    owner: options.owner,
    mode: "installed",
    projectPath: resolvedTarget,
    packageId: manifest.packageId,
    packageVersion: manifest.version,
    packageFile: resolvedPackagePath,
    sourceProject: manifest.sourceProject,
    configuredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  });

  if (cleanupDir) {
    rmSync(cleanupDir, { recursive: true, force: true });
  }

  return {
    action,
    packageId: manifest.packageId,
    packageVersion: manifest.version,
    target: resolvedTarget,
    compatibility: {
      hostCodememVersion: hostToolVersion,
      requiredCodememVersion: manifest.compatibility?.requires?.codemem || ">=0.1.0",
      requiredNodeVersion: manifest.compatibility?.runtimes?.node || ">=18",
    },
  };
}
