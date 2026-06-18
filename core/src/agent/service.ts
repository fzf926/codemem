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
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { getAgentPackagesDir } from "../shared/paths";
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
const EXPORT_SKILL_DIR_PLACEHOLDER = "__CODEMEM_SKILL_DIR__";
const EXPORT_SHARED_SKILL_DIR_PLACEHOLDER = "__CODEMEM_SHARED_SKILL_DIR__";
const EXPORT_TARGET_DIR_PLACEHOLDER = "__CODEMEM_TARGET_DIR__";
const EXPORT_RUNTIME_BIN_DIR_PLACEHOLDER = "__CODEMEM_RUNTIME_BIN_DIR__";

function getHomeDir(): string {
  return process.env.HOME || homedir();
}

function renderCodexOpenAiYaml(lang: string): string {
  return [
    "interface:",
    `  display_name: "Codemem Standards"`,
    `  short_description: "为当前项目初始化 codemem、记录开发规范，并默认一轮完成规范文档更新，只有高风险决策才打断确认。"`,
    `  default_prompt: "使用 Codemem Standards 为当前项目初始化 codemem，自动推断项目名，记录稳定开发规范，并默认一轮执行到底，只有高风险决策才打断确认。"`,
    "",
  ].join("\n");
}

function renderCursorMetaJson(rootDir: string, lang: string): string {
  const description = "为当前项目初始化 codemem、记录开发规范，并默认一轮执行到底，只有高风险决策才打断确认。";
  return `${JSON.stringify({
    slug: AGENT_SKILL_NAME,
    name: "Codemem 项目开发规范",
    version: loadVersion(rootDir),
    description,
    descriptionZh: "为当前项目初始化 codemem、记录开发规范，并默认一轮执行到底，只有高风险决策才打断确认。",
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

function getDefaultHomeSkillDir(): string {
  return join(getHomeDir(), ".codex", "skills", AGENT_SKILL_NAME);
}

function getSharedRuntimeBinDir(skillDir: string): string {
  return join(skillDir, "runtime", "bin");
}

function getSharedTemplatesDir(skillDir: string): string {
  return join(skillDir, "templates");
}

function getSharedScriptsDir(skillDir: string): string {
  return join(skillDir, "scripts");
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

function installSharedSkillBundle(rootDir: string, skillDir: string): { runtimeBinDir: string; templatesDir: string; scriptsDir: string } {
  ensureCompiledRuntime(rootDir);

  const runtimeBinDir = getSharedRuntimeBinDir(skillDir);
  const templatesDir = getSharedTemplatesDir(skillDir);
  const scriptsDir = getSharedScriptsDir(skillDir);
  const sourceTemplatesDir = join(rootDir, "skills", "codemem", "templates");
  const sourceScriptsDir = join(rootDir, "skills", "codemem", "scripts");
  const distDir = join(rootDir, "core", "dist");

  rmSync(runtimeBinDir, { recursive: true, force: true });
  rmSync(templatesDir, { recursive: true, force: true });
  rmSync(scriptsDir, { recursive: true, force: true });
  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });

  for (const binary of RUNTIME_BINARIES) {
    copyFileSync(join(distDir, binary), join(runtimeBinDir, binary));
  }

  copyDir(sourceTemplatesDir, templatesDir);
  copyDir(sourceScriptsDir, scriptsDir);

  return { runtimeBinDir, templatesDir, scriptsDir };
}

const scanDimensionsZh = [
  "整体的目录结构规范",
  "架构设计原则",
  "类命名规范",
  "方法命名规范",
  "变量命名规范",
  "业务层级划分",
  "注解使用规范",
  "参数校验规范",
  "异常处理规范",
  "数据访问规范",
  "MapStruct 使用规范",
  "分页查询规范",
  "缓存使用规范",
  "枚举和常量定义规范",
  "日志记录规范",
  "性能要求规范",
  "空值处理规范",
  "单元测试规范",
  "模块扩展规范（新业务模块进入是如何处理）",
];

function renderScanDimensions(): string[] {
  return scanDimensionsZh.map((item) => `   - ${item}`);
}

function renderAgentAutoCaptureSignals(): string[] {
  return [
    "   - architecture or design pattern refactors",
    "   - replacing if/else or switch dispatch with strategies, factories, handlers, registries, or template methods",
    "   - converting MQ or event consumer branching into topic factories, tag strategies, handler registries, or other reusable dispatch mechanisms",
    "   - extracting reusable module boundaries, layered responsibilities, or domain service splits",
    "   - unifying inconsistent implementations into one shared mechanism, base class, adapter, or orchestration flow",
    "   - introducing stable conventions for MQ consumers, events, jobs, schedulers, controllers, or service orchestration",
    "   - standardizing error handling, validation, logging, idempotency, retry, timeout, or fallback behavior",
    "   - redesigning repository, cache, RPC, HTTP client, or persistence access patterns",
    "   - introducing shared naming, packaging, configuration, or dependency injection conventions",
    "   - reorganizing project structure, module boundaries, build layout, or deployment integration",
    "   - defining reusable testing, mocking, fixture, contract, or migration patterns",
  ];
}

function renderAgentAutoCaptureWorkflow(): string[] {
  return [
    "10. 初始化之外，当任务形成可复用工程约定时，也要主动记录并重新生成规范文档，尤其包括：",
    ...renderAgentAutoCaptureSignals(),
    "   不要求用户显式提到 codemem；只要架构重构或代码改造沉淀出了稳定约定，就记录这些规范。",
    "   当以上信号出现且实现落成了可复用约定时，在最终回复前记录对应规范并重新生成规范文档。",
    "   不要把架构或重构产生的规范记录当成代码改完后的可选后续事项。",
  ];
}

function renderSharedWorkflow(input: { scriptFile: string; lang: string }): string {
  const initCommand = `node "${toPosixPath(input.scriptFile)}" init`;
  const captureCommand = `node "${toPosixPath(input.scriptFile)}" capture`;
  const buildCommand = `node "${toPosixPath(input.scriptFile)}" build`;
  const globalDoc = ".codemem/docs/global/global-standard.md";
  const projectDoc = "docs/spec/project-standard.<project_name>.md";
  const conflictsDoc = ".codemem/docs/reports/standards-conflicts.md";

  return [
    "当这个工作流被调用时：",
    `1. 优先读取已有规范文档：\`${globalDoc}\`、\`${projectDoc}\`、\`${conflictsDoc}\`（如果存在）。`,
    "2. 把已读取到的规范文档视为当前项目的默认约束，再进行后续判断与执行。",
    "3. 先检查当前项目是否已经存在 `.codemem/` 状态目录。",
    "4. 使用当前 skill 安装时自带的 JavaScript runtime 和模板。",
    "5. 如果项目还没有初始化，优先根据当前目录名、仓库名、包名等信息推断项目名称。",
    "6. 默认把请求范围内显然该做的事情一轮做完，不要只完成部分扫描后停下来提供可选下一步。",
    `7. 使用 \`${initCommand} --root <project_root> --project <name> --owner <owner> --project-path <project_root> [--project-doc-path <relative_md_path>]\` 完成初始化；当项目规范文档需要写入自定义相对路径和文件名时，传入 \`--project-doc-path\`。`,
    "8. 初始化扫描时，必须先覆盖以下固定清单，再判断扫描完成：",
    ...renderScanDimensions(),
    "9. 当用户或代码上下文暴露出稳定约定时，把每条规范单独记录下来。每个适用清单项至少沉淀 1 条有证据支撑的规范，普通项目初始化扫描目标是沉淀 20-40 条规范；不要只挑 3-5 条核心规范就停止，除非项目证据确实不足。",
    ...renderAgentAutoCaptureWorkflow(),
    "11. 如果初始化扫描少于 20 条规范，最终回复必须明确说明是哪些证据不足导致数量较少。",
    `12. 使用 \`${captureCommand} --root <project_root> ...\` 逐条追加规范。`,
    "13. 只要本轮新增了规范、项目状态发生变化、或用户要求初始化/更新规范文档，就在同一轮里继续生成规范文档。",
    `14. 直接执行 \`${buildCommand} --root <project_root> --project <name> --lang zh\`，除非仍存在高风险决策需要确认。`,
    "15. 只有在高风险场景下才停下来确认：项目身份不确定、可能覆盖重要内容、或存在无法安全自动决策的规范冲突。",
    "16. 不要用“如果你要，我可以继续……”作为收尾；如果下一步低风险且明显属于用户请求范围，就先做完再最终汇报。",
  ].join("\n");
}

