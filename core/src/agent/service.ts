import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { getAgentPackagesDir, getRuntimeDir } from "../shared/paths";
import { run, runTar } from "../shared/process";
import { nowIso } from "../shared/time";
import { sha256File } from "../shared/hash";

export type AgentId = "codex" | "cursor" | "claude-code";

export interface InstallAgentOptions {
  rootDir: string;
  agent?: AgentId;
  targetDir: string;
  skillDir?: string;
  lang: string;
  confirmDetectedSkillDir?: (input: {
    agent: AgentId;
    detectedSkillDir: string;
    defaultSkillDir: string;
    targetDir: string;
  }) => boolean | Promise<boolean>;
}

export interface InstallAgentResult {
  agent: AgentId;
  targetDir: string;
  integrationPath: string;
  runtimeBinDir: string;
  templatesDir: string;
  skillDir: string;
}

export interface ExportAgentPackageOptions {
  rootDir: string;
  agent?: AgentId | "all";
  targetDir?: string;
  version: string;
  lang: string;
  packageName?: string;
}

export interface ExportAgentPackageResult {
  agent: AgentId | "all";
  packageDir: string;
  archiveFile: string;
  digestFile: string;
}

export interface AgentDetectionResult {
  agent: AgentId;
  targetDir: string;
  skillDir: string;
  integrationPath: string;
  runtimeBinDir: string;
  templatesDir: string;
  configured: boolean;
  selectionReason: SkillDirSelectionReason;
}

export type SkillDirSelectionReason =
  | "explicit_override"
  | "detected_existing_project"
  | "detected_existing_home"
  | "default_fallback";

interface AgentTargetSpec {
  id: AgentId;
  label: string;
  defaultSkillDir(targetDir: string): string;
  candidateSkillDirs(targetDir: string): string[];
  integrationPath(targetDir: string, skillDir?: string): string;
  renderIntegration(input: {
    lang: string;
    runtimeBinDir: string;
    targetDir: string;
    skillDir: string;
  }): string;
  renderMeta?(input: { rootDir: string; lang: string }): string | undefined;
}

const RUNTIME_BINARIES = ["codemem-init", "codemem-capture", "codemem-build", "codemem-projects"] as const;
const AGENT_PACKAGE_SCHEMA = 1;
const AGENT_SKILL_NAME = "codemem";
const CLAUDE_COMMAND_FILE = "codemem.md";

function getHomeDir(): string {
  return process.env.HOME || homedir();
}

function renderCodexOpenAiYaml(lang: string): string {
  return [
    "interface:",
    `  display_name: "Codemem Standards"`,
    `  short_description: "${lang === "en" ? "Initialize codemem, capture development standards, and regenerate standards docs after confirmation." : "初始化 codemem、记录开发规范，并在确认后重新生成规范文档。"}"`,
    `  default_prompt: "${lang === "en" ? "Use Codemem Standards to initialize the current project, infer the project name, capture stable development standards, and only regenerate docs after the user confirms." : "使用 Codemem Standards 为当前项目初始化 codemem，自动推断项目名，记录稳定开发规范，并在用户确认后重新生成规范文档。"}"`,
    "",
  ].join("\n");
}

function renderCursorMetaJson(rootDir: string, lang: string): string {
  const description = lang === "en"
    ? "Initialize codemem for the current project, capture development standards, and regenerate standards docs after confirmation."
    : "为当前项目初始化 codemem、记录开发规范，并在确认后重新生成规范文档。";
  return `${JSON.stringify({
    slug: AGENT_SKILL_NAME,
    name: lang === "en" ? "Codemem Development Standards" : "Codemem 项目开发规范",
    version: loadVersion(rootDir),
    description,
    descriptionZh: "为当前项目初始化 codemem、记录开发规范，并在确认后重新生成规范文档。",
    author: "codemem",
    category: "developer-tools",
    tags: ["codemem", "standards", "workflow", "documentation"],
    featured: 0,
  }, null, 2)}\n`;
}

