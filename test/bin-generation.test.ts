import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
});
