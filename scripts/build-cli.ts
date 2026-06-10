import { chmodSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

const root = process.cwd();
const distDir = join(root, "core", "dist");

function cleanBunBuildArtifacts(): number {
  let removed = 0;

  for (const entry of readdirSync(root)) {
    if (!entry.endsWith(".bun-build")) {
      continue;
    }

    rmSync(join(root, entry), { force: true, recursive: true });
    removed += 1;
  }

  return removed;
}

mkdirSync(distDir, { recursive: true });

const staleArtifacts = cleanBunBuildArtifacts();

try {
  for (const spec of commandSpecs) {
    const outfile = join(distDir, spec.binName);
    const result = spawnSync(
      "bun",
      ["build", "--compile", getCliSource(spec.id), "--outfile", outfile],
      {
        cwd: root,
        stdio: "inherit",
      },
    );

    if (result.status !== 0) {
      throw new Error(`Failed to compile ${spec.binName}`);
    }

    chmodSync(outfile, 0o755);
  }

  console.log(`Compiled ${commandSpecs.length} CLI binary(ies)`);
} finally {
  const newArtifacts = cleanBunBuildArtifacts();
  const cleanedArtifacts = staleArtifacts + newArtifacts;

  if (cleanedArtifacts > 0) {
    console.log(`Cleaned ${cleanedArtifacts} Bun build artifact(s)`);
  }
}