function loadVersion(rootDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as { version?: string };
    return pkg.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function getRuntimeBinDir(targetDir: string): string {
  return join(getRuntimeDir(targetDir), "agent-runtime", "bin");
}

function getInstalledTemplatesDir(targetDir: string): string {
  return join(targetDir, "skills", "codemem", "templates");
}

function getDefaultHomeSkillDir(): string {
  return join(getHomeDir(), ".codex", "skills", AGENT_SKILL_NAME);
}

function getCursorSkillRuntimeBinDir(skillDir: string): string {
  return join(skillDir, "runtime", "bin");
}

function getCursorSkillTemplatesDir(skillDir: string): string {
  return join(skillDir, "templates");
}

function copyDir(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });

  for (const entry of readdirSync(source)) {
    const sourceFile = join(source, entry);
    const destinationFile = join(destination, entry);
    const stat = statSync(sourceFile);

    if (stat.isDirectory()) {
      copyDir(sourceFile, destinationFile);
      continue;
    }

    copyFileSync(sourceFile, destinationFile);
  }
}

function ensureCompiledRuntime(rootDir: string): void {
  const distDir = join(rootDir, "core", "dist");
  const missing = RUNTIME_BINARIES.filter((name) => !existsSync(join(distDir, name)));
  if (missing.length === 0) {
    return;
  }

  run("bun", ["run", "scripts/build-cli.ts"], { cwd: rootDir });
}

function installRuntimeBundle(rootDir: string, targetDir: string): { runtimeBinDir: string; templatesDir: string } {
  ensureCompiledRuntime(rootDir);

  const runtimeBinDir = getRuntimeBinDir(targetDir);
  const templatesDir = getInstalledTemplatesDir(targetDir);
  const sourceTemplatesDir = join(rootDir, "skills", "codemem", "templates");
  const distDir = join(rootDir, "core", "dist");

  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });

  for (const binary of RUNTIME_BINARIES) {
    copyFileSync(join(distDir, binary), join(runtimeBinDir, binary));
  }

  copyDir(sourceTemplatesDir, templatesDir);

  return { runtimeBinDir, templatesDir };
}

function installCursorSkillBundle(rootDir: string, skillDir: string): { runtimeBinDir: string; templatesDir: string } {
  ensureCompiledRuntime(rootDir);

  const runtimeBinDir = getCursorSkillRuntimeBinDir(skillDir);
  const templatesDir = getCursorSkillTemplatesDir(skillDir);
  const sourceTemplatesDir = join(rootDir, "skills", "codemem", "templates");
  const distDir = join(rootDir, "core", "dist");

  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });

  for (const binary of RUNTIME_BINARIES) {
    copyFileSync(join(distDir, binary), join(runtimeBinDir, binary));
  }

  copyDir(sourceTemplatesDir, templatesDir);

  return { runtimeBinDir, templatesDir };
}

function relativeFromProject(targetDir: string, absolutePath: string): string {
  const path = relative(targetDir, absolutePath) || ".";
  return toPosixPath(path.startsWith(".") ? path : `./${path}`);
}

function renderSharedWorkflow(input: { runtimeBinDir: string; targetDir: string; lang: string }): string {
  const initCommand = `${relativeFromProject(input.targetDir, join(input.runtimeBinDir, "codemem-init"))}`;
  const captureCommand = `${relativeFromProject(input.targetDir, join(input.runtimeBinDir, "codemem-capture"))}`;
  const buildCommand = `${relativeFromProject(input.targetDir, join(input.runtimeBinDir, "codemem-build"))}`;

  if (input.lang === "en") {
    return [
      "When this workflow is invoked:",
      "1. Check whether the current project already has `.codemem/` state and `skills/codemem/templates/`.",
      "2. If the project is not initialized, infer the project name from the current directory name, repo name, or package metadata.",
      "3. If project-name confidence is low, ask one concise question; otherwise initialize automatically.",
      `4. Use \`${initCommand} --root <project_root> --project <name> --owner <owner> --project-path <project_root>\` to initialize.`,
      "5. Capture stable development conventions as separate rules when the user or the codebase reveals them.",
      `6. Use \`${captureCommand} --root <project_root> ...\` to append one rule at a time.`,
      "7. Do not rebuild standards docs silently. If rules changed materially, recommend regeneration first.",
      `8. Only after user confirmation, run \`${buildCommand} --root <project_root> --project <name> --lang en\`.`,
      "9. If the user explicitly asks to regenerate the docs, do it immediately.",
    ].join("\n");
  }

  return [
    "当这个工作流被调用时：",
    "1. 先检查当前项目是否已经存在 `.codemem/` 状态目录，以及 `skills/codemem/templates/` 模板目录。",
    "2. 如果项目还没有初始化，优先根据当前目录名、仓库名、包名等信息推断项目名称。",
    "3. 如果对项目名判断不够稳，再只问一个简短确认问题；否则直接初始化。",
    `4. 使用 \`${initCommand} --root <project_root> --project <name> --owner <owner> --project-path <project_root>\` 完成初始化。`,
    "5. 在开发过程中，当用户或代码上下文暴露出稳定约定时，把每条规范单独记录下来。",
    `6. 使用 \`${captureCommand} --root <project_root> ...\` 逐条追加规范。`,
    "7. 不要静默重建规范文档；如果发现规范有明显新增、冲突或状态变化，应先提出更新建议。",
    `8. 只有在用户确认后，再执行 \`${buildCommand} --root <project_root> --project <name> --lang zh\`。`,
    "9. 如果用户明确要求“重新生成规范文档”，则直接执行生成。",
  ].join("\n");
}

