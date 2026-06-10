import { commandSpecs, type CommandArgSpec, type CommandSpec } from "./command-registry";

export function formatExample(example: string | string[]): string {
  return Array.isArray(example) ? example.join("\n") : example;
}

export function renderPublicCommandName(spec: CommandSpec): string {
  return `codemem ${spec.id}`;
}

export function renderOutputs(outputs: string[] | undefined): string {
  return (outputs || []).map((item) => `- \`${item}\``).join("\n");
}

function renderValues(values: string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "-";
}

function renderDefaultValue(arg: CommandArgSpec): string {
  return arg.defaultValue ? `\`${arg.defaultValue}\`` : "-";
}

function renderRequired(arg: CommandArgSpec): string {
  return arg.required ? "Required" : "Optional";
}

export function renderArgsTable(args: CommandArgSpec[] | undefined): string {
  if (!args || args.length === 0) {
    return "_No command-specific arguments._";
  }

  const lines = [
    "| Argument | Required | Default | Allowed values | Description |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const arg of args) {
    lines.push(
      `| \`${arg.name}\` | ${renderRequired(arg)} | ${renderDefaultValue(arg)} | ${renderValues(arg.values)} | ${arg.description} |`,
    );
  }

  return lines.join("\n");
}

export function renderCommandReference(specs: CommandSpec[] = commandSpecs): string {
  return specs.map((spec) => {
    const lines = [
      `## \`${renderPublicCommandName(spec)}\``,
      "",
      spec.summary,
      "",
      "```bash",
      formatExample(spec.example),
      "```",
      "",
      "Arguments:",
      "",
      renderArgsTable(spec.args),
    ];

    if (spec.outputs && spec.outputs.length > 0) {
      lines.push("");
      lines.push("Outputs:");
      lines.push("");
      for (const output of spec.outputs) {
        lines.push(`- \`${output}\``);
      }
    }

    if (spec.id === "install") {
      lines.push("");
      lines.push("Install outcomes:");
      lines.push("");
      lines.push(renderInstallPolicy());
    }

    return lines.join("\n");
  }).join("\n\n");
}

export function renderArgumentReference(specs: CommandSpec[] = commandSpecs): string {
  return specs.map((spec) => [
    `### \`${renderPublicCommandName(spec)}\``,
    "",
    renderArgsTable(spec.args),
  ].join("\n")).join("\n\n");
}

export function renderInstallPolicy(): string {
  return [
    "- 首次安装会返回 `installed`。",
    "- 新版本覆盖旧版本时会返回 `upgraded`。",
    "- 默认禁止降级安装；显式传入 `--allow-downgrade` 后会返回 `downgraded`。",
    "- 默认禁止重复安装同一版本；显式传入 `--force` 后会返回 `reinstalled`。",
    "- 默认禁止用不同的已安装包 ID 进行覆盖；显式传入 `--force` 后才允许替换。",
  ].join("\n");
}

export function renderPackageCompatibility(): string {
  return [
    "- 当前可分享安装包使用 manifest `schema: 1`。",
    "- 安装器要求 `compatibility.installerSchema: 1`。",
    "- 安装包会记录生成它的 `codemem` 工具版本。",
    "- 外部分发安装时，需要满足 manifest 中声明的 Node.js 运行时要求。",
  ].join("\n");
}
