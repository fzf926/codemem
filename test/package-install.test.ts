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

function withGlobalDir<T>(root: string, run: () => T): T {
  const previousGlobalDir = process.env.CODEMEM_GLOBAL_DIR;
  process.env.CODEMEM_GLOBAL_DIR = join(root, ".global-codemem");

  try {
    return run();
  } finally {
    if (previousGlobalDir === undefined) {
      delete process.env.CODEMEM_GLOBAL_DIR;
    } else {
      process.env.CODEMEM_GLOBAL_DIR = previousGlobalDir;
    }
  }
}

function setGlobalDir(root: string): void {
  process.env.CODEMEM_GLOBAL_DIR = join(root, ".global-codemem");
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
  setGlobalDir(rootDir);
  const initialized = initProject({
    rootDir,
    project: "source-project",
    owner: "cm",
    projectPath: rootDir,
  });

  expect(existsSync(initialized.agentsFile)).toBe(true);
  expect(existsSync(initialized.cursorRuleFile)).toBe(true);
  expect(existsSync(initialized.gitignoreFile)).toBe(true);
  expect(existsSync(initialized.projectMarkerFile)).toBe(true);
  expect(existsSync(initialized.globalRegistryFile)).toBe(true);
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain(".codemem/docs/global/global-standard.md");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Default to finishing initialization, standards capture, and document regeneration in one pass.");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Do not end with optional follow-up offers for obvious low-risk work.");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Aim to capture at least one evidenced rule per applicable checklist item");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("MapStruct usage");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("module extension rules for adding new business modules");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("proactively capture and rebuild standards");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("replacing if/else or switch dispatch with strategies");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("converting MQ or event consumer branching into topic factories");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Do not require the user to explicitly mention codemem");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("capture the resulting rule(s) and rebuild the standards docs before the final response");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Do not treat architecture or refactor-derived standards capture as an optional follow-up step");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("standardizing error handling, validation, logging, idempotency, retry, timeout, or fallback behavior");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("reorganizing project structure, module boundaries, build layout, or deployment integration");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("project-standard.source-project.md");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Default to finishing initialization, standards capture, and document regeneration in one pass.");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Do not end with optional follow-up offers for obvious low-risk work.");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Aim to capture at least one evidenced rule per applicable checklist item");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("pagination queries");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("proactively capture and rebuild standards");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("replacing if/else or switch dispatch with strategies");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("converting MQ or event consumer branching into topic factories");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Do not require the user to explicitly mention codemem");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("capture the resulting rule or rules and rebuild the standards docs before the final response");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Do not treat architecture or refactor-derived standards capture as an optional follow-up step");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("standardizing error handling, validation, logging, idempotency, retry, timeout, or fallback behavior");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("reorganizing project structure, module boundaries, build layout, or deployment integration");
  expect(readFileSync(initialized.gitignoreFile, "utf8")).toContain(".codemem/");

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
      withGlobalDir(sourceRoot, () => {
        prepareRoot(sourceRoot);
      });
      const packaged = withGlobalDir(sourceRoot, () => buildSourcePackage(sourceRoot, "9.9.9"));

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

      const result = withGlobalDir(sourceRoot, () => installPackage({
        rootDir: sourceRoot,
        packagePath: packaged.artifactFile,
        target: targetRoot,
        project: "target-project",
        owner: "cm",
      }));
      expect(result.action).toBe("installed");
      expect(result.compatibility.hostCodememVersion).toBe("0.1.0");
      expect(result.compatibility.requiredCodememVersion).toBe(">=0.1.0");
      expect(result.compatibility.requiredNodeVersion).toBe(">=18");

      expect(existsSync(join(targetRoot, ".codemem", "installed-standard.json"))).toBe(true);
      expect(existsSync(join(targetRoot, ".codemem-project.json"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".global-codemem", "_system", "registry", "projects-registry.json"))).toBe(true);

      const installed = JSON.parse(
        readFileSync(join(targetRoot, ".codemem", "installed-standard.json"), "utf8"),
      ) as { packageVersion: string; sourceProject: string };

      expect(installed.packageVersion).toBe("9.9.9");
      expect(installed.sourceProject).toBe("source-project");

      const registry = withGlobalDir(sourceRoot, () => listProjects(sourceRoot));
      expect(registry.projects.some((item) => item.project === "target-project")).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  test("generated installer exposes help and validates arguments", () => {
    const sourceRoot = makeRoot("codemem-installer-");

    try {
      withGlobalDir(sourceRoot, () => {
        prepareRoot(sourceRoot);
      });
      const packaged = withGlobalDir(sourceRoot, () => buildSourcePackage(sourceRoot, "9.9.9"));

      const help = spawnSync("node", [join(packaged.artifactDir, "install.mjs"), "--help"], {
        encoding: "utf8",
        env: {
          ...process.env,
          CODEMEM_GLOBAL_DIR: join(sourceRoot, ".global-codemem"),
        },
      });
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("install.mjs");
      expect(help.stdout).toContain("Arguments:");
      expect(help.stdout).toContain("`--target`");
      expect(help.stdout).toContain("`--allow-downgrade`");

      const invalid = spawnSync("node", [join(packaged.artifactDir, "install.mjs"), "--wat"], {
        encoding: "utf8",
        env: {
          ...process.env,
          CODEMEM_GLOBAL_DIR: join(sourceRoot, ".global-codemem"),
        },
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      setGlobalDir(sourceRoot);
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
      expect(existsSync(join(sourceRoot, "docs", "spec", "project-standard.source-project.md"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "docs", "reports", "standards-conflicts.md"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "logs", "standards", "source-project.jsonl"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "meta", "standards", "source-project.env"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".global-codemem", "_system", "registry", "projects-registry.json"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem-project.json"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem", "_system", "packages", "standards"))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });
});

describe("project init guidance", () => {
  test("supports a project-specific standard document path and filename", () => {
    const root = makeRoot("codemem-project-doc-path-");
    setGlobalDir(root);
    prepareRoot(root);

    try {
      const initialized = initProject({
        rootDir: root,
        project: "custom-doc-project",
        owner: "cm",
        projectPath: root,
        projectDocPath: "docs/standards/current-project.md",
      });

      captureRule({
        rootDir: root,
        project: "custom-doc-project",
        type: "architecture",
        title: "策略分发",
        rule: "MQ 消费者按 topic 和 tag 分发到稳定策略。",
        priority: "P1",
        status: "active",
        scope: "project",
        source: "test",
        lang: "zh",
      });

      const outputs = buildPackage({
        rootDir: root,
        project: "custom-doc-project",
        version: "1.0.0",
        lang: "zh",
        packageId: "shared-standard-custom-doc-project",
      });

      const customDoc = join(root, "docs", "standards", "current-project.md");
      expect(existsSync(customDoc)).toBe(true);
      expect(readFileSync(customDoc, "utf8")).toContain("策略分发");
      expect(existsSync(join(root, "docs", "spec", "project-standard.custom-doc-project.md"))).toBe(false);
      expect(readFileSync(initialized.agentsFile, "utf8")).toContain("docs/standards/current-project.md");
      expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("docs/standards/current-project.md");
      expect(readFileSync(join(root, ".codemem-project.json"), "utf8")).toContain("\"projectDocPath\": \"docs/standards/current-project.md\"");
      expect(outputs.artifactDir).toContain("shared-standard-custom-doc-project");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects unsafe project standard document paths", () => {
    const root = makeRoot("codemem-project-doc-path-invalid-");
    setGlobalDir(root);
    prepareRoot(root);

    try {
      expect(() => initProject({
        rootDir: root,
        project: "bad-doc-project",
        owner: "cm",
        projectPath: root,
        projectDocPath: "../outside.md",
      })).toThrow("projectDocPath must be a safe relative file path");

      expect(() => initProject({
        rootDir: root,
        project: "bad-doc-project",
        owner: "cm",
        projectPath: root,
        projectDocPath: "/tmp/outside.md",
      })).toThrow("projectDocPath must be a safe relative file path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("adds .codemem to .gitignore only once", () => {
    const root = makeRoot("codemem-gitignore-");
    setGlobalDir(root);
    prepareRoot(root);

    initProject({
      rootDir: root,
      project: "gitignore-project",
      owner: "cm",
      projectPath: root,
    });
    initProject({
      rootDir: root,
      project: "gitignore-project",
      owner: "cm",
      projectPath: root,
    });

    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gitignore.split(/\r?\n/).filter((line) => line.trim() === ".codemem/")).toHaveLength(1);
  });

  test("preserves existing .gitignore entries", () => {
    const root = makeRoot("codemem-existing-gitignore-");
    setGlobalDir(root);
    prepareRoot(root);
    writeFileSync(join(root, ".gitignore"), "node_modules\n");

    initProject({
      rootDir: root,
      project: "existing-gitignore-project",
      owner: "cm",
      projectPath: root,
    });

    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain(".codemem/");
  });
});