function renderCursorWorkflow(input: {
  lang: string;
  globalRuntimeBinDir: string;
  globalTemplatesDir: string;
}): string {
  const mkdirCommand = "mkdir -p .codemem/_system/runtime/agent-runtime/bin skills/codemem/templates";
  const runtimeCopyCommand = `cp -R "${toPosixPath(input.globalRuntimeBinDir)}/." ".codemem/_system/runtime/agent-runtime/bin/"`;
  const templateCopyCommand = `cp -R "${toPosixPath(input.globalTemplatesDir)}/." "skills/codemem/templates/"`;
  const initCommand = `.codemem/_system/runtime/agent-runtime/bin/codemem-init --root <project_root> --project <name> --owner <owner> --project-path <project_root>`;
  const captureCommand = `.codemem/_system/runtime/agent-runtime/bin/codemem-capture --root <project_root> ...`;
  const buildCommand = `.codemem/_system/runtime/agent-runtime/bin/codemem-build --root <project_root> --project <name> --lang ${input.lang === "en" ? "en" : "zh"}`;

  if (input.lang === "en") {
    return [
      "When this workflow is invoked:",
      "1. Check whether the current project already has `.codemem/` state and `skills/codemem/templates/`.",
      "2. If project runtime or templates are missing, bootstrap them from this global skill before initialization.",
      `3. Run \`${mkdirCommand}\`.`,
      `4. Run \`${runtimeCopyCommand}\`.`,
      `5. Run \`${templateCopyCommand}\`.`,
      "6. If the project is not initialized, infer the project name from the current directory name, repo name, or package metadata.",
      "7. If project-name confidence is low, ask one concise question; otherwise initialize automatically.",
      `8. Use \`${initCommand}\` to initialize.`,
      "9. Capture stable development conventions as separate rules when the user or the codebase reveals them.",
      `10. Use \`${captureCommand}\` to append one rule at a time.`,
      "11. Do not rebuild standards docs silently. If rules changed materially, recommend regeneration first.",
      `12. Only after user confirmation, run \`${buildCommand}\`.`,
      "13. If the user explicitly asks to regenerate the docs, do it immediately.",
    ].join("\n");
  }

  return [
    "当这个工作流被调用时：",
    "1. 先检查当前项目是否已经存在 `.codemem/` 状态目录，以及 `skills/codemem/templates/` 模板目录。",
    "2. 如果项目 runtime 或模板缺失，先从这个全局 skill 自举到当前项目，再继续初始化。",
    `3. 执行 \`${mkdirCommand}\`。`,
    `4. 执行 \`${runtimeCopyCommand}\`。`,
    `5. 执行 \`${templateCopyCommand}\`。`,
    "6. 如果项目还没有初始化，优先根据当前目录名、仓库名、包名等信息推断项目名称。",
    "7. 如果对项目名判断不够稳，再只问一个简短确认问题；否则直接初始化。",
    `8. 使用 \`${initCommand}\` 完成初始化。`,
    "9. 在开发过程中，当用户或代码上下文暴露出稳定约定时，把每条规范单独记录下来。",
    `10. 使用 \`${captureCommand}\` 逐条追加规范。`,
    "11. 不要静默重建规范文档；如果发现规范有明显新增、冲突或状态变化，应先提出更新建议。",
    `12. 只有在用户确认后，再执行 \`${buildCommand}\`。`,
    "13. 如果用户明确要求“重新生成规范文档”，则直接执行生成。",
  ].join("\n");
}

