import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { getCommandSpec } from "../cli/command-registry";
import { renderArgsTable } from "../cli/doc-render";
import { registerPackage } from "../registry/service";
import { ensureDir } from "../shared/fs";
import { sha256File } from "../shared/hash";
import {
  getGlobalStandardFile,
  getProjectStandardFile,
  getStandardsConflictsFile,
  getStandardsPackagesDir,
  getStateDir,
} from "../shared/paths";
import { run, runTar } from "../shared/process";
import { nowIso } from "../shared/time";
import { compareVersions, satisfiesMinVersion } from "../shared/version";
import { buildStandards } from "../standards/service";

export interface PackageOptions {
  rootDir: string;
  project: string;
  version: string;
  lang: string;
  packageId: string;
}

const PACKAGE_SCHEMA = 1;
const INSTALLER_SCHEMA = 1;
const MIN_NODE_MAJOR = 18;

function loadToolVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return packageJson.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function createInstallerScript(): string {
  const installSpec = getCommandSpec("install");
  const installerArgs = (installSpec.args || []).filter((arg) => arg.name !== "--package");
  const helpText = [
    "install.mjs",
    "",
    "install this shared standard package into another project",
    "",
    "Usage:",
    "",
    "  node install.mjs --target <project_dir> --project <project_name> --owner <owner>",
    "",
    "Arguments:",
    "",
    renderArgsTable(installerArgs),
  ].join("\n");

  return `#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argSpecs = ${JSON.stringify(installerArgs, null, 2)};
const helpText = ${JSON.stringify(helpText)};

function parseArgs(argv) {
  const values = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }
    values.set(key, next);
    index += 1;
  }
  return values;
}

function nowIso() {
  return new Date().toISOString().replace(/\\.\\d{3}Z$/, "Z");
}

function parseMinNodeMajor(range) {
  const match = /^>=([0-9]+)/.exec(range || "");
  return match ? Number(match[1]) : 0;
}

function parseMinVersion(range) {
  const match = /^>=\\s*([0-9A-Za-z.+-]+)$/.exec((range || "").trim());
  return match ? match[1] : null;
}

function compareVersions(left, right) {
  const splitVersion = (value) => value.trim().split(/[.+-]/).filter(Boolean);
  const comparePart = (leftPart, rightPart) => {
    const leftNumeric = /^\\d+$/.test(leftPart);
    const rightNumeric = /^\\d+$/.test(rightPart);

    if (leftNumeric && rightNumeric) {
      const diff = Number(leftPart) - Number(rightPart);
      return diff === 0 ? 0 : diff > 0 ? 1 : -1;
    }

    const diff = leftPart.localeCompare(rightPart);
    return diff === 0 ? 0 : diff > 0 ? 1 : -1;
  };

  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = comparePart(leftParts[index] || "0", rightParts[index] || "0");
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function satisfiesMinVersion(current, range) {
  const minVersion = parseMinVersion(range);
  if (!minVersion) {
    return false;
  }
  return compareVersions(current, minVersion) >= 0;
}

function failWithHelp(message) {
  throw new Error(message + "\\n\\n" + helpText);
}

function validateArgs(args) {
  if (args.get("help") === "true") {
    console.log(helpText);
    process.exit(0);
  }

  const allowedKeys = new Set(["help", ...argSpecs.map((arg) => arg.name.slice(2))]);
  for (const key of args.keys()) {
    if (!allowedKeys.has(key)) {
      failWithHelp("install.mjs: unknown argument --" + key);
    }
  }

  for (const arg of argSpecs) {
    const key = arg.name.slice(2);
    const value = args.get(key) || arg.defaultValue;

    if (!value) {
      if (arg.required) {
        failWithHelp("install.mjs: missing required argument " + arg.name);
      }
      continue;
    }

    if (Array.isArray(arg.values) && arg.values.length > 0 && !arg.values.includes(value)) {
      failWithHelp(
        "install.mjs: invalid value for " + arg.name + ": " + value + ". Allowed values: " + arg.values.join(", "),
      );
    }

    args.set(key, value);
  }
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\\n");
}

function getGlobalCodememDir() {
  if (process.env.CODEMEM_GLOBAL_DIR) {
    return resolve(process.env.CODEMEM_GLOBAL_DIR);
  }

  if (process.env.CODEMEM_HOME) {
    return resolve(dirname(process.env.CODEMEM_HOME));
  }

  return join(process.env.HOME || "", ".codemem");
}

function getGlobalProjectsRegistryFile() {
  return join(getGlobalCodememDir(), "_system", "registry", "projects-registry.json");
}

function getProjectMarkerFile(targetDir) {
  return join(targetDir, ".codemem-project.json");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function printInstallResult(args, payload) {
  if (args.get("json") !== "true") {
    return false;
  }

  console.log(JSON.stringify(payload, null, 2));
  return true;
}

function assertIntegrity(manifest, payloadDir) {
  const files = manifest.integrity?.files || {};
  for (const [file, expected] of Object.entries(files)) {
    const actual = sha256File(join(payloadDir, file));
    if (actual !== expected) {
      failWithHelp(
        "install.mjs: Integrity check failed for " + file +
        ". Expected " + expected + " but got " + actual + ".",
      );
    }
  }
}

function assertInstallAllowed(existing, manifest, args) {
  if (!existing || !existing.packageVersion) {
    return;
  }

  const force = args.get("force") === "true";
  const allowDowngrade = args.get("allow-downgrade") === "true";

  if (existing.packageId && existing.packageId !== manifest.packageId && !force) {
    failWithHelp(
      "install.mjs: refusing to replace installed package " +
      existing.packageId + "@" + existing.packageVersion +
      " with " + manifest.packageId + "@" + manifest.version +
      " without --force",
    );
  }

  const diff = compareVersions(manifest.version, existing.packageVersion);
  if (diff === 0 && !force) {
    failWithHelp(
      "install.mjs: refusing to reinstall " +
      manifest.packageId + "@" + manifest.version +
      " because the same version is already installed. Use --force to reinstall.",
    );
  }

  if (diff < 0 && !allowDowngrade && !force) {
    failWithHelp(
      "install.mjs: refusing to downgrade " +
      manifest.packageId + " from " + existing.packageVersion +
      " to " + manifest.version +
      ". Use --allow-downgrade to continue.",
    );
  }
}

function assertSupportedSchema(manifest) {
  const schema = manifest.schema || 1;
  if (schema !== 1) {
    failWithHelp("install.mjs: unsupported package schema: " + schema + ". Expected schema 1.");
  }

  const installerSchema = manifest.compatibility?.installerSchema || 1;
  if (installerSchema !== 1) {
    failWithHelp(
      "install.mjs: unsupported installer schema: " + installerSchema + ". Expected installer schema 1.",
    );
  }

  const minNode = parseMinNodeMajor(manifest.compatibility?.runtimes?.node);
  const currentNode = Number(process.versions.node.split(".")[0] || "0");
  if (minNode > 0 && currentNode < minNode) {
    failWithHelp(
      "install.mjs: Node.js " + process.versions.node +
      " is not supported. Package requires " + manifest.compatibility.runtimes.node + ".",
    );
  }

  const hostToolVersion = manifest.compatibility?.generatedBy?.version || "0.1.0";
  const requiredCodemem = manifest.compatibility?.requires?.codemem;
  if (requiredCodemem && !satisfiesMinVersion(hostToolVersion, requiredCodemem)) {
    failWithHelp(
      "install.mjs: package requires codemem " + requiredCodemem +
      ", but installer host is " + hostToolVersion + ".",
    );
  }
}

function determineInstallAction(existing, manifest) {
  if (!existing || !existing.packageVersion) {
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

const args = parseArgs(process.argv);
validateArgs(args);

const target = args.get("target");
const project = args.get("project");
const owner = args.get("owner");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(scriptDir, "standard-package.json"), "utf8"));
const payloadDir = join(scriptDir, "payload");
const targetDir = resolve(target);
const stateDir = join(targetDir, ".codemem");
const metaDir = join(stateDir, "_system", "meta", "standards");
const logsDir = join(stateDir, "_system", "logs", "standards");
const installedDir = join(stateDir, "installed-standard");
const now = nowIso();
const existingInstall = loadJson(join(stateDir, "installed-standard.json"), null);

assertSupportedSchema(manifest);
assertIntegrity(manifest, payloadDir);
const installAction = determineInstallAction(existingInstall, manifest);
assertInstallAllowed(existingInstall, manifest, args);

mkdirSync(metaDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });
mkdirSync(installedDir, { recursive: true });

for (const file of manifest.files || []) {
  copyFileSync(join(payloadDir, file), join(installedDir, file));
}

writeFileSync(join(installedDir, "standard-package.json"), JSON.stringify(manifest, null, 2) + "\\n");
writeFileSync(join(metaDir, project + ".env"), [
  "PROJECT=" + project,
  "OWNER=" + owner,
  "PROJECT_PATH=" + targetDir,
  "INITIALIZED_AT=" + now,
  "SOURCE_PROJECT=" + manifest.sourceProject,
  "SOURCE_PACKAGE_ID=" + manifest.packageId,
  "SOURCE_PACKAGE_VERSION=" + manifest.version
].join("\\n") + "\\n");

const logFile = join(logsDir, project + ".jsonl");
if (!existsSync(logFile)) {
  writeFileSync(logFile, "");
}

writeFileSync(join(stateDir, "installed-standard.json"), JSON.stringify({
  schema: 1,
  installedAt: now,
  targetProject: project,
  owner,
  targetPath: targetDir,
  packageId: manifest.packageId,
  packageVersion: manifest.version,
  sourceProject: manifest.sourceProject
}, null, 2) + "\\n");

const registryFile = getGlobalProjectsRegistryFile();
mkdirSync(dirname(registryFile), { recursive: true });
const registry = loadJson(registryFile, { schema: 1, updatedAt: now, projects: [] });
if (!Array.isArray(registry.projects)) registry.projects = [];
const record = {
  project,
  owner,
  mode: "installed",
  projectPath: targetDir,
  packageId: manifest.packageId,
  packageVersion: manifest.version,
  packageFile: "",
  sourceProject: manifest.sourceProject,
  configuredAt: now,
  lastUpdatedAt: now,
  status: "configured"
};
const index = registry.projects.findIndex((item) => item.project === record.project && item.projectPath === record.projectPath);
if (index === -1) {
  registry.projects.push(record);
} else {
  registry.projects[index] = { ...registry.projects[index], ...record };
}
registry.updatedAt = now;
saveJson(registryFile, registry);
saveJson(getProjectMarkerFile(targetDir), {
  schema: 1,
  tool: "codemem",
  enabled: true,
  project,
  owner,
  mode: "installed",
  sourceProject: manifest.sourceProject,
  packageId: manifest.packageId,
  packageVersion: manifest.version,
  configuredAt: now,
  lastUpdatedAt: now,
  status: "configured",
  standardsPolicyVersion: 1
});

  const installPayload = {
    action: installAction,
    packageId: manifest.packageId,
    packageVersion: manifest.version,
    target: targetDir,
    compatibility: {
    hostCodememVersion: manifest.compatibility?.generatedBy?.version || "0.1.0",
    requiredCodememVersion: manifest.compatibility?.requires?.codemem || ">=0.1.0",
    requiredNodeVersion: manifest.compatibility?.runtimes?.node || ">=18",
  },
};

if (!printInstallResult(args, installPayload)) {
  console.log("Install action: " + installAction);
  console.log("Installed shared standard into " + targetDir);
}
`;
}

