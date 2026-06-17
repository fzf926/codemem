import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

function runCli(entry: string, args: string[]) {
  return spawnSync("bun", ["run", entry, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("cli runtime", () => {
  test("prints generated help from the command registry", () => {
    const result = runCli("core/src/cli/init.ts", ["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("codemem-init");
    expect(result.stdout).toContain("Arguments:");
    expect(result.stdout).toContain("`--project`");
    expect(result.stdout).toContain("initialize a project and register it");
  });

  test("rejects values that are outside the registry enum", () => {
    const result = runCli("core/src/cli/capture.ts", [
      "--project",
      "codemem",
      "--type",
      "invalid",
      "--title",
      "bad type",
      "--rule",
      "bad type should fail",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid value for --type");
    expect(result.stderr).toContain("general");
    expect(result.stderr).toContain("release");
  });

  test("rejects English document generation", () => {
    const result = runCli("core/src/cli/build.ts", [
      "--project",
      "codemem",
      "--lang",
      "en",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid value for --lang");
    expect(result.stderr).toContain("zh");
  });
});