const agentSpecs: AgentTargetSpec[] = [
  {
    id: "codex",
    label: "Codex",
    defaultSkillDir() {
      return getDefaultHomeSkillDir();
    },
    candidateSkillDirs() {
      return [getDefaultHomeSkillDir()];
    },
    integrationPath(_targetDir, skillDir) {
      return join(skillDir || getDefaultHomeSkillDir(), "SKILL.md");
    },
    renderIntegration({ runtimeBinDir, targetDir, lang }) {
      const workflow = renderSharedWorkflow({ runtimeBinDir, targetDir, lang });
      const description = lang === "en"
        ? "Use when the user wants the agent to initialize codemem for the current project, capture development standards, or regenerate standards docs after confirmation."
        : "当用户希望 agent 为当前项目初始化 codemem、记录开发规范、或在确认后重新生成规范文档时使用。";
      const title = lang === "en" ? "Codemem Development Standards" : "Codemem 项目开发规范";
      const body = lang === "en"
        ? [
          `# ${title}`,
          "",
          workflow,
          "",
          "Operational rules:",
          "- Default to the current working directory as the project root.",
          "- Infer the project name automatically when possible.",
          "- Ask before rebuilding standards docs unless the user explicitly requested regeneration.",
          "- Keep output concise and execution-oriented.",
        ].join("\n")
        : [
          `# ${title}`,
          "",
          workflow,
          "",
          "执行规则：",
          "- 默认把当前工作目录视为项目根目录。",
          "- 尽量自动推断项目名称。",
          "- 除非用户明确要求，否则生成规范文档前先给出更新建议并等待确认。",
          "- 输出保持简洁，以执行为主。",
        ].join("\n");
      return [
        "---",
        `name: ${AGENT_SKILL_NAME}`,
        `description: |`,
        `  ${description}`,
        "---",
        "",
        body,
        "",
      ].join("\n");
    },
  },
  {
    id: "cursor",
    label: "Cursor",
    defaultSkillDir() {
      return getDefaultHomeSkillDir();
    },
    candidateSkillDirs() {
      return [getDefaultHomeSkillDir()];
    },
    integrationPath(_targetDir, skillDir) {
      return join(skillDir || getDefaultHomeSkillDir(), "SKILL.md");
    },
    renderIntegration({ runtimeBinDir, targetDir, skillDir, lang }) {
      const workflow = renderCursorWorkflow({
        lang,
        globalRuntimeBinDir: runtimeBinDir,
        globalTemplatesDir: getCursorSkillTemplatesDir(skillDir),
      });
      const installDir = toPosixPath(skillDir);

      const description = lang === "en"
        ? "Use when the user wants Cursor to initialize codemem for the current project, capture development standards, or regenerate standards docs after confirmation."
        : "当用户希望 Cursor 为当前项目初始化 codemem、记录开发规范、或在确认后重新生成规范文档时使用。";
      const title = lang === "en" ? "Codemem Development Standards" : "Codemem 项目开发规范";
      const body = lang === "en"
        ? [
          `# ${title}`,
          "",
          `This skill is installed in \`${installDir}\` and carries its own runtime and templates for bootstrapping new projects.`,
          "",
          workflow,
          "",
          "Operational rules:",
          "- Default to the current working directory as the project root.",
          "- Infer the project name automatically when possible.",
          "- Ask before rebuilding standards docs unless the user explicitly requested regeneration.",
          "- Keep output concise and execution-oriented.",
        ].join("\n")
        : [
          `# ${title}`,
          "",
          `这个 skill 安装在 \`${installDir}\`，自带 runtime 和模板，用来为新项目完成自举。`,
          "",
          workflow,
          "",
          "执行规则：",
          "- 默认把当前工作目录视为项目根目录。",
          "- 尽量自动推断项目名称。",
          "- 除非用户明确要求，否则生成规范文档前先给出更新建议并等待确认。",
          "- 输出保持简洁，以执行为主。",
        ].join("\n");
      return [
        "---",
        `name: ${AGENT_SKILL_NAME}`,
        `description: |`,
        `  ${description}`,
        "---",
        "",
        body,
        "",
      ].join("\n");
    },
    renderMeta({ rootDir, lang }) {
      return renderCursorMetaJson(rootDir, lang);
    },
  },
  {
    id: "claude-code",
    label: "Claude Code",
    defaultSkillDir(targetDir) {
      return join(targetDir, ".claude", "commands");
    },
    candidateSkillDirs(targetDir) {
      return [
        join(targetDir, ".claude", "commands"),
        join(getHomeDir(), ".claude", "commands"),
      ];
    },
    integrationPath(targetDir, skillDir) {
      return join(skillDir || join(targetDir, ".claude", "commands"), CLAUDE_COMMAND_FILE);
    },
    renderIntegration({ runtimeBinDir, targetDir, skillDir, lang }) {
      const workflow = renderSharedWorkflow({ runtimeBinDir, targetDir, lang });
      const relRuntime = relativeFromProject(targetDir, runtimeBinDir);
      const installDir = relativeFromProject(targetDir, dirname(join(skillDir, CLAUDE_COMMAND_FILE)));

      return [
        "# /codemem",
        "",
        lang === "en"
          ? `This command is installed in \`${installDir}\` and uses the project runtime in \`${relRuntime}\`.`
          : `这个命令安装在 \`${installDir}\`，使用项目中的 \`${relRuntime}\` runtime。`,
        "",
        workflow,
      ].join("\n");
    },
  },
];

