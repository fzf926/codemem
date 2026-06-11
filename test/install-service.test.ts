import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncManagedInstall } from "../core/src/install/service";

function makeRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe("install service", () => {
  test("syncManagedInstall preserves the managed root directory while replacing its contents", () => {
    const root = makeRoot("codemem-install-service-");
    const sourceDir = join(root, "source-repo");
    const installDir = join(root, "managed-source");

    try {
      mkdirSync(join(sourceDir, "bin"), { recursive: true });
      mkdirSync(join(sourceDir, "docs"), { recursive: true });
      mkdirSync(join(installDir, ".git"), { recursive: true });
      mkdirSync(join(installDir, "stale-dir"), { recursive: true });

      writeFileSync(join(sourceDir, "bin", "codemem"), "#!/usr/bin/env bash\n");
      writeFileSync(join(sourceDir, "README.md"), "fresh readme\n");
      writeFileSync(join(sourceDir, "docs", "guide.md"), "fresh docs\n");

      writeFileSync(join(installDir, "stale.txt"), "old content\n");
      writeFileSync(join(installDir, "stale-dir", "nested.txt"), "old nested content\n");
      writeFileSync(join(installDir, ".git", "HEAD"), "ref: refs/heads/main\n");

      syncManagedInstall(sourceDir, installDir);

      expect(existsSync(installDir)).toBe(true);
      expect(existsSync(join(installDir, ".git"))).toBe(true);
      expect(readFileSync(join(installDir, ".git", "HEAD"), "utf8")).toContain("refs/heads/main");
      expect(existsSync(join(installDir, "bin", "codemem"))).toBe(true);
      expect(readFileSync(join(installDir, "README.md"), "utf8")).toBe("fresh readme\n");
      expect(readFileSync(join(installDir, "docs", "guide.md"), "utf8")).toBe("fresh docs\n");
      expect(existsSync(join(installDir, "stale.txt"))).toBe(false);
      expect(existsSync(join(installDir, "stale-dir"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
