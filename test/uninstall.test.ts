import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uninstallCodemem } from "../core/src/uninstall/service";

function makeRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function seedInstall(root: string) {
  const homeDir = join(root, "home");
  const installDir = join(homeDir, ".codemem", "source");
  const binDir = join(homeDir, ".local", "bin");
  const targetDir = join(root, "project");
  const profileFile = join(homeDir, ".zshrc");

  mkdirSync(join(installDir, "bin"), { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(join(homeDir, ".codex", "skills", "codemem"), { recursive: true });
  mkdirSync(join(homeDir, ".claude", "commands"), { recursive: true });
  mkdirSync(join(targetDir, ".codemem", "docs"), { recursive: true });
  mkdirSync(join(targetDir, ".cursor", "rules"), { recursive: true });
  mkdirSync(join(homeDir, ".codemem", "_system", "registry"), { recursive: true });

  writeFileSync(join(installDir, "bin", "codemem"), "#!/usr/bin/env bash\n");
  writeFileSync(join(binDir, "codemem"), `#!/usr/bin/env bash\nexec "${installDir}/bin/codemem" "$@"\n`);
  writeFileSync(join(homeDir, ".codex", "skills", "codemem", "SKILL.md"), "codemem skill\n");
  writeFileSync(join(homeDir, ".claude", "commands", "codemem.md"), "codemem command\n");
  writeFileSync(join(targetDir, ".codemem", "docs", "standard.md"), "standard\n");
  writeFileSync(join(targetDir, ".cursor", "rules", "codemem-standards.mdc"), "codemem cursor rule\n");
  writeFileSync(join(targetDir, ".codemem-project.json"), "{\n  \"tool\": \"codemem\"\n}\n");
  writeFileSync(join(targetDir, ".gitignore"), "node_modules\n.codemem/\ndist\n");
  writeFileSync(join(homeDir, ".codemem", "_system", "registry", "projects-registry.json"), JSON.stringify({
    schema: 1,
    updatedAt: "2026-06-12T00:00:00Z",
    projects: [
      {
        project: "demo",
        owner: "cm",
        mode: "local",
        projectPath: targetDir,
        packageId: "",
        packageVersion: "",
        packageFile: "",
        sourceProject: "",
        configuredAt: "2026-06-12T00:00:00Z",
        lastUpdatedAt: "2026-06-12T00:00:00Z",
        status: "configured",
      },
    ],
  }, null, 2) + "\n");
  writeFileSync(join(targetDir, "AGENTS.md"), [
    "# AGENTS.md",
    "",
    "Project-specific human note.",
    "",
    "<!-- codemem:managed:start -->",
    "## Codemem Standards",
    "Read .codemem docs.",
    "<!-- codemem:managed:end -->",
    "",
  ].join("\n"));
  writeFileSync(profileFile, `export PATH="/usr/local/bin:$PATH"\n\n# codemem global command\nexport PATH="${binDir}:$PATH"\n`);

  return { homeDir, installDir, binDir, targetDir, profileFile };
}

describe("uninstallCodemem", () => {
  test("removes global install resources but keeps project data by default", () => {
    const root = makeRoot("codemem-uninstall-");
    try {
      const paths = seedInstall(root);

      const result = uninstallCodemem(paths);

      expect(existsSync(join(paths.binDir, "codemem"))).toBe(false);
      expect(existsSync(join(paths.homeDir, ".codex", "skills", "codemem"))).toBe(false);
      expect(existsSync(join(paths.homeDir, ".claude", "commands", "codemem.md"))).toBe(false);
      expect(existsSync(paths.installDir)).toBe(false);
      expect(existsSync(join(paths.targetDir, ".codemem"))).toBe(true);
      expect(existsSync(join(paths.targetDir, ".cursor", "rules", "codemem-standards.mdc"))).toBe(true);
      expect(existsSync(join(paths.targetDir, ".codemem-project.json"))).toBe(true);
      expect(readFileSync(join(paths.targetDir, "AGENTS.md"), "utf8")).toContain("codemem:managed:start");
      expect(readFileSync(join(paths.targetDir, ".gitignore"), "utf8")).toContain(".codemem/");
      expect(result.kept).toContain(join(paths.targetDir, ".codemem"));
      expect(readFileSync(paths.profileFile, "utf8")).not.toContain("# codemem global command");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("deletes generated project standards and project-side references only when explicitly requested", () => {
    const root = makeRoot("codemem-uninstall-project-");
    try {
      const paths = seedInstall(root);

      uninstallCodemem({ ...paths, deleteProjectData: true });

      expect(existsSync(join(paths.targetDir, ".codemem"))).toBe(false);
      expect(existsSync(join(paths.targetDir, ".cursor", "rules", "codemem-standards.mdc"))).toBe(false);
      expect(existsSync(join(paths.targetDir, ".codemem-project.json"))).toBe(false);
      expect(readFileSync(join(paths.homeDir, ".codemem", "_system", "registry", "projects-registry.json"), "utf8")).not.toContain(paths.targetDir);
      expect(readFileSync(join(paths.targetDir, "AGENTS.md"), "utf8")).toContain("Project-specific human note.");
      expect(readFileSync(join(paths.targetDir, "AGENTS.md"), "utf8")).not.toContain("codemem:managed:start");
      expect(readFileSync(join(paths.targetDir, ".gitignore"), "utf8")).toBe("node_modules\ndist\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("dry run reports removals without deleting files", () => {
    const root = makeRoot("codemem-uninstall-dry-run-");
    try {
      const paths = seedInstall(root);

      const result = uninstallCodemem({ ...paths, deleteProjectData: true, dryRun: true });

      expect(result.removed.length).toBeGreaterThan(0);
      expect(existsSync(join(paths.binDir, "codemem"))).toBe(true);
      expect(existsSync(join(paths.homeDir, ".codex", "skills", "codemem"))).toBe(true);
      expect(existsSync(paths.installDir)).toBe(true);
      expect(existsSync(join(paths.targetDir, ".codemem"))).toBe(true);
      expect(existsSync(join(paths.targetDir, ".cursor", "rules", "codemem-standards.mdc"))).toBe(true);
      expect(existsSync(join(paths.targetDir, ".codemem-project.json"))).toBe(true);
      expect(readFileSync(join(paths.homeDir, ".codemem", "_system", "registry", "projects-registry.json"), "utf8")).toContain(paths.targetDir);
      expect(readFileSync(join(paths.targetDir, "AGENTS.md"), "utf8")).toContain("codemem:managed:start");
      expect(readFileSync(join(paths.targetDir, ".gitignore"), "utf8")).toContain(".codemem/");
      expect(readFileSync(paths.profileFile, "utf8")).toContain("# codemem global command");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
