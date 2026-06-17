import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const runtimeScript = join(process.cwd(), "skills", "codemem", "scripts", "codemem.mjs");

function runRuntime(args: string[], rootDir: string) {
  return spawnSync("node", [runtimeScript, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEMEM_GLOBAL_DIR: join(rootDir, ".global-codemem"),
    },
  });
}

describe("skill project runtime", () => {
  test("ships a checked-in Node runtime script under the skill", () => {
    expect(existsSync(runtimeScript)).toBe(true);
  });

  test("initializes, captures, and builds standards without global codemem binaries", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "codemem-skill-runtime-"));

    try {
      const init = runRuntime([
        "init",
        "--root",
        rootDir,
        "--project",
        "runtime-project",
        "--owner",
        "cm",
        "--project-path",
        rootDir,
      ], rootDir);

      expect(init.status).toBe(0);
      expect(init.stdout).toContain("Initialized project 'runtime-project'");
      expect(existsSync(join(rootDir, ".codemem-project.json"))).toBe(true);
      expect(existsSync(join(rootDir, ".codemem", "_system", "logs", "standards", "runtime-project.jsonl"))).toBe(true);
      expect(readFileSync(join(rootDir, "AGENTS.md"), "utf8")).toContain("Codemem Standards");

      const capture = runRuntime([
        "capture",
        "--root",
        rootDir,
        "--project",
        "runtime-project",
        "--type",
        "architecture",
        "--title",
        "MQ 消费策略分发",
        "--rule",
        "MQ 消费者应按 topic 构建策略工厂，并按 tag 路由到对应策略。",
        "--priority",
        "P1",
        "--status",
        "active",
        "--scope",
        "project",
        "--source",
        "test",
        "--lang",
        "zh",
      ], rootDir);

      expect(capture.status).toBe(0);
      expect(capture.stdout).toContain("Captured standard for 'runtime-project': MQ 消费策略分发");
      const log = readFileSync(join(rootDir, ".codemem", "_system", "logs", "standards", "runtime-project.jsonl"), "utf8");
      expect(log).toContain("MQ 消费策略分发");

      const build = runRuntime([
        "build",
        "--root",
        rootDir,
        "--project",
        "runtime-project",
        "--lang",
        "zh",
      ], rootDir);

      expect(build.status).toBe(0);
      expect(build.stdout).toContain("Generated:");
      const projectDoc = readFileSync(join(rootDir, ".codemem", "docs", "projects", "project-standard.runtime-project.md"), "utf8");
      const globalDoc = readFileSync(join(rootDir, ".codemem", "docs", "global", "global-standard.md"), "utf8");
      const conflictsDoc = readFileSync(join(rootDir, ".codemem", "docs", "reports", "standards-conflicts.md"), "utf8");
      expect(projectDoc).toContain("MQ 消费策略分发");
      expect(projectDoc).toContain("按 topic 构建策略工厂");
      expect(globalDoc).toContain("runtime-project");
      expect(conflictsDoc).toContain("# 规范冲突报告");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("writes the project standard to a configured relative path and filename", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "codemem-skill-runtime-doc-path-"));

    try {
      const init = runRuntime([
        "init",
        "--root",
        rootDir,
        "--project",
        "runtime-doc-path",
        "--owner",
        "cm",
        "--project-path",
        rootDir,
        "--project-doc-path",
        "docs/engineering/codemem-project.md",
      ], rootDir);

      expect(init.status).toBe(0);
      expect(readFileSync(join(rootDir, ".codemem-project.json"), "utf8")).toContain("\"projectDocPath\": \"docs/engineering/codemem-project.md\"");
      expect(readFileSync(join(rootDir, "AGENTS.md"), "utf8")).toContain("docs/engineering/codemem-project.md");
      expect(readFileSync(join(rootDir, ".cursor", "rules", "codemem-standards.mdc"), "utf8")).toContain("docs/engineering/codemem-project.md");

      const capture = runRuntime([
        "capture",
        "--root",
        rootDir,
        "--project",
        "runtime-doc-path",
        "--type",
        "architecture",
        "--title",
        "自定义输出路径",
        "--rule",
        "项目规范文档输出路径由 projectDocPath 控制。",
        "--priority",
        "P1",
        "--status",
        "active",
        "--scope",
        "project",
        "--source",
        "test",
        "--lang",
        "zh",
      ], rootDir);

      expect(capture.status).toBe(0);

      const build = runRuntime([
        "build",
        "--root",
        rootDir,
        "--project",
        "runtime-doc-path",
        "--lang",
        "zh",
      ], rootDir);

      expect(build.status).toBe(0);
      const projectDoc = readFileSync(join(rootDir, "docs", "engineering", "codemem-project.md"), "utf8");
      expect(projectDoc).toContain("自定义输出路径");
      expect(existsSync(join(rootDir, ".codemem", "docs", "projects", "project-standard.runtime-doc-path.md"))).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
