import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commandSpecs, getCommandSpec } from "../core/src/cli/command-registry";
import {
  formatExample,
  renderArgumentReference,
  renderInstallPolicy,
  renderOutputs,
  renderPublicCommandName,
} from "../core/src/cli/doc-render";

const root = process.cwd();
const skillDir = join(root, "skills", "codemem");
const template = readFileSync(join(skillDir, "SKILL.md.tmpl"), "utf8");

const replacements: Record<string, string> = {
  COMMANDS: commandSpecs.map((spec) => `- \`${renderPublicCommandName(spec)}\` - ${spec.summary}`).join("\n"),
  INIT_COMMAND: formatExample(getCommandSpec("init").example),
  STATE_FILES: renderOutputs(getCommandSpec("init").outputs),
  CAPTURE_COMMAND: formatExample(getCommandSpec("capture").example),
  BUILD_COMMAND: formatExample(getCommandSpec("build").example),
  BUILD_OUTPUTS: renderOutputs(getCommandSpec("build").outputs),
  PACKAGE_COMMAND: formatExample(getCommandSpec("package").example),
  PACKAGE_OUTPUTS: renderOutputs(getCommandSpec("package").outputs),
  INSTALL_COMMAND: formatExample(getCommandSpec("install").example),
  INSTALL_POLICY: renderInstallPolicy(),
  PROJECTS_COMMAND: formatExample(getCommandSpec("projects").example),
  ARGUMENT_REFERENCE: renderArgumentReference(),
  RUNTIME_LAYOUT: [
    "- `core/src/cli/` - CLI entrypoints",
    "- `core/src/standards/` - standards capture and document rendering",
    "- `core/src/registry/` - project and package registry",
    "- `core/src/packaging/` - shareable package builder",
    "- `core/src/installer/` - package installer",
    "- `core/src/shared/` - shared helpers",
  ].join("\n"),
};

const rendered = Object.entries(replacements).reduce(
  (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
  template,
);

writeFileSync(join(skillDir, "SKILL.md"), rendered);
console.log("Generated skills/codemem/SKILL.md");
