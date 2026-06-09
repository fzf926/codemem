import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installPackage } from "../core/src/installer/service";
import { buildPackage } from "../core/src/packaging/service";
import { initProject, captureRule } from "../core/src/standards/service";
import { listProjects } from "../core/src/registry/service";

function makeRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function prepareRoot(root: string): void {
  cpSync(
    join(process.cwd(), "skills", "codemem", "templates"),
    join(root, "skills", "codemem", "templates"),
    { recursive: true },
  );
}

function captureDocsRule(rootDir: string, project: string): void {
  captureRule({
    rootDir,
    project,
    type: "docs",
    title: "规范目录",
    rule: "所有规范输出统一落在 .codemem 目录",
    priority: "P1",
    status: "active",
    scope: "project",
    source: "test",
    lang: "zh",
  });
}

function buildSourcePackage(rootDir: string, version: string): { artifactDir: string; artifactFile: string } {
  const initialized = initProject({
    rootDir,
    project: "source-project",
    owner: "cm",
    projectPath: rootDir,
  });

  expect(existsSync(initialized.agentsFile)).toBe(true);
  expect(existsSync(initialized.cursorRuleFile)).toBe(true);
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain(".codemem/docs/global/global-standard.md");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("project-standard.source-project.md");

  captureDocsRule(rootDir, "source-project");

  return buildPackage({
    rootDir,
    project: "source-project",
    version,
    lang: "zh",
    packageId: "shared-standard-source-project",
  });
}

