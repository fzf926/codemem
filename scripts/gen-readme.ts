import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderCommandReference,
  renderInstallPolicy,
  renderPackageCompatibility,
} from "../core/src/cli/doc-render";

const root = process.cwd();

function renderReadmeCommands(): string {
  const examples = [
    "bun run core/src/cli/agent.ts --root . install --agent cursor --target-dir <project_dir>",
    "bun run core/src/cli/agent.ts --root . detect --agent cursor --target-dir <project_dir>",
    "bun run core/src/cli/upgrade.ts --root . --agent cursor --target-dir <project_dir>",
    "bun run core/src/cli/capture.ts --root . --project <project_name> --type architecture --title \"规范标题\" --rule \"规范内容\" --priority P1 --status active --scope project",
    "bun run core/src/cli/build.ts --root . --project <project_name> --lang zh",
    "bun run core/src/cli/package.ts --root . --project <project_name> --version <version> --lang zh",
    "bun run core/src/cli/projects.ts --root .",
  ].join("\n");
  return `\`\`\`bash\n${examples}\n\`\`\``;
}

function renderTemplate(templatePath: string, replacements: Record<string, string>): string {
  const template = readFileSync(templatePath, "utf8");
  return Object.entries(replacements).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template,
  );
}

const readme = renderTemplate(join(root, "README.md.tmpl"), {
  README_COMMANDS: renderReadmeCommands(),
  INSTALL_POLICY: renderInstallPolicy(),
  PACKAGE_COMPATIBILITY: renderPackageCompatibility(),
});

const commandsDoc = renderTemplate(join(root, "docs", "COMMANDS.md.tmpl"), {
  COMMAND_REFERENCE: renderCommandReference(),
});

writeFileSync(join(root, "README.md"), readme);
writeFileSync(join(root, "docs", "COMMANDS.md"), commandsDoc);

console.log("Generated README.md");
console.log("Generated docs/COMMANDS.md");
