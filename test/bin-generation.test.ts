import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
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
    expect(readFileSync(dispatcher, "utf8")).toContain("resolve_project_root");
    expect(readFileSync(dispatcher, "utf8")).toContain("run_project_command");

    const installerCheck = spawnSync("bash", ["-n", installer], {
      cwd: root,
      encoding: "utf8",
    });
    expect(installerCheck.status).toBe(0);
  });

  test("runs project commands against the current working directory", () => {
    const root = process.cwd();
    const dispatcher = join(root, "bin", "codemem");
    const projectDir = mkdtempSync(join(tmpdir(), "codemem-dispatch-project-"));
    const globalDir = mkdtempSync(join(tmpdir(), "codemem-dispatch-global-"));

    try {
      const result = spawnSync(dispatcher, [
        "init",
        "--project",
        "dispatch-project",
        "--owner",
        "cm",
      ], {
        cwd: projectDir,
        encoding: "utf8",
        env: {
          ...process.env,
          CODEMEM_GLOBAL_DIR: globalDir,
        },
      });

      expect(result.status).toBe(0);
      expect(existsSync(join(projectDir, ".codemem", "_system", "meta", "standards", "dispatch-project.env"))).toBe(true);
      expect(existsSync(join(projectDir, ".codemem-project.json"))).toBe(true);
      expect(result.stdout).toContain("Project marker:");
      expect(result.stdout).toContain(basename(projectDir));
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(globalDir, { recursive: true, force: true });
    }
  });

  test("keeps non-project commands runnable when the current working directory is gone", () => {
    const root = process.cwd();
    const dispatcher = join(root, "bin", "codemem");
    const script = [
      "set -euo pipefail",
      'tmp="$(mktemp -d)"',
      'mkdir -p "$tmp/gone"',
      'cd "$tmp/gone"',
      'rm -rf "$tmp"',
      `"${dispatcher}" uninstall --dry-run true --target-dir "$HOME"`,
    ].join("\n");

    const result = spawnSync("bash", ["-lc", script], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("codemem uninstall dry run");
  });
});