function renderCursorWorkflow(input: {
  lang: string;
  globalScriptFile: string;
}): string {
  const initCommand = `node "${toPosixPath(input.globalScriptFile)}" init --root <project_root> --project <name> --owner <owner> --project-path <project_root> [--project-doc-path <relative_md_path>]`;
  const captureCommand = `node "${toPosixPath(input.globalScriptFile)}" capture --root <project_root> ...`;
  const buildCommand = `node "${toPosixPath(input.globalScriptFile)}" build --root <project_root> --project <name> --lang zh`;
  const globalDoc = ".codemem/docs/global/global-standard.md";
  const projectDoc = "docs/spec/project-standard.<project_name>.md";
  const conflictsDoc = ".codemem/docs/reports/standards-conflicts.md";

  return [
    "当这个工作流被调用时：",
    `1. 优先读取已有规范文档：\`${globalDoc}\`、\`${projectDoc}\`、\`${conflictsDoc}\`（如果存在）。`,
    "2. 把已读取到的规范文档视为当前项目的默认约束，再进行后续判断与执行。",
    "3. 先检查当前项目是否已经存在 `.codemem/` 状态目录。",
    "4. 使用当前 skill 自带的 JavaScript runtime 和模板。",
    "5. 如果项目还没有初始化，优先根据当前目录名、仓库名、包名等信息推断项目名称。",
    "6. 默认把请求范围内显然该做的事情一轮做完，不要只完成部分扫描后停下来提供可选下一步。",
    `7. 使用 \`${initCommand}\` 完成初始化；当项目规范文档需要写入自定义相对路径和文件名时，传入 \`--project-doc-path\`。`,
    "8. 初始化扫描时，必须先覆盖以下固定清单，再判断扫描完成：",
    ...renderScanDimensions(),
    "9. 当用户或代码上下文暴露出稳定约定时，把每条规范单独记录下来。每个适用清单项至少沉淀 1 条有证据支撑的规范，普通项目初始化扫描目标是沉淀 20-40 条规范；不要只挑 3-5 条核心规范就停止，除非项目证据确实不足。",
    ...renderAgentAutoCaptureWorkflow(),
    "11. 如果初始化扫描少于 20 条规范，最终回复必须明确说明是哪些证据不足导致数量较少。",
    `12. 使用 \`${captureCommand}\` 逐条追加规范。`,
    "13. 只要本轮新增了规范、项目状态发生变化、或用户要求初始化/更新规范文档，就在同一轮里继续生成规范文档。",
    `14. 直接执行 \`${buildCommand}\`，除非仍存在高风险决策需要确认。`,
    "15. 只有在高风险场景下才停下来确认：项目身份不确定、可能覆盖重要内容、或存在无法安全自动决策的规范冲突。",
    "16. 不要用“如果你要，我可以继续……”作为收尾；如果下一步低风险且明显属于用户请求范围，就先做完再最终汇报。",
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
    renderIntegration({ runtimeBinDir, skillDir, lang }) {
      const workflow = renderSharedWorkflow({
        scriptFile: join(skillDir, "scripts", "codemem.mjs"),
        lang,
      });
      const description = "当当前 agent 需要初始化 codemem、记录开发规范、默认一轮完成规范更新，或在架构重构、MQ 消费改造、策略工厂、分发处理器等可复用工程约定形成后自动更新规范时使用。";
      const title = "Codemem 项目开发规范";
      const body = [
        `# ${title}`,
        "",
        workflow,
        "",
        "执行规则：",
        "- 默认把当前工作目录视为项目根目录。",
        "- 尽量自动推断项目名称。",
        "- 默认连续完成初始化、规范记录、项目扫描和文档生成，不要拆成多轮确认。",
        "- 初始化扫描必须覆盖固定清单中的每个适用维度；仓库证据支持时，应沉淀 20-40 条规范。",
        "- 不要把明显低风险的后续工作包装成“如果你要，我可以继续”；先做完再最终汇报。",
        "- 只有高风险决策才停下来确认：项目身份不确定、可能覆盖重要内容、或存在无法安全自动决策的规范冲突。",
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
    renderIntegration({ runtimeBinDir, skillDir, lang }) {
      const workflow = renderCursorWorkflow({
        lang,
        globalScriptFile: join(skillDir, "scripts", "codemem.mjs"),
      });
      const installDir = toPosixPath(skillDir);

      const description = "当当前 agent 需要初始化 codemem、记录开发规范、默认一轮完成规范更新，或在架构重构、MQ 消费改造、策略工厂、分发处理器等可复用工程约定形成后自动更新规范时使用。";
      const title = "Codemem 项目开发规范";
      const body = [
        `# ${title}`,
        "",
        `这个 skill 安装在 \`${installDir}\`，提供全局共享的 JavaScript runtime 和模板，供所有项目共用。`,
        "",
        workflow,
        "",
        "执行规则：",
        "- 默认把当前工作目录视为项目根目录。",
        "- 尽量自动推断项目名称。",
        "- 默认连续完成初始化、规范记录、项目扫描和文档生成，不要拆成多轮确认。",
        "- 初始化扫描必须覆盖固定清单中的每个适用维度；仓库证据支持时，应沉淀 20-40 条规范。",
        "- 不要把明显低风险的后续工作包装成“如果你要，我可以继续”；先做完再最终汇报。",
        "- 只有高风险决策才停下来确认：项目身份不确定、可能覆盖重要内容、或存在无法安全自动决策的规范冲突。",
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
      const workflow = renderSharedWorkflow({
        scriptFile: join(runtimeBinDir, "..", "..", "scripts", "codemem.mjs"),
        lang,
      });
      const relRuntime = toPosixPath(runtimeBinDir);
      const installDir = toPosixPath(skillDir);

      return [
        "# /codemem",
        "",
        `这个命令安装在 \`${installDir}\`，使用全局共享的 \`${relRuntime}\` runtime。`,
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
  const sharedSkillDir = agent === "claude-code" ? getDefaultHomeSkillDir() : skillDir;
  const bundle = installSharedSkillBundle(options.rootDir, sharedSkillDir);
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
    const sharedSkillDir = spec.id === "claude-code" ? getDefaultHomeSkillDir() : skillDir;
    const selectionReason = options.skillDir
      ? "explicit_override"
      : detected.selectionReason;
    const integrationPath = spec.integrationPath(targetDir, skillDir);
    const runtimeBinDir = getSharedRuntimeBinDir(sharedSkillDir);
    const templatesDir = getSharedTemplatesDir(sharedSkillDir);
    const scriptFile = join(getSharedScriptsDir(sharedSkillDir), "codemem.mjs");
    const configured = existsSync(integrationPath)
      && existsSync(runtimeBinDir)
      && existsSync(templatesDir)
      && existsSync(scriptFile);

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
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function getSharedSkillDir(agent, resolvedSkillDir) {
  if (agent === "claude-code") {
    return join(getHomeDir(), ".codex", "skills", "codemem");
  }
  return resolvedSkillDir;
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

function renderTemplate(content, replacements) {
  let next = content;
  for (const [key, value] of Object.entries(replacements)) {
    next = next.split(key).join(value);
  }
  return next;
}

function copyTextDir(source, destination, replacements) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    const sourceFile = join(source, entry);
    const destinationFile = join(destination, entry);
    const stat = statSync(sourceFile);
    if (stat.isDirectory()) {
      copyTextDir(sourceFile, destinationFile, replacements);
    } else {
      const content = renderTemplate(readFileSync(sourceFile, "utf8"), replacements);
      mkdirSync(dirname(destinationFile), { recursive: true });
      writeFileSync(destinationFile, content);
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
const sharedSkillDir = getSharedSkillDir(agent, skillDir);
const runtimeSource = join(scriptDir, "runtime");
const templatesSource = join(runtimeSource, "templates");
const binSource = join(runtimeSource, "bin");
const scriptsSource = join(runtimeSource, "scripts");
const integrationSource = join(scriptDir, "integrations", agent);
const runtimeTarget = join(sharedSkillDir, "runtime", "bin");
const templatesTarget = join(sharedSkillDir, "templates");
const scriptsTarget = join(sharedSkillDir, "scripts");
const replacements = {
  "${EXPORT_SKILL_DIR_PLACEHOLDER}": skillDir,
  "${EXPORT_SHARED_SKILL_DIR_PLACEHOLDER}": sharedSkillDir,
  "${EXPORT_TARGET_DIR_PLACEHOLDER}": targetDir,
  "${EXPORT_RUNTIME_BIN_DIR_PLACEHOLDER}": runtimeTarget,
};

rmSync(runtimeTarget, { recursive: true, force: true });
rmSync(templatesTarget, { recursive: true, force: true });
rmSync(scriptsTarget, { recursive: true, force: true });
copyDir(binSource, runtimeTarget);
copyDir(templatesSource, templatesTarget);
copyDir(scriptsSource, scriptsTarget);

let destination = "";
if (agent === "codex" || agent === "cursor") {
  copyTextDir(integrationSource, skillDir, replacements);
  destination = join(skillDir, "SKILL.md");
} else {
  const files = readdirSync(integrationSource);
  if (files.length === 0) {
    throw new Error("No integration files found for agent: " + agent);
  }

  const sourceFile = join(integrationSource, files[0]);
  destination = AGENTS[agent].integrationPath(targetDir, skillDir);
  mkdirSync(dirname(destination), { recursive: true });
  const content = renderTemplate(readFileSync(sourceFile, "utf8"), replacements);
  writeFileSync(destination, content);
}

console.log("Installed ${options.packageName}@${options.version}");
console.log("Agent: " + agent);
console.log("Shared runtime: " + runtimeTarget);
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
  const runtimeScriptsDir = join(runtimeDir, "scripts");
  const integrationsDir = join(packageDir, "integrations");

  rmSync(packageDir, { recursive: true, force: true });
  rmSync(archiveFile, { force: true });
  rmSync(digestFile, { force: true });
  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(runtimeTemplatesDir, { recursive: true });
  mkdirSync(runtimeScriptsDir, { recursive: true });
  mkdirSync(integrationsDir, { recursive: true });

  ensureCompiledRuntime(rootDir);

  for (const binary of RUNTIME_BINARIES) {
    copyFileSync(join(rootDir, "core", "dist", binary), join(runtimeBinDir, binary));
  }
  copyDir(join(rootDir, "skills", "codemem", "templates"), runtimeTemplatesDir);
  copyDir(join(rootDir, "skills", "codemem", "scripts"), runtimeScriptsDir);

  const targetDir = resolve(options.targetDir || process.cwd());
  for (const spec of agentSpecs) {
    if (options.agent && options.agent !== "all" && options.agent !== spec.id) {
      continue;
    }

    const integrationDir = join(integrationsDir, spec.id);
    mkdirSync(integrationDir, { recursive: true });
    const fileName = basename(spec.integrationPath(targetDir, spec.defaultSkillDir(targetDir)));
    const exportRuntimeBinDir = spec.id === "claude-code"
      ? join(EXPORT_SHARED_SKILL_DIR_PLACEHOLDER, "runtime", "bin")
      : EXPORT_RUNTIME_BIN_DIR_PLACEHOLDER;
    writeFileSync(
      join(integrationDir, fileName),
      `${spec.renderIntegration({
        runtimeBinDir: exportRuntimeBinDir,
        targetDir: EXPORT_TARGET_DIR_PLACEHOLDER,
        skillDir: EXPORT_SKILL_DIR_PLACEHOLDER,
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
    "",
    "This package is self-contained. The receiver does not need the codemem source checkout.",
    "",
    "From an extracted package directory:",
    "",
    "  node install.mjs --agent codex --target-dir <project_dir>",
    "  node install.mjs --agent cursor --target-dir <project_dir>",
    "  node install.mjs --agent claude-code --target-dir <project_dir>",
    "",
    "From the archive:",
    "",
    `  tar -xzf ${packageName}-${version}.tgz`,
    `  cd ${packageName}-${version}`,
    "  node install.mjs --agent cursor --target-dir <project_dir>",
    "",
    "Optional:",
    "",
    "  --skill-dir <dir>   override the agent integration install directory",
    "",
    "Installed files:",
    "",
    "  Codex/Cursor: ~/.codex/skills/codemem/",
    "  Claude Code: <project_dir>/.claude/commands/codemem.md by default",
    "",
    "After installation, use the codemem skill from the selected agent in the target project.",
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
