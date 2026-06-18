import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { detectAgentInstallations, exportAgentPackage, exportPortableSkillPackage, installAgent } from "../core/src/agent/service";

describe("agent install and export", () => {
  test("installs a Cursor skill into ~/.codex/skills without copying runtime into the project", async () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-agent-cursor-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-cursor-"));
    const previousHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      const result = await installAgent({
        rootDir: root,
        agent: "cursor",
        targetDir,
        lang: "zh",
      });

      expect(result.agent).toBe("cursor");
      expect(existsSync(join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin", "codemem-init"))).toBe(false);
      expect(existsSync(join(targetDir, "skills", "codemem", "templates", "project-standard.zh.template.md"))).toBe(false);
      expect(result.skillDir).toBe(join(homeDir, ".codex", "skills", "codemem"));
      expect(existsSync(join(result.skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(result.skillDir, "meta.json"))).toBe(true);
      expect(existsSync(join(result.skillDir, "runtime", "bin", "codemem-init"))).toBe(true);
      expect(existsSync(join(result.skillDir, "scripts", "codemem.mjs"))).toBe(true);
      expect(existsSync(join(result.skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
      const content = readFileSync(join(result.skillDir, "SKILL.md"), "utf8");
      expect(content).toContain("默认一轮完成规范更新");
      expect(content).toContain("name: codemem");
      expect(content).toContain("JavaScript runtime 和模板");
      expect(content).toContain("将 MQ 或事件消费者分支改造成 topic 工厂");
      expect(content).toContain("不要求用户显式提到 codemem");
      expect(content).toContain("不要把架构或重构产生的规范记录当成代码改完后的可选后续事项");
      expect(content).toContain("~/.codemem/projects/<project_state_key>/docs/global/global-standard.md");
      expect(content).toContain("docs/spec/project-standard.<project_name>.md");
      expect(content).toContain("优先读取已有规范文档");
      expect(content).toContain("默认把请求范围内显然该做的事情一轮做完");
      expect(content).toContain("只有高风险决策才停下来确认");
      expect(content).toContain("不要用“如果你要，我可以继续");
      expect(content).toContain("先做完再最终汇报");
      expect(content).toContain("每个适用清单项至少沉淀 1 条");
      expect(content).toContain("20-40 条规范");
      expect(content).toContain("如果初始化扫描少于 20 条规范");
      expect(content).toContain("整体的目录结构规范");
      expect(content).toContain("类命名规范");
      expect(content).toContain("方法命名规范");
      expect(content).toContain("MapStruct 使用规范");
      expect(content).toContain("分页查询规范");
      expect(content).toContain("模块扩展规范");
      expect(content).toContain("node");
      expect(content).toContain("scripts/codemem.mjs");
      expect(content).toContain("当用户要求更新 codemem skill");
      expect(content).toContain("update --target-dir <project_root>");
    } finally {
      process.env.HOME = previousHome;
    }
  });

  test("installs a Codex skill into an overridden global skill directory", async () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-codex-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-codex-skill-"));

    const result = await installAgent({
      rootDir: root,
      agent: "codex",
      targetDir,
      skillDir,
      lang: "zh",
    });

    expect(result.agent).toBe("codex");
    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillDir, "agents", "openai.yaml"))).toBe(true);
    expect(existsSync(join(skillDir, "runtime", "bin", "codemem-init"))).toBe(true);
    expect(existsSync(join(skillDir, "scripts", "codemem.mjs"))).toBe(true);
    expect(existsSync(join(skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin", "codemem-init"))).toBe(false);
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("name: codemem");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).not.toContain("当用户希望 Cursor");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("架构重构、MQ 消费改造、策略工厂");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("将 MQ 或事件消费者分支改造成 topic 工厂");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("不要求用户显式提到 codemem");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("不要把架构或重构产生的规范记录当成代码改完后的可选后续事项");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("scripts/codemem.mjs");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("update --target-dir <project_root>");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("~/.codemem/projects/<project_state_key>/docs/global/global-standard.md");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("默认连续完成初始化、规范记录、项目扫描和文档生成");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("不要把明显低风险的后续工作包装成");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("固定清单中的每个适用维度");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("缓存使用规范");
    expect(readFileSync(join(skillDir, "agents", "openai.yaml"), "utf8")).toContain("display_name: \"Codemem 开发规范\"");
  });

  test("reinstall removes stale English templates from the shared skill", async () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-stale-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-stale-skill-"));
    mkdirSync(join(skillDir, "templates"), { recursive: true });
    writeFileSync(join(skillDir, "templates", "project-standard.en.template.md"), "old english template");

    await installAgent({
      rootDir: root,
      agent: "codex",
      targetDir,
      skillDir,
      lang: "zh",
    });

    expect(existsSync(join(skillDir, "templates", "project-standard.en.template.md"))).toBe(false);
    expect(existsSync(join(skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
  });

  test("skill runtime update refreshes from a local source checkout", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-skill-update-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-skill-update-target-"));

    try {
      const result = spawnSync("node", [
        join(root, "skills", "codemem", "scripts", "codemem.mjs"),
        "update",
        "--target-dir",
        targetDir,
        "--agent",
        "cursor",
        "--source-dir",
        root,
      ], {
        cwd: targetDir,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: homeDir,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Updated codemem from local source");
      expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
      expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "scripts", "codemem.mjs"))).toBe(true);
      expect(readFileSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"), "utf8")).toContain("update --target-dir <project_root>");
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
      rmSync(targetDir, { recursive: true, force: true });
    }
  }, 30000);

  test("detect treats a skill missing the JavaScript runtime script as not fully configured", () => {
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-stale-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-stale-skill-"));
    mkdirSync(join(skillDir, "runtime", "bin"), { recursive: true });
    mkdirSync(join(skillDir, "templates"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: codemem\n---\n");

    const result = detectAgentInstallations({
      agent: "codex",
      targetDir,
      skillDir,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.configured).toBe(false);
  });

  test("installs a Claude Code slash command into the target project", async () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-claude-"));

    const result = await installAgent({
      rootDir: root,
      agent: "claude-code",
      targetDir,
      lang: "zh",
    });

    expect(result.agent).toBe("claude-code");
    expect(existsSync(join(targetDir, ".claude", "commands", "codemem.md"))).toBe(true);
    expect(readFileSync(result.integrationPath, "utf8")).toContain("/codemem");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("~/.codemem/projects/<project_state_key>/docs/global/global-standard.md");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("默认把请求范围内显然该做的事情一轮做完");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("如果你要，我可以继续");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("普通项目初始化扫描目标是沉淀 20-40 条");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("scripts/codemem.mjs");
    expect(readFileSync(result.integrationPath, "utf8")).toContain("枚举和常量定义规范");
  });

  test("exports a shareable agent package with installer and digest", () => {
    const root = process.cwd();
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-"));

    const result = exportAgentPackage({
      rootDir: root,
      agent: "all",
      targetDir: outputDir,
      version: "1.0.0",
      lang: "zh",
      packageName: "codemem-agent-kit",
    });

    expect(existsSync(result.packageDir)).toBe(true);
    expect(existsSync(join(result.packageDir, "install.mjs"))).toBe(true);
    expect(existsSync(join(result.packageDir, "runtime", "bin", "codemem-build"))).toBe(true);
    expect(existsSync(join(result.packageDir, "runtime", "scripts", "codemem.mjs"))).toBe(true);
    expect(existsSync(join(result.packageDir, "runtime", "templates", "global-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "codex", "SKILL.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "codex", "agents", "openai.yaml"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "SKILL.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "meta.json"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "runtime", "bin", "codemem-init"))).toBe(false);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "templates", "project-standard.zh.template.md"))).toBe(false);
    expect(existsSync(join(result.packageDir, "integrations", "claude-code", "codemem.md"))).toBe(true);
    expect(readFileSync(join(result.packageDir, "integrations", "codex", "SKILL.md"), "utf8")).toContain("__CODEMEM_SKILL_DIR__");
    expect(readFileSync(join(result.packageDir, "integrations", "cursor", "SKILL.md"), "utf8")).toContain("__CODEMEM_SKILL_DIR__");
    expect(existsSync(result.archiveFile)).toBe(true);
    expect(existsSync(result.digestFile)).toBe(true);
  }, 20000);

  test("exported package installer installs a Codex skill with shared runtime", () => {
    const root = process.cwd();
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-install-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-skill-"));

    const exported = exportAgentPackage({
      rootDir: root,
      agent: "codex",
      targetDir: outputDir,
      version: "1.0.1",
      lang: "zh",
      packageName: "codemem-agent-kit",
    });

    const result = spawnSync("node", [
      join(exported.packageDir, "install.mjs"),
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
    ], {
      cwd: exported.packageDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Installed codemem-agent-kit@1.0.1");
    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillDir, "agents", "openai.yaml"))).toBe(true);
    expect(existsSync(join(skillDir, "runtime", "bin", "codemem-build"))).toBe(true);
    expect(existsSync(join(skillDir, "scripts", "codemem.mjs"))).toBe(true);
    expect(existsSync(join(skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
    const skillDoc = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    expect(skillDoc).toContain(join(skillDir, "scripts", "codemem.mjs"));
    expect(skillDoc).not.toContain("__CODEMEM_SKILL_DIR__");
    expect(skillDoc).not.toContain(outputDir);
    expect(existsSync(join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin", "codemem-build"))).toBe(false);
  }, 20000);

  test("exports a portable skill archive that works by direct extraction", () => {
    const root = process.cwd();
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-portable-"));
    const extractHome = mkdtempSync(join(tmpdir(), "codemem-agent-portable-home-"));
    mkdirSync(join(extractHome, ".codex", "skills"), { recursive: true });

    const exported = exportPortableSkillPackage({
      rootDir: root,
      targetDir: outputDir,
      version: "1.2.3",
      lang: "zh",
      packageName: "codemem-skill-portable",
    });

    const extract = spawnSync("tar", [
      "-xzf",
      exported.archiveFile,
      "-C",
      join(extractHome, ".codex", "skills"),
    ], {
      encoding: "utf8",
    });

    expect(extract.status).toBe(0);
    const skillDir = join(extractHome, ".codex", "skills", "codemem");
    expect(existsSync(join(exported.packageDir, "install.mjs"))).toBe(false);
    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(skillDir, "scripts", "codemem.mjs"))).toBe(true);
    expect(existsSync(join(skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(skillDir, "runtime", "bin", "codemem-build"))).toBe(true);
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("$HOME/.codex/skills/codemem/scripts/codemem.mjs");
    expect(readFileSync(join(skillDir, "README-portable.txt"), "utf8")).toContain("不需要执行 install.mjs");
  }, 20000);

  test("exported package installer writes Cursor skill into ~/.codex/skills", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-cursor-home-"));
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-cursor-install-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-cursor-target-"));

    const exported = exportAgentPackage({
      rootDir: root,
      agent: "cursor",
      targetDir: outputDir,
      version: "1.0.2",
      lang: "zh",
      packageName: "codemem-agent-kit",
    });

    const result = spawnSync("node", [
      join(exported.packageDir, "install.mjs"),
      "--agent",
      "cursor",
      "--target-dir",
      targetDir,
    ], {
      cwd: exported.packageDir,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "meta.json"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "scripts", "codemem.mjs"))).toBe(true);
    const skillDoc = readFileSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"), "utf8");
    expect(skillDoc).toContain(join(homeDir, ".codex", "skills", "codemem", "scripts", "codemem.mjs"));
    expect(skillDoc).not.toContain("__CODEMEM_SKILL_DIR__");
    expect(skillDoc).not.toContain(outputDir);
  }, 20000);

  test("exported package installer writes Claude command pointing at shared skill scripts", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-claude-home-"));
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-claude-install-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-claude-target-"));

    const exported = exportAgentPackage({
      rootDir: root,
      agent: "claude-code",
      targetDir: outputDir,
      version: "1.0.3",
      lang: "zh",
      packageName: "codemem-agent-kit",
    });

    const result = spawnSync("node", [
      join(exported.packageDir, "install.mjs"),
      "--agent",
      "claude-code",
      "--target-dir",
      targetDir,
    ], {
      cwd: exported.packageDir,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });

    const commandFile = join(targetDir, ".claude", "commands", "codemem.md");
    const sharedSkillDir = join(homeDir, ".codex", "skills", "codemem");
    expect(result.status).toBe(0);
    expect(existsSync(commandFile)).toBe(true);
    expect(existsSync(join(sharedSkillDir, "scripts", "codemem.mjs"))).toBe(true);
    const commandDoc = readFileSync(commandFile, "utf8");
    expect(commandDoc).toContain(join(sharedSkillDir, "scripts", "codemem.mjs"));
    expect(commandDoc).not.toContain("__CODEMEM_");
    expect(commandDoc).not.toContain(outputDir);
  }, 20000);

  test("cli agent command handles --root before the subcommand", () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-cli-root-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-cli-skill-"));

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
      "--lang",
      "zh",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Installed codemem agent integration");
    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
  });

  test("cli agent detect reports configured integrations", () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-skill-"));

    const install = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
      "--lang",
      "zh",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(install.status).toBe(0);

    const detect = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "detect",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(detect.status).toBe(0);
    expect(detect.stdout).toContain("codex");
    expect(detect.stdout).toContain("configured");
    expect(detect.stdout).toContain(skillDir);
    expect(detect.stdout).toContain("reason:");
  });

  test("cli agent install supports json output", () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-install-json-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-install-json-skill-"));

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
      "--lang",
      "zh",
      "--json",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      agent: string;
      integrationPath: string;
      runtimeBinDir: string;
    };
    expect(payload.agent).toBe("codex");
    expect(payload.integrationPath).toContain("SKILL.md");
    expect(payload.runtimeBinDir).toContain("runtime/bin");
  });

  test("cli agent install writes Cursor skill into ~/.codex/skills", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-agent-cli-cursor-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-cursor-detect-target-"));

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "cursor",
      "--target-dir",
      targetDir,
      "--lang",
      "zh",
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
  });

  test("cli agent detect supports json output", () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-json-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-agent-detect-json-skill-"));

    const install = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
      "--lang",
      "zh",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(install.status).toBe(0);

    const detect = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "detect",
      "--agent",
      "codex",
      "--target-dir",
      targetDir,
      "--skill-dir",
      skillDir,
      "--json",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(detect.status).toBe(0);
    const payload = JSON.parse(detect.stdout) as Array<{
      agent: string;
      configured: boolean;
      skillDir: string;
      selectionReason: string;
    }>;
    expect(payload[0]?.agent).toBe("codex");
    expect(payload[0]?.configured).toBe(true);
    expect(payload[0]?.skillDir).toBe(skillDir);
    expect(payload[0]?.selectionReason).toBe("explicit_override");
  });

  test("cli agent detect auto-detects an existing user-level Claude Code commands directory", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-agent-claude-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-agent-claude-detect-target-"));
    const userCommandsDir = join(homeDir, ".claude", "commands");

    mkdirSync(userCommandsDir, { recursive: true });

    const install = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "install",
      "--agent",
      "claude-code",
      "--target-dir",
      targetDir,
      "--lang",
      "zh",
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });

    expect(install.status).toBe(0);

    const detect = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "detect",
      "--agent",
      "claude-code",
      "--target-dir",
      targetDir,
      "--json",
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
      },
    });

    expect(detect.status).toBe(0);
    const payload = JSON.parse(detect.stdout) as Array<{
      agent: string;
      configured: boolean;
      skillDir: string;
      integrationPath: string;
      selectionReason: string;
    }>;
    expect(payload[0]?.agent).toBe("claude-code");
    expect(payload[0]?.configured).toBe(true);
    expect(payload[0]?.skillDir).toBe(userCommandsDir);
    expect(payload[0]?.integrationPath).toBe(join(userCommandsDir, "codemem.md"));
    expect(payload[0]?.selectionReason).toBe("detected_existing_home");
  });

  test("cli agent export supports json output", () => {
    const root = process.cwd();
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-export-json-"));

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "export",
      "--agent",
      "codex",
      "--target-dir",
      outputDir,
      "--version",
      "1.0.2",
      "--lang",
      "zh",
      "--json",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      agent: string;
      packageDir: string;
      archiveFile: string;
      digestFile: string;
    };
    expect(payload.agent).toBe("codex");
    expect(payload.packageDir).toContain("codemem-agent-kit-1.0.2");
    expect(payload.archiveFile).toContain(".tgz");
    expect(payload.digestFile).toContain(".sha256");
  }, 20000);

  test("cli agent portable exports direct-extract skill archive", () => {
    const root = process.cwd();
    const outputDir = mkdtempSync(join(tmpdir(), "codemem-agent-portable-json-"));

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/agent.ts",
      "--root",
      root,
      "portable",
      "--target-dir",
      outputDir,
      "--version",
      "1.0.3",
      "--lang",
      "zh",
      "--json",
    ], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      packageDir: string;
      skillDir: string;
      archiveFile: string;
      digestFile: string;
    };
    expect(payload.packageDir).toContain("codemem-skill-portable-1.0.3");
    expect(payload.skillDir).toContain(join("codemem-skill-portable-1.0.3", "codemem"));
    expect(payload.archiveFile).toContain("codemem-skill-portable-1.0.3.tgz");
    expect(existsSync(payload.archiveFile)).toBe(true);
    expect(existsSync(payload.digestFile)).toBe(true);
  }, 20000);
});
