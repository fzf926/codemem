import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commandSpecs } from "../core/src/cli/command-registry";

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
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "runtime", "bin", "codemem-init"))).toBe(true);
    expect(existsSync(join(homeDir, ".codex", "skills", "codemem", "templates", "project-standard.zh.template.md"))).toBe(true);
  }, 30000);
});
