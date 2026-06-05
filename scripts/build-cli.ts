import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

const root = process.cwd();
const distDir = join(root, "core", "dist");

mkdirSync(distDir, { recursive: true });

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
