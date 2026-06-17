import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

describe("remote install script", () => {
  test("installs from a temporary clone when run outside the codemem checkout", () => {
    const root = process.cwd();
    const targetDir = mkdtempSync(join(tmpdir(), "codemem-remote-install-target-"));
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-remote-install-skill-"));

    try {
      const result = spawnSync("bash", [
        join(root, "scripts", "install.sh"),
        "--repo-url",
        `file://${root}`,
        "--agent",
        "cursor",
      ], {
        cwd: targetDir,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: skillDir,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Cloning codemem into");
      expect(result.stdout).toContain("codemem agent integration installed successfully");
      expect(existsSync(join(skillDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
      expect(existsSync(join(skillDir, ".codex", "skills", "codemem", "scripts", "codemem.mjs"))).toBe(true);
      expect(existsSync(join(targetDir, "scripts", "build.sh"))).toBe(false);
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
      rmSync(skillDir, { recursive: true, force: true });
    }
  }, 30000);
});