function getAgentSpec(id: AgentId): AgentTargetSpec {
  const spec = agentSpecs.find((item) => item.id === id);
  if (!spec) {
    throw new Error(`Unsupported agent: ${id}`);
  }
  return spec;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((item) => resolve(item)))];
}

function resolveSelectionReason(targetDir: string, selectedDir: string, explicit = false): SkillDirSelectionReason {
  if (explicit) {
    return "explicit_override";
  }

  const resolvedTargetClaudeDir = resolve(join(targetDir, ".claude", "commands"));
  const resolvedHomeClaudeDir = resolve(join(getHomeDir(), ".claude", "commands"));
  const resolvedHomeCodexDir = resolve(getDefaultHomeSkillDir());
  const resolvedSelectedDir = resolve(selectedDir);

  if (resolvedSelectedDir === resolvedTargetClaudeDir) {
    return "detected_existing_project";
  }

  if (
    resolvedSelectedDir === resolvedHomeClaudeDir
    || resolvedSelectedDir === resolvedHomeCodexDir
  ) {
    return "detected_existing_home";
  }

  return "default_fallback";
}

function findDetectedSkillDir(spec: AgentTargetSpec, targetDir: string): { skillDir?: string; selectionReason: SkillDirSelectionReason } {
  const candidates = uniquePaths(spec.candidateSkillDirs(targetDir));
  const detected = candidates.find((candidate) => existsSync(candidate));
  if (!detected) {
    return { skillDir: undefined, selectionReason: "default_fallback" };
  }
  return {
    skillDir: detected,
    selectionReason: resolveSelectionReason(targetDir, detected),
  };
}

function resolveSkillDir(spec: AgentTargetSpec, targetDir: string, explicitSkillDir?: string): string {
  if (explicitSkillDir) {
    return resolve(explicitSkillDir);
  }

  return resolve(findDetectedSkillDir(spec, targetDir).skillDir || spec.defaultSkillDir(targetDir));
}

async function resolveSkillDirForInstall(
  spec: AgentTargetSpec,
  targetDir: string,
  explicitSkillDir: string | undefined,
  confirmDetectedSkillDir?: InstallAgentOptions["confirmDetectedSkillDir"],
): Promise<string> {
  if (explicitSkillDir) {
    return resolve(explicitSkillDir);
  }

  const defaultSkillDir = resolve(spec.defaultSkillDir(targetDir));
  const detectedSkillDir = resolve(findDetectedSkillDir(spec, targetDir).skillDir || defaultSkillDir);

  if (detectedSkillDir === defaultSkillDir || !confirmDetectedSkillDir) {
    return detectedSkillDir;
  }

  const accepted = await confirmDetectedSkillDir({
    agent: spec.id,
    detectedSkillDir,
    defaultSkillDir,
    targetDir: resolve(targetDir),
  });

  return accepted ? detectedSkillDir : defaultSkillDir;
}

