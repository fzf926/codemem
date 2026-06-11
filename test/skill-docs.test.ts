import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("generated skill docs", () => {
  test("include rendered command section", () => {
    const root = process.cwd();
    const skillDoc = readFileSync(join(root, "skills", "codemem", "SKILL.md"), "utf8");
    expect(skillDoc).toContain("codemem init");
    expect(skillDoc).toContain("codemem package");
    expect(skillDoc).toContain("core/src/packaging/");
    expect(skillDoc).toContain("Argument reference");
    expect(skillDoc).toContain("`codemem capture`");
    expect(skillDoc).toContain("`--scope`");
    expect(skillDoc).toContain("Install policy");
    expect(skillDoc).toContain("reinstalled");
    expect(skillDoc).toContain("do not wait for an explicit codemem request");
    expect(skillDoc).toContain("MQ/event");
    expect(skillDoc).toContain("build/deploy structure cleanup");
  });
});
