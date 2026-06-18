import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listProjects, upsertProject } from "../core/src/registry/service";
import { getProjectMarkerFile } from "../core/src/shared/paths";

describe("registry", () => {
  test("keeps projects with the same name but different paths separate", () => {
    const root = mkdtempSync(join(tmpdir(), "codemem-registry-"));
    const previousGlobalDir = process.env.CODEMEM_GLOBAL_DIR;
    process.env.CODEMEM_GLOBAL_DIR = join(root, ".global-codemem");

    try {
      upsertProject(root, {
        project: "demo",
        owner: "cm",
        mode: "local",
        projectPath: "/tmp/demo-a",
        packageId: "",
        packageVersion: "",
        packageFile: "",
        sourceProject: "",
        configuredAt: "2026-05-27T00:00:00Z",
      });
      upsertProject(root, {
        project: "demo",
        owner: "cm",
        mode: "installed",
        projectPath: "/tmp/demo-b",
        packageId: "shared-standard-demo",
        packageVersion: "1.0.0",
        packageFile: "/tmp/shared-standard-demo-1.0.0.tgz",
        sourceProject: "demo",
        configuredAt: "2026-05-27T00:00:01Z",
      });

      const registry = listProjects(root);
      expect(registry.projects.length).toBe(2);
      expect(existsSync(join(root, ".global-codemem", "_system", "registry", "projects-registry.json"))).toBe(true);
      expect(existsSync(join(root, ".codemem-project.json"))).toBe(false);
      expect(readFileSync(getProjectMarkerFile(root), "utf8")).toContain("\"tool\": \"codemem\"");
    } finally {
      if (previousGlobalDir === undefined) {
        delete process.env.CODEMEM_GLOBAL_DIR;
      } else {
        process.env.CODEMEM_GLOBAL_DIR = previousGlobalDir;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
});
