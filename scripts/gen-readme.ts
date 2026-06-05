import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commandSpecs } from "../core/src/cli/command-registry";
import {
  formatExample,
  renderCommandReference,
  renderInstallPolicy,
  renderPackageCompatibility,
} from "../core/src/cli/doc-render";

const root = process.cwd();

function renderReadmeCommands(): string {
  const examples = commandSpecs
    .filter((spec) => ["agent", "capture", "build", "package", "projects"].includes(spec.id))
    .map((spec) => formatExample(spec.example))
    .join("\n");
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
