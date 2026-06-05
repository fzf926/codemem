import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

const root = process.cwd();
const binDir = join(root, "bin");

function renderWrapper(binName: string, cliSource: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT"
if [ -x "$ROOT/core/dist/${binName}" ]; then
  "$ROOT/core/dist/${binName}" "$@" --root "$ROOT"
else
  bun run ${cliSource} "$@" --root "$ROOT"
fi
`;
}

mkdirSync(binDir, { recursive: true });

for (const spec of commandSpecs) {
  writeFileSync(join(binDir, spec.binName), renderWrapper(spec.binName, getCliSource(spec.id)));
}

console.log(`Generated ${commandSpecs.length} bin wrapper(s)`);
