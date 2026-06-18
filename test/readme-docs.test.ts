import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("generated readme docs", () => {
  test("render command examples and commands reference link", () => {
    const root = process.cwd();
    const readme = readFileSync(join(root, "README.md"), "utf8");
    expect(readme).toContain("bun run core/src/cli/agent.ts --root . install");
    expect(readme).toContain("bun run core/src/cli/upgrade.ts --root .");
    expect(readme).toContain("scripts/install.sh");
    expect(readme).toContain("docs/COMMANDS.md");
    expect(readme).toContain("docs/INSTALL.md");
    expect(readme).toContain("docs/AI_INSTALL.md");
    expect(readme).toContain("docs/AI_UPDATE.md");
  });

  test("render command reference entries", () => {
    const root = process.cwd();
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const commandsDoc = readFileSync(join(root, "docs", "COMMANDS.md"), "utf8");
    expect(readme).toContain("安装策略");
    expect(readme).toContain("upgraded");
    expect(readme).toContain("schema: 1");
    expect(commandsDoc).toContain("## `codemem package`");
    expect(commandsDoc).toContain("~/.codemem/projects/<project_state_key>/_system/packages/standards/<package-id>-<version>.tgz");
    expect(commandsDoc).toContain("Arguments:");
    expect(commandsDoc).toContain("| `--project` | Required |");
    expect(commandsDoc).toContain("| `--lang` | Optional |");
    expect(commandsDoc).toContain("Install outcomes:");
    expect(commandsDoc).toContain("`reinstalled`");
  });
});
