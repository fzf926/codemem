import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commandSpecs } from "../core/src/cli/command-registry";
import { installAgent } from "../core/src/agent/service";

describe("upgrade command", () => {
  test("registers codemem-upgrade in the command registry", () => {
    const spec = commandSpecs.find((item) => item.id === "upgrade");
    expect(spec?.binName).toBe("codemem-upgrade");
    expect(spec?.devScript).toBe("dev:upgrade");
  });

  test("rebuilds artifacts and reinstalls the selected agent integration", () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-upgrade-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-upgrade-target-"));
    const installDir = join(homeDir, ".codemem", "source");

    const result = spawnSync("bun", [
      "run",
      "core/src/cli/upgrade.ts",
      "--root",
      root,
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
    expect(result.stdout).toContain("Updated codemem global resources");
    expect(result.stdout).toContain("Agent: cursor");
    expect(result.stdout).toContain(`Source: ${installDir}`);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "runtime", "bin", "codemem-init"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "templates", "project-standard.zh.template.md"))).toBe(true);
    expect(existsSync(join(installDir, "package.json"))).toBe(true);
    expect(readFileSync(join(homeDir, ".local", "bin", "codemem"), "utf8")).toContain(`${installDir}/bin/codemem`);
    expect(readFileSync(join(homeDir, ".codemem", "_system", "install.json"), "utf8")).toContain(`"managedInstallDir": "${installDir}"`);
    expect(readFileSync(join(homeDir, ".codemem", "_system", "install.json"), "utf8")).toContain(`"activeSourceDir": "${installDir}"`);
  }, 30000);

  test("auto-detects cursor when agent is omitted and target-dir defaults to cwd", async () => {
    const root = process.cwd();
    const homeDir = mkdtempSync(join(tmpdir(), "codemem-upgrade-detect-home-"));
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-upgrade-detect-target-"));
    const previousHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      await installAgent({
        rootDir: root,
        agent: "cursor",
        targetDir,
        lang: "zh",
      });

      const result = spawnSync("bun", [
        "run",
        join(root, "core/src/cli/upgrade.ts"),
        "--root",
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
      expect(result.stdout).toContain("Agent: cursor");
      expect(result.stdout).toContain(`Project target: ${realpathSync.native(targetDir)}`);
    } finally {
      process.env.HOME = previousHome;
    }
  }, 30000);
});