async function chooseAgentInteractively(): Promise<AgentId> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question([
      "请选择要安装的 code agent：",
      "1. Codex",
      "2. Cursor",
      "3. Claude Code",
      "> ",
    ].join("\n"));

    const normalized = answer.trim().toLowerCase();
    if (normalized === "1" || normalized === "codex") return "codex";
    if (normalized === "2" || normalized === "cursor") return "cursor";
    if (normalized === "3" || normalized === "claude-code" || normalized === "claude") return "claude-code";
  } finally {
    rl.close();
  }

  throw new Error("未识别的 agent 选择，请使用 1、2、3，或传入 --agent。");
}

function installIntegration(
  spec: AgentTargetSpec,
  rootDir: string,
  targetDir: string,
  skillDir: string,
  runtimeBinDir: string,
  lang: string,
): string {
  const destination = spec.integrationPath(targetDir, skillDir);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    `${spec.renderIntegration({ runtimeBinDir, targetDir, skillDir, lang })}\n`,
  );

  if (spec.id === "codex") {
    const agentsDir = join(skillDir, "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(agentsDir, "openai.yaml"), renderCodexOpenAiYaml(lang));
  }

  const meta = spec.renderMeta?.({ rootDir, lang });
  if (meta) {
    writeFileSync(join(skillDir, "meta.json"), meta);
  }

  return destination;
}

export async function installAgent(options: InstallAgentOptions): Promise<InstallAgentResult> {
  const agent = options.agent || await chooseAgentInteractively();
  const spec = getAgentSpec(agent);
  const targetDir = resolve(options.targetDir);
  const skillDir = await resolveSkillDirForInstall(spec, targetDir, options.skillDir, options.confirmDetectedSkillDir);

  const bundle = agent === "cursor"
    ? installCursorSkillBundle(options.rootDir, skillDir)
    : installRuntimeBundle(options.rootDir, targetDir);
  const { runtimeBinDir, templatesDir } = bundle;
  const integrationPath = installIntegration(spec, options.rootDir, targetDir, skillDir, runtimeBinDir, options.lang);

  return {
    agent,
    targetDir,
    integrationPath,
    runtimeBinDir,
    templatesDir,
    skillDir,
  };
}

export function detectAgentInstallations(options: {
  agent?: AgentId;
  targetDir: string;
  skillDir?: string;
}): AgentDetectionResult[] {
  const targetDir = resolve(options.targetDir);
  const selected = options.agent ? [getAgentSpec(options.agent)] : agentSpecs;

  return selected.map((spec) => {
    const detected = findDetectedSkillDir(spec, targetDir);
    const skillDir = options.skillDir
      ? resolve(options.skillDir)
      : resolveSkillDir(spec, targetDir);
    const selectionReason = options.skillDir
      ? "explicit_override"
      : detected.selectionReason;
    const integrationPath = spec.integrationPath(targetDir, skillDir);
    const runtimeBinDir = spec.id === "cursor" ? getCursorSkillRuntimeBinDir(skillDir) : getRuntimeBinDir(targetDir);
    const templatesDir = spec.id === "cursor" ? getCursorSkillTemplatesDir(skillDir) : getInstalledTemplatesDir(targetDir);
    const configured = existsSync(integrationPath) && existsSync(runtimeBinDir) && existsSync(templatesDir);

    return {
      agent: spec.id,
      targetDir,
      skillDir,
      integrationPath,
      runtimeBinDir,
      templatesDir,
      configured,
      selectionReason,
    };
  });
}

function buildExportManifest(options: ExportAgentPackageOptions): Record<string, unknown> {
  return {
    schema: AGENT_PACKAGE_SCHEMA,
    type: "codemem-agent-package",
    packageName: options.packageName || "codemem-agent-kit",
    version: options.version,
    agent: options.agent || "all",
    generatedAt: nowIso(),
    generatedBy: {
      tool: "codemem",
      version: loadVersion(options.rootDir),
    },
  };
}

