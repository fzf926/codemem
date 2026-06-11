import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

describe("generated bin wrappers", () => {
  test("mirror the command registry", () => {
    const root = process.cwd();

    for (const spec of commandSpecs) {
      const wrapper = readFileSync(join(root, "bin", spec.binName), "utf8");
      expect(wrapper).toContain("#!/usr/bin/env bash");
      expect(wrapper).toContain(`core/dist/${spec.binName}`);
      expect(wrapper).toContain(`bun run ${getCliSource(spec.id)} "$@" --root "$ROOT"`);
    }
  });

  test("includes the global codemem dispatcher and install script", () => {
    const root = process.cwd();
    const dispatcher = join(root, "bin", "codemem");
    const installer = join(root, "scripts", "install.sh");

    expect(existsSync(dispatcher)).toBe(true);
    expect(existsSync(installer)).toBe(true);
    expect(readFileSync(dispatcher, "utf8")).toContain("codemem <command> [args]");
    expect(readFileSync(installer, "utf8")).toContain("CODEMEM_REPO_URL");

    const dispatcherHelp = spawnSync(dispatcher, ["--help"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(dispatcherHelp.status).toBe(0);
    expect(dispatcherHelp.stdout).toContain("codemem upgrade");
    expect(dispatcherHelp.stdout).toContain("codemem uninstall --dry-run true");

    const installerCheck = spawnSync("bash", ["-n", installer], {
      cwd: root,
      encoding: "utf8",
    });
    expect(installerCheck.status).toBe(0);
  });
});
