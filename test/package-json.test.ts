import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

describe("package.json scripts", () => {
  test("mirror generated dev scripts from the command registry", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    for (const spec of commandSpecs) {
      expect(packageJson.scripts[spec.devScript]).toBe(`bun run ${getCliSource(spec.id)}`);
    }
  });

  test("include package.json generator wiring", () => {
    const root = process.cwd();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const buildScript = readFileSync(join(root, "scripts", "build.sh"), "utf8");

    expect(packageJson.scripts["gen:package-json"]).toBe("bun run scripts/gen-package-json.ts");
    expect(buildScript).toContain("bun run gen:package-json");
  });
});