export function buildPackage(options: PackageOptions): { artifactDir: string; artifactFile: string; digestFile: string } {
  buildStandards({
    rootDir: options.rootDir,
    project: options.project,
    lang: options.lang,
    includeDrafts: false,
  });

  const packagesDir = getStandardsPackagesDir(options.rootDir);
  ensureDir(packagesDir);

  const files = [
    getGlobalStandardFile(options.rootDir),
    getProjectStandardFile(options.rootDir, options.project),
    getStandardsConflictsFile(options.rootDir),
  ];
  for (const file of files) {
    if (!existsSync(file)) {
      throw new Error(`Missing generated file: ${file}`);
    }
  }

  const dirName = `${options.packageId}-${options.version}`;
  const artifactDir = join(packagesDir, dirName);
  const payloadDir = join(artifactDir, "payload");
  const artifactFile = `${artifactDir}.tgz`;
  const digestFile = `${artifactFile}.sha256`;

  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(payloadDir, { recursive: true });

  for (const file of files) {
    copyFileSync(file, join(payloadDir, basename(file)));
  }

  const integrityFiles = Object.fromEntries(
    files.map((file) => [basename(file), sha256File(join(payloadDir, basename(file)))]),
  );

  const manifestFile = join(artifactDir, "standard-package.json");
  const manifest = {
    schema: PACKAGE_SCHEMA,
    packageId: options.packageId,
    version: options.version,
    sourceProject: options.project,
    language: options.lang,
    compatibility: {
      installerSchema: INSTALLER_SCHEMA,
      generatedBy: {
        tool: "codemem",
        version: loadToolVersion(),
      },
      requires: {
        codemem: `>=${loadToolVersion()}`,
      },
      runtimes: {
        node: `>=${MIN_NODE_MAJOR}`,
      },
    },
    integrity: {
      algorithm: "sha256",
      archiveSha256: "",
      files: integrityFiles,
    },
    builtAt: nowIso(),
    files: files.map((file) => basename(file)),
  };

  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(artifactDir, "install.mjs"), createInstallerScript());
  writeFileSync(join(artifactDir, "README.txt"), [
    `Package: ${options.packageId}@${options.version}`,
    `Source project: ${options.project}`,
    "",
    "Install:",
    "  node install.mjs --target <project_dir> --project <project_name> --owner <owner>",
    "  node install.mjs --target <project_dir> --project <project_name> --allow-downgrade",
    "",
  ].join("\n"));

  runTar(["-czf", artifactFile, "-C", packagesDir, dirName]);
  const archiveSha256 = sha256File(artifactFile);
  manifest.integrity.archiveSha256 = archiveSha256;
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(digestFile, `${archiveSha256}  ${dirName}.tgz\n`);

  registerPackage(options.rootDir, {
    packageId: options.packageId,
    version: options.version,
    sourceProject: options.project,
    artifactDir,
    artifactFile,
  });

  return { artifactDir, artifactFile, digestFile };
}
