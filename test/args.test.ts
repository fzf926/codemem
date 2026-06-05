import { describe, expect, test } from "bun:test";
import { parseArgs } from "../core/src/shared/args";

describe("parseArgs", () => {
  test("parses keyed arguments and boolean flags", () => {
    const args = parseArgs([
      "bun",
      "script.ts",
      "--project",
      "codemem",
      "--json",
      "--lang",
      "zh",
    ]);

    expect(args.get("project")).toBe("codemem");
    expect(args.get("json")).toBe("true");
    expect(args.get("lang")).toBe("zh");
  });
});
