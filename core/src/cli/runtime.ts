import { getCommandSpec, type CommandArgSpec, type CommandSpec } from "./command-registry";
import { formatExample, renderArgsTable, renderOutputs } from "./doc-render";
import { parseArgs } from "../shared/args";

function findArgSpec(spec: CommandSpec, key: string): CommandArgSpec | undefined {
  return spec.args?.find((arg) => arg.name === `--${key}`);
}

function getAllowedKeys(spec: CommandSpec): Set<string> {
  return new Set(["root", "help", ...(spec.args || []).map((arg) => arg.name.slice(2))]);
}

function renderAllowedValues(arg: CommandArgSpec): string {
  return (arg.values || []).join(", ");
}

export function renderCliHelp(spec: CommandSpec): string {
  const lines = [
    `${spec.binName}`,
    "",
    spec.summary,
    "",
    "Usage:",
    "",
    `  ${formatExample(spec.example).replaceAll("\n", "\n  ")}`,
    "",
    "Arguments:",
    "",
    renderArgsTable(spec.args),
  ];

  if (spec.outputs && spec.outputs.length > 0) {
    lines.push("");
    lines.push("Outputs:");
    lines.push("");
    lines.push(renderOutputs(spec.outputs));
  }

  return lines.join("\n");
}

function failWithHelp(spec: CommandSpec, message: string): never {
  throw new Error(`${message}\n\n${renderCliHelp(spec)}`);
}

function validateArgValue(spec: CommandSpec, key: string, value: string): void {
  const arg = findArgSpec(spec, key);
  if (!arg?.values || arg.values.length === 0) {
    return;
  }

  if (!arg.values.includes(value)) {
    failWithHelp(spec, `${spec.binName}: invalid value for --${key}: ${value}. Allowed values: ${renderAllowedValues(arg)}`);
  }
}

export function loadCommandArgs(id: CommandSpec["id"], argv = process.argv): Map<string, string> {
  const spec = getCommandSpec(id);
  const parsedArgs = parseArgs(argv);

  if (parsedArgs.get("help") === "true") {
    console.log(renderCliHelp(spec));
    process.exit(0);
  }

  const allowedKeys = getAllowedKeys(spec);
  for (const key of parsedArgs.keys()) {
    if (!allowedKeys.has(key)) {
      failWithHelp(spec, `${spec.binName}: unknown argument --${key}`);
    }
  }

  const resolvedArgs = new Map(parsedArgs);
  for (const arg of spec.args || []) {
    const key = arg.name.slice(2);
    const value = resolvedArgs.get(key) || arg.defaultValue;

    if (!value) {
      if (arg.required) {
        failWithHelp(spec, `${spec.binName}: missing required argument ${arg.name}`);
      }
      continue;
    }

    validateArgValue(spec, key, value);
    resolvedArgs.set(key, value);
  }

  return resolvedArgs;
}
