import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { exportAgentPackage, installAgent } from "../core/src/agent/service";

describe("agent install and export", () => {
  test("installs a Cursor skill into ~/.codex/skills and project runtime", async () => {
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
      expect(existsSync(join(targetDir, ".codemem", "agent-runtime", "bin", "codemem-init"))).toBe(false);
      expect(existsSync(join(targetDir, "skills", "dev-standards", "templates", "project-standard.zh.template.md"))).toBe(false);
      expect(result.skillDir).toBe(join(homeDir, ".codex", "skills", "codemem"));
      expect(existsSync(join(result.skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(result.skillDir, "meta.json"))).toBe(true);
      expect(existsSync(join(result.skillDir, "runtime", "bin", "codemem-init"))).toBe(true);
      expect(existsSync(join(result.skillDir, "templates", "project-standard.zh.template.md"))).toBe(true);
      const content = readFileSync(join(result.skillDir, "SKILL.md"), "utf8");
      expect(content).toContain("重新生成规范文档");
      expect(content).toContain("name: codemem");
      expect(content).toContain("自带 runtime 和模板");
    } finally {
      process.env.HOME = previousHome;
    }
  });

  test("installs a Codex skill into an overridden skill directory", async () => {
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
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain("name: codemem");
    expect(readFileSync(join(skillDir, "SKILL.md"), "utf8")).toContain(".codemem/_system/runtime/agent-runtime/bin");
    expect(readFileSync(join(skillDir, "agents", "openai.yaml"), "utf8")).toContain("display_name: \"Codemem Standards\"");
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
    expect(existsSync(join(result.packageDir, "runtime", "templates", "global-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "codex", "SKILL.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "codex", "agents", "openai.yaml"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "SKILL.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "meta.json"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "runtime", "bin", "codemem-init"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "cursor", "templates", "project-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(result.packageDir, "integrations", "claude-code", "codemem.md"))).toBe(true);
    expect(existsSync(result.archiveFile)).toBe(true);
    expect(existsSync(result.digestFile)).toBe(true);
  }, 20000);

  test("exported package installer installs a Codex skill and runtime", () => {
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
    expect(existsSync(join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin", "codemem-build"))).toBe(true);
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
    expect(payload.runtimeBinDir).toContain(".codemem/_system/runtime/agent-runtime/bin");
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
});
