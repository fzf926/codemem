import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commandSpecs, getCliSource } from "../core/src/cli/command-registry";

const root = process.cwd();
const packageJsonFile = join(root, "package.json");

const staticScripts: Record<string, string> = {
  build: "bash scripts/build.sh",
  "build:cli": "bash scripts/build.sh",
  "build:compiled-cli": "bun run scripts/build-cli.ts",
  "gen:package-json": "bun run scripts/gen-package-json.ts",
  "gen:skill-docs": "bun run scripts/gen-skill-docs.ts",
  "gen:readme": "bun run scripts/gen-readme.ts",
  test: "bun test",
};

const devScripts = Object.fromEntries(
  commandSpecs.map((spec) => [spec.devScript, `bun run ${getCliSource(spec.id)}`]),
);

const packageJson = JSON.parse(readFileSync(packageJsonFile, "utf8")) as Record<string, unknown>;
packageJson.scripts = {
  ...staticScripts,
  ...devScripts,
};

writeFileSync(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log("Generated package.json scripts");
