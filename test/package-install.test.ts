import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installPackage } from "../core/src/installer/service";
import { buildPackage } from "../core/src/packaging/service";
import { initProject, captureRule } from "../core/src/standards/service";
import { listProjects } from "../core/src/registry/service";
import { getGlobalStandardFile, getLogsDir, getMetaDir, getProjectMarkerFile, getStandardsConflictsFile, getStandardsPackagesDir, getStateDir } from "../core/src/shared/paths";

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
    title: "规范状态目录",
    rule: "项目只保留规范入口文档，内部状态统一落在 ~/.codemem/projects 对应项目目录。",
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
  expect(existsSync(initialized.gitignoreFile)).toBe(false);
  expect(existsSync(initialized.projectMarkerFile)).toBe(true);
  expect(existsSync(initialized.globalRegistryFile)).toBe(true);
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("global-standard.md");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("Codemem 开发规范");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("默认在同一轮完成初始化、规范记录和文档重新生成");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("不要用“如果你要，我可以继续");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("每个适用清单项至少沉淀 1 条");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("MapStruct 使用规范");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("模块扩展规范");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("主动记录并重新生成规范文档");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("将 if/else 或 switch 分发替换为策略");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("将 MQ 或事件消费者分支改造成 topic 工厂");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("不要求用户显式提到 codemem");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("在最终回复前记录对应规范并重新生成规范文档");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("不要把架构或重构产生的规范记录当成代码改完后的可选后续事项");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("统一错误处理、校验、日志、幂等、重试、超时或降级行为");
  expect(readFileSync(initialized.agentsFile, "utf8")).toContain("重组项目结构、模块边界、构建布局或部署集成");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("project-standard.source-project.md");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("Codemem 开发规范");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("默认在同一轮完成初始化、规范记录和文档重新生成");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("不要用“如果你要，我可以继续");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("每个适用清单项至少沉淀 1 条");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("分页查询规范");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("主动记录并重新生成规范文档");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("将 if/else 或 switch 分发替换为策略");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("将 MQ 或事件消费者分支改造成 topic 工厂");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("不要求用户显式提到 codemem");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("在最终回复前记录对应规范并重新生成规范文档");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("不要把架构或重构产生的规范记录当成代码改完后的可选后续事项");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("统一错误处理、校验、日志、幂等、重试、超时或降级行为");
  expect(readFileSync(initialized.cursorRuleFile, "utf8")).toContain("重组项目结构、模块边界、构建布局或部署集成");
  expect(existsSync(join(rootDir, ".codemem"))).toBe(false);
  expect(existsSync(join(rootDir, ".codemem-project.json"))).toBe(false);

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

      const targetStateDir = withGlobalDir(sourceRoot, () => getStateDir(targetRoot));
      expect(existsSync(join(targetStateDir, "installed-standard.json"))).toBe(true);
      expect(withGlobalDir(sourceRoot, () => existsSync(getProjectMarkerFile(targetRoot)))).toBe(true);
      expect(existsSync(join(targetRoot, ".codemem"))).toBe(false);
      expect(existsSync(join(targetRoot, ".codemem-project.json"))).toBe(false);
      expect(existsSync(join(sourceRoot, ".global-codemem", "_system", "registry", "projects-registry.json"))).toBe(true);

      const installed = JSON.parse(
        readFileSync(join(targetStateDir, "installed-standard.json"), "utf8"),
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
        readFileSync(join(getStateDir(targetRoot), "installed-standard.json"), "utf8"),
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
        readFileSync(join(getStateDir(targetRoot), "installed-standard.json"), "utf8"),
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
          env: {
            ...process.env,
            CODEMEM_GLOBAL_DIR: join(sourceRoot, ".global-codemem"),
          },
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
          env: {
            ...process.env,
            CODEMEM_GLOBAL_DIR: join(sourceRoot, ".global-codemem"),
          },
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

  test("writes project docs in the project and internal state under the home codemem project state", () => {
    const sourceRoot = makeRoot("codemem-structure-source-");

    try {
      prepareRoot(sourceRoot);
      buildSourcePackage(sourceRoot, "1.0.0");

      expect(existsSync(getGlobalStandardFile(sourceRoot))).toBe(true);
      expect(existsSync(join(sourceRoot, "docs", "spec", "project-standard.source-project.md"))).toBe(true);
      expect(existsSync(getStandardsConflictsFile(sourceRoot))).toBe(true);
      expect(existsSync(join(getLogsDir(sourceRoot), "source-project.jsonl"))).toBe(true);
      expect(existsSync(join(getMetaDir(sourceRoot), "source-project.env"))).toBe(true);
      expect(existsSync(join(sourceRoot, ".global-codemem", "_system", "registry", "projects-registry.json"))).toBe(true);
      expect(existsSync(getProjectMarkerFile(sourceRoot))).toBe(true);
      expect(existsSync(join(sourceRoot, ".codemem"))).toBe(false);
      expect(existsSync(join(sourceRoot, ".codemem-project.json"))).toBe(false);
      expect(existsSync(getStandardsPackagesDir(sourceRoot))).toBe(true);
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
      expect(readFileSync(getProjectMarkerFile(root), "utf8")).toContain("\"projectDocPath\": \"docs/standards/current-project.md\"");
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

  test("does not create project .codemem or .gitignore during init", () => {
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

    expect(existsSync(join(root, ".codemem"))).toBe(false);
    expect(existsSync(join(root, ".gitignore"))).toBe(false);
  });

  test("preserves existing .gitignore entries without adding codemem state ignores", () => {
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
    expect(gitignore).not.toContain(".codemem/");
  });
});