function renderExportInstaller(options: {
  packageName: string;
  version: string;
}): string {
  return `#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const AGENTS = {
  codex: {
    candidateSkillDirs() {
      return [join(getHomeDir(), ".codex", "skills", "codemem")];
    },
    defaultSkillDir() {
      return join(getHomeDir(), ".codex", "skills", "codemem");
    },
    integrationPath(targetDir, skillDir) {
      return join(skillDir || join(getHomeDir(), ".codex", "skills", "codemem"), "SKILL.md");
    },
  },
  cursor: {
    candidateSkillDirs() {
      return [join(getHomeDir(), ".codex", "skills", "codemem")];
    },
    defaultSkillDir() {
      return join(getHomeDir(), ".codex", "skills", "codemem");
    },
    integrationPath(_targetDir, skillDir) {
      return join(skillDir || join(getHomeDir(), ".codex", "skills", "codemem"), "SKILL.md");
    },
  },
  "claude-code": {
    candidateSkillDirs(targetDir) {
      return [join(targetDir, ".claude", "commands"), join(getHomeDir(), ".claude", "commands")];
    },
    defaultSkillDir(targetDir) {
      return join(targetDir, ".claude", "commands");
    },
    integrationPath(targetDir, skillDir) {
      return join(skillDir || join(targetDir, ".claude", "commands"), "codemem.md");
    },
  },
};

function getHomeDir() {
  return process.env.HOME || homedir();
}

function uniquePaths(paths) {
  return [...new Set(paths.map((item) => resolve(item)))];
}

function resolveSkillDir(agent, targetDir, explicitSkillDir) {
  if (explicitSkillDir) {
    return resolve(explicitSkillDir);
  }

  const spec = AGENTS[agent];
  const candidates = uniquePaths([
    ...spec.candidateSkillDirs(targetDir),
    spec.defaultSkillDir(targetDir),
  ]);
  const detected = candidates.find((candidate) => existsSync(candidate));
  return resolve(detected || spec.defaultSkillDir(targetDir));
}

function copyDir(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    const sourceFile = join(source, entry);
    const destinationFile = join(destination, entry);
    const stat = statSync(sourceFile);
    if (stat.isDirectory()) {
      copyDir(sourceFile, destinationFile);
    } else {
      copyFileSync(sourceFile, destinationFile);
    }
  }
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }
    values.set(key, next);
    index += 1;
  }
  return values;
}

async function chooseAgent() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question("Select agent (codex/cursor/claude-code): ");
    return answer.trim().toLowerCase();
  } finally {
    rl.close();
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv);
let agent = args.get("agent");
if (!agent) {
  agent = await chooseAgent();
}
if (!AGENTS[agent]) {
  throw new Error("Unsupported agent: " + agent);
}

const targetDir = resolve(args.get("target-dir") || process.cwd());
const skillDir = resolveSkillDir(agent, targetDir, args.get("skill-dir"));
const runtimeSource = join(scriptDir, "runtime");
const templatesSource = join(runtimeSource, "templates");
const binSource = join(runtimeSource, "bin");
const integrationSource = join(scriptDir, "integrations", agent);
const runtimeTarget = join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin");
const templatesTarget = join(targetDir, "skills", "codemem", "templates");

copyDir(binSource, runtimeTarget);
copyDir(templatesSource, templatesTarget);

let destination = "";
if (agent === "codex" || agent === "cursor") {
  copyDir(integrationSource, skillDir);
  destination = join(skillDir, "SKILL.md");
} else {
  const files = readdirSync(integrationSource);
  if (files.length === 0) {
    throw new Error("No integration files found for agent: " + agent);
  }

  const sourceFile = join(integrationSource, files[0]);
  destination = AGENTS[agent].integrationPath(targetDir, skillDir);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(sourceFile, destination);
}

console.log("Installed ${options.packageName}@${options.version}");
console.log("Agent: " + agent);
console.log("Project runtime: " + runtimeTarget);
console.log("Templates: " + templatesTarget);
console.log("Integration: " + destination);
`;
}

