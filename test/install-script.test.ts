import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
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

  test("falls back when the invoking shell is in a deleted directory", () => {
    const root = process.cwd();
    const shellRoot = mkdtempSync(join(tmpdir(), "codemem-deleted-cwd-"));
    const missingDir = join(shellRoot, "missing");
    const skillDir = mkdtempSync(join(tmpdir(), "codemem-deleted-cwd-skill-"));
    mkdirSync(missingDir);

    try {
      const result = spawnSync("bash", [
        "-lc",
        [
          `cd "${missingDir}"`,
          `rmdir "${missingDir}"`,
          `bash "${join(root, "scripts", "install.sh")}" --repo-url "file://${root}" --agent codex`,
        ].join(" && "),
      ], {
        cwd: shellRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: skillDir,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toContain("current directory is unavailable");
      expect(result.stdout).toContain("Cloning codemem into");
      expect(result.stdout).toContain("codemem agent integration installed successfully");
      expect(existsSync(join(skillDir, ".codex", "skills", "codemem", "SKILL.md"))).toBe(true);
    } finally {
      rmSync(shellRoot, { recursive: true, force: true });
      rmSync(skillDir, { recursive: true, force: true });
    }
  }, 30000);
});