describe("package and install flow", () => {
  test("packages a project standard and installs it into a target project", () => {
    const sourceRoot = makeRoot("codemem-source-");
    const targetRoot = makeRoot("codemem-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "9.9.9");

      expect(existsSync(packaged.artifactFile)).toBe(true);
      expect(existsSync(`${packaged.artifactFile}.sha256`)).toBe(true);
      const manifest = JSON.parse(
        readFileSync(join(packaged.artifactDir, "standard-package.json"), "utf8"),
      ) as {
        schema: number;
        compatibility: {
          installerSchema: number;
          generatedBy: { tool: string; version: string };
          runtimes: { node: string };
        };
        integrity: {
          archiveSha256: string;
          files: Record<string, string>;
        };
      };
      expect(manifest.schema).toBe(1);
      expect(manifest.compatibility.installerSchema).toBe(1);
      expect(manifest.compatibility.generatedBy.tool).toBe("codemem");
      expect(manifest.compatibility.runtimes.node).toBe(">=18");
      expect(manifest.compatibility.requires.codemem).toBe(">=0.1.0");
      expect(manifest.integrity.archiveSha256).toHaveLength(64);
      expect(manifest.integrity.files["global-standard.md"]).toHaveLength(64);
      expect(manifest.integrity.files["project-standard.source-project.md"]).toHaveLength(64);

      const result = installPackage({
        rootDir: sourceRoot,
        packagePath: packaged.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });
      expect(result.action).toBe("installed");
      expect(result.compatibility.hostCodememVersion).toBe("0.1.0");
      expect(result.compatibility.requiredCodememVersion).toBe(">=0.1.0");
      expect(result.compatibility.requiredNodeVersion).toBe(">=18");

      expect(existsSync(join(targetRoot, ".codemem", "installed-standard.json"))).toBe(true);

      const installed = JSON.parse(
        readFileSync(join(targetRoot, ".codemem", "installed-standard.json"), "utf8"),
      ) as { packageVersion: string; sourceProject: string };

      expect(installed.packageVersion).toBe("9.9.9");
      expect(installed.sourceProject).toBe("source-project");

      const registry = listProjects(sourceRoot);
      expect(registry.projects.some((item) => item.project === "target-project")).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("generated installer exposes help and validates arguments", () => {
    const sourceRoot = makeRoot("codemem-installer-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "9.9.9");

      const help = spawnSync("node", [join(packaged.artifactDir, "install.mjs"), "--help"], {
        encoding: "utf8",
      });
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("install.mjs");
      expect(help.stdout).toContain("Arguments:");
      expect(help.stdout).toContain("`--target`");
      expect(help.stdout).toContain("`--allow-downgrade`");

      const invalid = spawnSync("node", [join(packaged.artifactDir, "install.mjs"), "--wat"], {
        encoding: "utf8",
      });
      expect(invalid.status).not.toBe(0);
      expect(invalid.stderr).toContain("unknown argument --wat");
      expect(invalid.stderr).toContain("Arguments:");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  test("upgrades an existing installation when the incoming version is newer", () => {
    const sourceRoot = makeRoot("codemem-upgrade-source-");
    const targetRoot = makeRoot("codemem-upgrade-target-");

    try {
      prepareRoot(sourceRoot);

      const firstPackage = buildSourcePackage(sourceRoot, "1.0.0");
      const secondPackage = buildSourcePackage(sourceRoot, "1.1.0");

      const firstResult = installPackage({
        rootDir: sourceRoot,
        packagePath: firstPackage.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });
      expect(firstResult.action).toBe("installed");

      const secondResult = installPackage({
        rootDir: sourceRoot,
        packagePath: secondPackage.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });
      expect(secondResult.action).toBe("upgraded");

      const installed = JSON.parse(
        readFileSync(join(targetRoot, ".codemem", "installed-standard.json"), "utf8"),
      ) as { packageVersion: string };

      expect(installed.packageVersion).toBe("1.1.0");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("rejects downgrade by default when a newer version is already installed", () => {
    const sourceRoot = makeRoot("codemem-downgrade-source-");
    const targetRoot = makeRoot("codemem-downgrade-target-");

    try {
      prepareRoot(sourceRoot);

      const newerPackage = buildSourcePackage(sourceRoot, "2.0.0");
      const olderPackage = buildSourcePackage(sourceRoot, "1.5.0");

      installPackage({
        rootDir: sourceRoot,
        packagePath: newerPackage.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });

      expect(() => {
        installPackage({
          rootDir: sourceRoot,
          packagePath: olderPackage.artifactFile,
          target: targetRoot,
          project: "target-project",
          owner: "cm",
        });
      }).toThrow("Refusing to downgrade");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("allows downgrade when explicitly requested", () => {
    const sourceRoot = makeRoot("codemem-allow-downgrade-source-");
    const targetRoot = makeRoot("codemem-allow-downgrade-target-");

    try {
      prepareRoot(sourceRoot);

      const newerPackage = buildSourcePackage(sourceRoot, "3.0.0");
      const olderPackage = buildSourcePackage(sourceRoot, "2.5.0");

      installPackage({
        rootDir: sourceRoot,
        packagePath: newerPackage.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });

      const downgradeResult = installPackage({
        rootDir: sourceRoot,
        packagePath: olderPackage.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
        allowDowngrade: true,
      });
      expect(downgradeResult.action).toBe("downgraded");

      const installed = JSON.parse(
        readFileSync(join(targetRoot, ".codemem", "installed-standard.json"), "utf8"),
      ) as { packageVersion: string };

      expect(installed.packageVersion).toBe("2.5.0");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("reinstalls the same version only when forced", () => {
    const sourceRoot = makeRoot("codemem-reinstall-source-");
    const targetRoot = makeRoot("codemem-reinstall-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "4.0.0");

      installPackage({
        rootDir: sourceRoot,
        packagePath: packaged.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      });

      expect(() => {
        installPackage({
          rootDir: sourceRoot,
          packagePath: packaged.artifactFile,
          target: targetRoot,
          project: "target-project",
          owner: "cm",
        });
      }).toThrow("Refusing to reinstall");

      const reinstalled = installPackage({
        rootDir: sourceRoot,
        packagePath: packaged.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
        force: true,
      });

      expect(reinstalled.action).toBe("reinstalled");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("rejects unsupported package manifest schema", () => {
    const sourceRoot = makeRoot("codemem-schema-source-");
    const targetRoot = makeRoot("codemem-schema-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "5.0.0");
      const manifestFile = join(packaged.artifactDir, "standard-package.json");
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as { schema: number };
      manifest.schema = 999;
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

      expect(() => {
        installPackage({
          rootDir: sourceRoot,
          packagePath: packaged.artifactDir,
          target: targetRoot,
          project: "target-project",
          owner: "cm",
        });
      }).toThrow("Unsupported package schema");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("rejects package when the host codemem version does not satisfy the manifest requirement", () => {
    const sourceRoot = makeRoot("codemem-hostreq-source-");
    const targetRoot = makeRoot("codemem-hostreq-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "6.0.0");
      const manifestFile = join(packaged.artifactDir, "standard-package.json");
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
        compatibility: { requires: { codemem: string } };
      };
      manifest.compatibility.requires.codemem = ">=9.0.0";
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

      expect(() => {
        installPackage({
          rootDir: sourceRoot,
          packagePath: packaged.artifactDir,
          target: targetRoot,
          project: "target-project",
          owner: "cm",
        });
      }).toThrow("requires codemem");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("rejects package when payload integrity does not match the manifest", () => {
    const sourceRoot = makeRoot("codemem-integrity-source-");
    const targetRoot = makeRoot("codemem-integrity-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "7.0.0");
      writeFileSync(join(packaged.artifactDir, "payload", "global-standard.md"), "# tampered\n");

      expect(() => {
        installPackage({
          rootDir: sourceRoot,
          packagePath: packaged.artifactDir,
          target: targetRoot,
          project: "target-project",
          owner: "cm",
        });
      }).toThrow("Integrity check failed");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("cli install command prints compatibility summary", () => {
    const sourceRoot = makeRoot("codemem-cliinstall-source-");
    const targetRoot = makeRoot("codemem-cliinstall-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "8.0.0");

      const result = spawnSync(
        "bun",
        [
          "run",
          "core/src/cli/install.ts",
          "--root",
          sourceRoot,
          "--package",
          packaged.artifactDir,
          "--target",
          targetRoot,
          "--project",
          "target-project",
          "--owner",
          "cm",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Install action: installed");
      expect(result.stdout).toContain("Compatibility: codemem 0.1.0 satisfies >=0.1.0");
      expect(result.stdout).toContain("Node requirement >=18");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("cli install command supports json output", () => {
    const sourceRoot = makeRoot("codemem-cliinstall-json-source-");
    const targetRoot = makeRoot("codemem-cliinstall-json-target-");

    try {
      prepareRoot(sourceRoot);
      const packaged = buildSourcePackage(sourceRoot, "8.1.0");

      const result = spawnSync(
        "bun",
        [
          "run",
          "core/src/cli/install.ts",
          "--root",
          sourceRoot,
          "--package",
          packaged.artifactDir,
          "--target",
          targetRoot,
          "--project",
          "target-project",
          "--owner",
          "cm",
          "--json",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        action: string;
        packageId: string;
        compatibility: { requiredNodeVersion: string };
      };
      expect(parsed.action).toBe("installed");
      expect(parsed.packageId).toBe("shared-standard-source-project");
      expect(parsed.compatibility.requiredNodeVersion).toBe(">=18");
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("writes generated standards docs into docs and internal state into _system", () => {
    const sourceRoot = makeRoot("codemem-structure-source-");

    try {
      prepareRoot(sourceRoot);
      buildSourcePackage(sourceRoot, "1.0.0");

      expect(existsSync(join(sourceRoot, ".codemem", "docs", "global", "global-standard.md"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "docs", "projects", "project-standard.source-project.md"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "docs", "reports", "standards-conflicts.md"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "logs", "standards", "source-project.jsonl"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "meta", "standards", "source-project.env"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "registry", "projects-registry.json"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "packages", "standards"))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });
});