export function exportAgentPackage(options: ExportAgentPackageOptions): ExportAgentPackageResult {
  const rootDir = resolve(options.rootDir);
  const version = options.version || loadVersion(rootDir);
  const packageName = options.packageName || "codemem-agent-kit";
  const packageDirRoot = resolve(options.targetDir || getAgentPackagesDir(rootDir));
  const packageDir = join(packageDirRoot, `${packageName}-${version}`);
  const archiveFile = `${packageDir}.tgz`;
  const digestFile = `${archiveFile}.sha256`;
  const runtimeDir = join(packageDir, "runtime");
  const runtimeBinDir = join(runtimeDir, "bin");
  const runtimeTemplatesDir = join(runtimeDir, "templates");
  const integrationsDir = join(packageDir, "integrations");

  rmSync(packageDir, { recursive: true, force: true });
  rmSync(archiveFile, { force: true });
  rmSync(digestFile, { force: true });
  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(runtimeTemplatesDir, { recursive: true });
  mkdirSync(integrationsDir, { recursive: true });

  ensureCompiledRuntime(rootDir);

  for (const binary of RUNTIME_BINARIES) {
    copyFileSync(join(rootDir, "core", "dist", binary), join(runtimeBinDir, binary));
  }
  copyDir(join(rootDir, "skills", "codemem", "templates"), runtimeTemplatesDir);

  const targetDir = resolve(options.targetDir || process.cwd());
  for (const spec of agentSpecs) {
    if (options.agent && options.agent !== "all" && options.agent !== spec.id) {
      continue;
    }

    const skillDir = spec.defaultSkillDir(targetDir);
    const integrationDir = join(integrationsDir, spec.id);
    mkdirSync(integrationDir, { recursive: true });
    let renderedRuntimeBinDir = join(targetDir, ".codemem", "_system", "runtime", "agent-runtime", "bin");

    if (spec.id === "cursor") {
      const packagedRuntimeBinDir = join(integrationDir, "runtime", "bin");
      const packagedTemplatesDir = join(integrationDir, "templates");
      mkdirSync(packagedRuntimeBinDir, { recursive: true });
      mkdirSync(packagedTemplatesDir, { recursive: true });

      for (const binary of RUNTIME_BINARIES) {
        copyFileSync(join(rootDir, "core", "dist", binary), join(packagedRuntimeBinDir, binary));
      }

      copyDir(join(rootDir, "skills", "codemem", "templates"), packagedTemplatesDir);
      renderedRuntimeBinDir = packagedRuntimeBinDir;
    }

    const fileName = basename(spec.integrationPath(targetDir, skillDir));
    writeFileSync(
      join(integrationDir, fileName),
      `${spec.renderIntegration({
        runtimeBinDir: renderedRuntimeBinDir,
        targetDir,
        skillDir: spec.id === "cursor" ? integrationDir : skillDir,
        lang: options.lang,
      })}\n`,
    );

    const meta = spec.renderMeta?.({ rootDir, lang: options.lang });
    if (meta) {
      writeFileSync(join(integrationDir, "meta.json"), meta);
    }

    if (spec.id === "codex") {
      const agentsDir = join(integrationDir, "agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "openai.yaml"), renderCodexOpenAiYaml(options.lang));
    }
  }

  writeFileSync(join(packageDir, "manifest.json"), `${JSON.stringify(buildExportManifest({
    ...options,
    rootDir,
    version,
    packageName,
  }), null, 2)}\n`);
  writeFileSync(join(packageDir, "install.mjs"), renderExportInstaller({ packageName, version }));
  writeFileSync(join(packageDir, "README.txt"), [
    `Package: ${packageName}@${version}`,
    "Usage:",
    "  node install.mjs --agent codex --target-dir <project_dir>",
    "  node install.mjs --agent cursor --target-dir <project_dir>",
    "  node install.mjs --agent claude-code --target-dir <project_dir>",
    "",
  ].join("\n"));

  mkdirSync(packageDirRoot, { recursive: true });
  runTar(["-czf", archiveFile, "-C", packageDirRoot, basename(packageDir)]);
  const digest = sha256File(archiveFile);
  writeFileSync(digestFile, `${digest}  ${basename(archiveFile)}\n`);

  return {
    agent: options.agent || "all",
    packageDir,
    archiveFile,
    digestFile,
  };
}
