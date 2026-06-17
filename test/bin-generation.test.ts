import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("project-local command layout", () => {
  test("does not ship generated bin wrappers or global command generation", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    const buildScript = readFileSync(join(root, "scripts", "build.sh"), "utf8");

    expect(existsSync(join(root, "bin"))).toBe(false);
    expect(existsSync(join(root, "scripts", "gen-bin.ts"))).toBe(false);
    expect(packageJson.scripts).not.toHaveProperty("gen:bin");
    expect(buildScript).not.toContain("gen:bin");
    expect(buildScript).not.toContain("bin/*");
  });
});
