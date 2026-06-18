#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const COPY = {
  zh: {
    noRules: "- 暂无规范条目。\n",
    noConflicts: "- 暂未发现冲突。\n",
    duplicateSummary: "去重后保留 {{kept}} 条，隐藏 {{hidden}} 条重复记录。",
    conflictHeader: "| 范围 | 类型 | 标题 | 规则 |\n|---|---|---|---|\n",
    summaryHeader: "| 指标 | 数量 |\n|---|---:|\n",
    generated: "生成时间",
    activeRules: "有效规范",
    conflicts: "冲突项",
    duplicates: "重复项",
    drafts: "草稿",
    deprecated: "已废弃",
    reportTitle: "# 规范冲突报告",
    dedupeTitle: "## 去重说明",
  },
};

const PRIORITY_RANK = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
]);

const AGENTS_MANAGED_START = "<!-- codemem:managed:start -->";
const AGENTS_MANAGED_END = "<!-- codemem:managed:end -->";

const REQUIRED_SCAN_DIMENSIONS = [
  "整体目录结构规范",
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

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
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

function required(args, key) {
  const value = args.get(key);
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function getRootDir(args) {
  return resolve(args.get("root") || process.cwd());
}

function getGlobalCodememDir() {
  if (process.env.CODEMEM_GLOBAL_DIR) return resolve(process.env.CODEMEM_GLOBAL_DIR);
  if (process.env.CODEMEM_HOME) return resolve(dirname(process.env.CODEMEM_HOME));
  return join(process.env.HOME || "", ".codemem");
}

function safePathPart(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function getProjectStateKey(rootDir) {
  const resolved = resolve(rootDir);
  const slug = safePathPart(basename(resolved));
  const hash = createHash("sha256").update(resolved).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

function getStateDir(rootDir) {
  return join(getGlobalCodememDir(), "projects", getProjectStateKey(rootDir));
}

function getDocsDir(rootDir) {
  return join(getStateDir(rootDir), "docs");
}

function getGlobalDocsDir(rootDir) {
  return join(getDocsDir(rootDir), "global");
}

function getProjectDocsDir(rootDir) {
  return join(getDocsDir(rootDir), "projects");
}

function getReportsDir(rootDir) {
  return join(getDocsDir(rootDir), "reports");
}

function getSystemDir(rootDir) {
  return join(getStateDir(rootDir), "_system");
}

function getLogsDir(rootDir) {
  return join(getSystemDir(rootDir), "logs", "standards");
}

function getMetaDir(rootDir) {
  return join(getSystemDir(rootDir), "meta", "standards");
}

function getRegistryDir(rootDir) {
  return join(getSystemDir(rootDir), "registry");
}

function getGlobalProjectsRegistryFile() {
  return join(getGlobalCodememDir(), "_system", "registry", "projects-registry.json");
}

function getProjectMarkerFile(rootDir) {
  return join(getStateDir(rootDir), "project.json");
}

function getGlobalStandardFile(rootDir) {
  return join(getGlobalDocsDir(rootDir), "global-standard.md");
}

function getDefaultProjectStandardRelativePath(project) {
  return `docs/spec/project-standard.${project}.md`;
}

function normalizeProjectDocPath(value) {
  if (value === undefined || String(value).trim() === "") return undefined;
  const input = String(value).trim().replaceAll("\\", "/");
  const hasWindowsDrive = /^[A-Za-z]:\//.test(input);
  if (isAbsolute(input) || hasWindowsDrive || input.endsWith("/")) {
    throw new Error("projectDocPath must be a safe relative file path inside the project");
  }
  const normalized = normalize(input).replaceAll("\\", "/");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("projectDocPath must be a safe relative file path inside the project");
  }
  return normalized;
}

function getProjectStandardRelativePath(rootDir, project, projectDocPath) {
  const explicit = normalizeProjectDocPath(projectDocPath);
  if (explicit) return explicit;
  const marker = loadJson(getProjectMarkerFile(rootDir), null);
  const fromMarker = marker && typeof marker.projectDocPath === "string"
    ? normalizeProjectDocPath(marker.projectDocPath)
    : undefined;
  if (fromMarker) return fromMarker;
  const legacyMarker = loadJson(join(rootDir, ".codemem-project.json"), null);
  const fromLegacyMarker = legacyMarker && typeof legacyMarker.projectDocPath === "string"
    ? normalizeProjectDocPath(legacyMarker.projectDocPath)
    : undefined;
  return fromLegacyMarker || getDefaultProjectStandardRelativePath(project);
}

function getProjectStandardFile(rootDir, project, projectDocPath) {
  return join(rootDir, getProjectStandardRelativePath(rootDir, project, projectDocPath));
}

function getStandardsConflictsFile(rootDir) {
  return join(getReportsDir(rootDir), "standards-conflicts.md");
}

function getTemplatesDir() {
  if (process.env.CODEMEM_TEMPLATES_DIR) return process.env.CODEMEM_TEMPLATES_DIR;
  return resolve(scriptDir, "..", "templates");
}

function copyInto(sourcePath, targetPath) {
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
}

function moveFileIfPresent(sourcePath, targetPath) {
  if (!existsSync(sourcePath) || existsSync(targetPath)) return;
  copyInto(sourcePath, targetPath);
  rmSync(sourcePath, { recursive: true, force: true });
}

function mergeDirectoryIfPresent(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) return;
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    if (!existsSync(targetPath)) copyInto(sourcePath, targetPath);
  }
  rmSync(sourceDir, { recursive: true, force: true });
}

function migrateLegacyStateLayout(rootDir) {
  const legacyStateDir = join(rootDir, ".codemem");
  if (!existsSync(legacyStateDir)) return;

  mergeDirectoryIfPresent(join(legacyStateDir, ".standards-logs"), getLogsDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, ".standards-meta"), getMetaDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "logs", "standards"), getLogsDir(rootDir));
  mergeDirectoryIfPresent(join(legacyStateDir, "_system", "meta", "standards"), getMetaDir(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "global", "global-standard.md"), getGlobalStandardFile(rootDir));
  moveFileIfPresent(join(legacyStateDir, "docs", "reports", "standards-conflicts.md"), getStandardsConflictsFile(rootDir));

  const legacyProjectsDir = join(legacyStateDir, "docs", "projects");
  if (existsSync(legacyProjectsDir)) {
    for (const entry of readdirSync(legacyProjectsDir)) {
      if (!entry.endsWith(".md")) continue;
      const project = basename(entry, ".md").replace(/^project-standard\./, "").replace(/^PROJECT_STANDARD\./, "");
      moveFileIfPresent(join(legacyProjectsDir, entry), getProjectStandardFile(rootDir, project));
    }
  }

  rmSync(legacyStateDir, { recursive: true, force: true });
}

function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(file, value) {
  ensureDir(dirname(file));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function upsertProject(rootDir, record) {
  const registryFile = getGlobalProjectsRegistryFile();
  const registry = loadJson(registryFile, {
    schema: 1,
    updatedAt: nowIso(),
    projects: [],
  });
  const normalized = {
    ...record,
    lastUpdatedAt: nowIso(),
    status: record.status || "configured",
  };
  const index = registry.projects.findIndex((item) => {
    if (item.project !== normalized.project) return false;
    if (item.projectPath && normalized.projectPath) return item.projectPath === normalized.projectPath;
    return true;
  });
  if (index === -1) {
    registry.projects.push(normalized);
  } else {
    registry.projects[index] = { ...registry.projects[index], ...normalized };
  }
  registry.updatedAt = nowIso();
  saveJson(registryFile, registry);
  saveJson(getProjectMarkerFile(rootDir), {
    schema: 1,
    tool: "codemem",
    enabled: true,
    project: normalized.project,
    owner: normalized.owner,
    mode: normalized.mode,
    sourceProject: normalized.sourceProject,
    packageId: normalized.packageId,
    packageVersion: normalized.packageVersion,
    configuredAt: normalized.configuredAt,
    lastUpdatedAt: normalized.lastUpdatedAt,
    status: normalized.status,
    standardsPolicyVersion: 1,
    ...(normalized.projectDocPath ? { projectDocPath: normalized.projectDocPath } : {}),
  });
  rmSync(join(rootDir, ".codemem-project.json"), { force: true });
}

function normalizeText(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line);
        return [{
          schema: Number(item.schema || 1),
          ts: item.ts || "",
          project: item.project || basename(file, ".jsonl"),
          type: item.type || "general",
          title: item.title || "Untitled",
          rule: item.rule || "",
          priority: item.priority || "P2",
          status: item.status || "active",
          scope: item.scope || "project",
          source: item.source || "manual",
          lang: item.lang || "zh",
        }];
      } catch {
        return [];
      }
    })
    .filter((item) => item.rule.trim());
}

function readAllRules(rootDir) {
  const logsDir = getLogsDir(rootDir);
  ensureDir(logsDir);
  return readdirSync(logsDir)
    .filter((file) => file.endsWith(".jsonl"))
    .flatMap((file) => parseJsonl(join(logsDir, file)));
}

function dedupeRules(rules) {
  const exact = new Map();
  const duplicates = [];
  for (const rule of rules) {
    const key = [
      rule.project,
      rule.scope,
      rule.type,
      normalizeText(rule.title),
      normalizeText(rule.rule),
      rule.status,
    ].join("|");
    const existing = exact.get(key);
    if (!existing || rule.ts > existing.ts) {
      if (existing) duplicates.push(existing);
      exact.set(key, rule);
    } else {
      duplicates.push(rule);
    }
  }
  return { rules: [...exact.values()], duplicates };
}

function sortRules(rules) {
  return [...rules].sort((left, right) => {
    const diff = (PRIORITY_RANK.get(left.priority) ?? 99) - (PRIORITY_RANK.get(right.priority) ?? 99);
    if (diff !== 0) return diff;
    return [left.type, left.title, left.project].join("|").localeCompare([right.type, right.title, right.project].join("|"));
  });
}

function findConflicts(rules) {
  const groups = new Map();
  for (const rule of rules.filter((item) => item.status === "active")) {
    const key = [
      rule.scope,
      rule.scope === "project" ? rule.project : "global",
      rule.type,
      normalizeText(rule.title),
    ].join("|");
    const group = groups.get(key) || [];
    group.push(rule);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((items) => {
      const unique = new Map(items.map((item) => [normalizeText(item.rule), item]));
      return unique.size > 1 ? [...unique.values()] : null;
    })
    .filter(Boolean);
}

function renderRules(rules, noRules, globalMode = false) {
  const active = sortRules(rules.filter((rule) => rule.status === "active"));
  if (active.length === 0) return noRules;
  return `${active.map((rule) => {
    const prefix = globalMode
      ? `[${rule.project}][${rule.scope}][${rule.type}][${rule.priority}]`
      : `[${rule.scope}][${rule.type}][${rule.priority}]`;
    return `- ${prefix} **${rule.title}**: ${rule.rule}`;
  }).join("\n")}\n`;
}

function renderRulesByType(rules, type, noRules, globalMode = false) {
  return renderRules(rules.filter((rule) => rule.type === type), noRules, globalMode);
}

function renderStatusRules(rules, status, noRules) {
  const filtered = sortRules(rules.filter((rule) => rule.status === status));
  if (filtered.length === 0) return noRules;
  return `${filtered.map((rule) => `- [${rule.type}][${rule.priority}] **${rule.title}**: ${rule.rule}`).join("\n")}\n`;
}

function renderConflicts(conflicts, noConflicts, header) {
  if (conflicts.length === 0) return noConflicts;
  return `${header}${conflicts.map((items) => {
    const first = items[0];
    const rules = items.map((item) => `${item.project}: ${item.rule}`).join("<br>");
    return `| ${first.scope} | ${first.type} | ${first.title} | ${rules} |`;
  }).join("\n")}\n`;
}

function renderSummary(rules, conflicts, duplicates, strings) {
  const active = rules.filter((rule) => rule.status === "active").length;
  const drafts = rules.filter((rule) => rule.status === "draft").length;
  const deprecated = rules.filter((rule) => rule.status === "deprecated").length;
  return strings.summaryHeader +
    `| ${strings.activeRules} | ${active} |\n` +
    `| ${strings.conflicts} | ${conflicts.length} |\n` +
    `| ${strings.duplicates} | ${duplicates.length} |\n` +
    `| ${strings.drafts} | ${drafts} |\n` +
    `| ${strings.deprecated} | ${deprecated} |\n`;
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function renderRequiredScanDimensions() {
  return REQUIRED_SCAN_DIMENSIONS.map((item) => `  - ${item}`);
}

function renderAutoCaptureSignals() {
  return [
    "  - 架构或设计模式重构",
    "  - 将 if/else 或 switch 分发替换为策略、工厂、处理器、注册表或模板方法",
    "  - 将 MQ 或事件消费者分支改造成 topic 工厂、tag 策略、处理器注册表或其他可复用分发机制",
    "  - 抽取可复用模块边界、分层职责或领域服务拆分",
    "  - 将不一致实现统一为共享机制、基类、适配器或编排流程",
    "  - 为 MQ 消费者、事件、任务、调度器、控制器或服务编排引入稳定约定",
    "  - 统一错误处理、校验、日志、幂等、重试、超时或降级行为",
    "  - 重设计仓储、缓存、RPC、HTTP 客户端或持久化访问模式",
    "  - 引入共享命名、包结构、配置或依赖注入约定",
    "  - 重组项目结构、模块边界、构建布局或部署集成",
    "  - 定义可复用测试、mock、fixture、契约或迁移模式",
  ];
}

function renderAgentsSection(project, projectDocPath, globalDocPath, conflictsDocPath) {
  return [
    AGENTS_MANAGED_START,
    "## Codemem 开发规范",
    "",
    "在修改代码、做架构决策或提出工作流建议前，先读取以下文件（如果存在）：",
    "",
    `1. \`${globalDocPath}\``,
    `2. \`${projectDocPath}\``,
    `3. \`${conflictsDocPath}\``,
    "",
    "行为规则：",
    "",
    "- 将项目规范视为当前项目最贴近的事实来源。",
    "- 将全局规范视为跨项目的默认基线。",
    "- 如果冲突报告中存在未解决的矛盾，不要静默选择其一；当选择会影响实现时，明确说明冲突并请求确认。",
    "- 如果规范文档缺失，先通过本地 codemem CLI 初始化或重新生成，再依赖未明说的约定。",
    "- 默认在同一轮完成初始化、规范记录和文档重新生成。",
    "- 初始化扫描时，必须覆盖以下固定清单后再判断扫描完成：",
    ...renderRequiredScanDimensions(),
    "- 初始化之外，当任务形成可复用工程约定时，也要主动记录并重新生成规范文档，尤其包括：",
    ...renderAutoCaptureSignals(),
    "- 不要求用户显式提到 codemem；只要架构重构或代码改造沉淀出了稳定约定，就记录这些规范。",
    "- 当以上信号出现且实现落成了可复用约定时，在最终回复前记录对应规范并重新生成规范文档。",
    "- 不要把架构或重构产生的规范记录当成代码改完后的可选后续事项。",
    "- 每个适用清单项至少沉淀 1 条有证据支撑的规范；普通项目初始化扫描目标是沉淀 20-40 条规范。如果少于 20 条，说明缺少哪些证据。",
    "- 不要用“如果你要，我可以继续……”作为明显低风险工作的收尾；如果下一步明显属于用户请求范围，就先完成再最终汇报。",
    "- 只有在项目身份不确定、变更可能覆盖重要内容、或规范冲突无法安全自动决策时才暂停确认。",
    AGENTS_MANAGED_END,
    "",
  ].join("\n");
}

function syncAgentsGuide(rootDir, project, projectDocPath) {
  const agentsFile = join(rootDir, "AGENTS.md");
  const managedSection = renderAgentsSection(project, projectDocPath, getGlobalStandardFile(rootDir), getStandardsConflictsFile(rootDir));
  if (!existsSync(agentsFile)) {
    writeFileSync(agentsFile, [
      "# AGENTS.md",
      "",
      "本项目使用 codemem 沉淀并执行开发规范。",
      "",
      managedSection,
    ].join("\n"));
    return agentsFile;
  }

  const existing = readFileSync(agentsFile, "utf8");
  if (existing.includes(AGENTS_MANAGED_START) && existing.includes(AGENTS_MANAGED_END)) {
    const next = existing.replace(
      new RegExp(`${AGENTS_MANAGED_START}[\\s\\S]*?${AGENTS_MANAGED_END}`),
      managedSection.trimEnd(),
    );
    writeFileSync(agentsFile, next.endsWith("\n") ? next : `${next}\n`);
    return agentsFile;
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  writeFileSync(agentsFile, `${existing}${separator}${managedSection}`);
  return agentsFile;
}

function syncCursorRule(rootDir, project, projectDocPath) {
  const ruleFile = join(rootDir, ".cursor", "rules", "codemem-standards.mdc");
  ensureDir(dirname(ruleFile));
  writeFileSync(ruleFile, [
    "---",
    "description: Codemem 开发规范引导",
    "alwaysApply: false",
    "---",
    "",
    "# Codemem 开发规范",
    "",
    "回答实现问题或编辑代码前，先读取以下文件（如果存在）：",
    "",
    `1. \`${getGlobalStandardFile(rootDir)}\``,
    `2. \`${projectDocPath}\``,
    `3. \`${getStandardsConflictsFile(rootDir)}\``,
    "",
    "在提出代码或工作流改动前，将这些文档作为当前项目的默认约束。",
    "",
    "默认在同一轮完成初始化、规范记录和文档重新生成。",
    "初始化扫描时，必须覆盖以下固定清单后再判断扫描完成：",
    ...renderRequiredScanDimensions(),
    "初始化之外，当任务形成可复用工程约定时，也要主动记录并重新生成规范文档，尤其包括：",
    ...renderAutoCaptureSignals(),
    "不要求用户显式提到 codemem；只要架构重构或代码改造沉淀出了稳定约定，就记录这些规范。",
    "当以上信号出现且实现落成了可复用约定时，在最终回复前记录对应规范并重新生成规范文档。",
    "不要把架构或重构产生的规范记录当成代码改完后的可选后续事项。",
    "每个适用清单项至少沉淀 1 条有证据支撑的规范；普通项目初始化扫描目标是沉淀 20-40 条规范。如果少于 20 条，说明缺少哪些证据。",
    "不要用“如果你要，我可以继续……”作为明显低风险工作的收尾；如果下一步明显属于用户请求范围，就先完成再最终汇报。",
    "只有在项目身份不确定、变更可能覆盖重要内容、或规范冲突无法安全自动决策时才暂停确认。",
    "",
  ].join("\n"));
  return ruleFile;
}

function syncGitignore(rootDir) {
  const gitignoreFile = join(rootDir, ".gitignore");
  return gitignoreFile;
}

function initProject(args) {
  const rootDir = getRootDir(args);
  migrateLegacyStateLayout(rootDir);
  const project = required(args, "project");
  const owner = args.get("owner") || "unknown";
  const projectPath = resolve(args.get("project-path") || rootDir);
  const projectDocPath = getProjectStandardRelativePath(rootDir, project, args.get("project-doc-path"));
  const metaDir = getMetaDir(rootDir);
  const logsDir = getLogsDir(rootDir);
  ensureDir(metaDir);
  ensureDir(logsDir);

  const createdAt = nowIso();
  const metaFile = join(metaDir, `${project}.env`);
  const logFile = join(logsDir, `${project}.jsonl`);
  writeFileSync(metaFile, [
    `PROJECT=${project}`,
    `OWNER=${owner}`,
    `PROJECT_PATH=${projectPath}`,
    `INITIALIZED_AT=${createdAt}`,
  ].join("\n") + "\n");
  if (!existsSync(logFile)) writeFileSync(logFile, "");

  upsertProject(rootDir, {
    project,
    owner,
    mode: "local",
    projectPath,
    packageId: "",
    packageVersion: "",
    packageFile: "",
    sourceProject: "",
    configuredAt: createdAt,
    projectDocPath,
  });

  const agentsFile = syncAgentsGuide(rootDir, project, projectDocPath);
  const cursorRuleFile = syncCursorRule(rootDir, project, projectDocPath);
  const gitignoreFile = syncGitignore(rootDir);
  const projectMarkerFile = getProjectMarkerFile(rootDir);
  const globalRegistryFile = getGlobalProjectsRegistryFile();

  console.log(`Initialized project '${project}'`);
  console.log(`Meta: ${metaFile}`);
  console.log(`Log:  ${logFile}`);
  console.log(`Agents guide: ${agentsFile}`);
  console.log(`Cursor rule: ${cursorRuleFile}`);
  console.log(`Git ignore: ${gitignoreFile}`);
  console.log(`Project marker: ${projectMarkerFile}`);
  console.log(`Global registry: ${globalRegistryFile}`);
}

function captureRule(args) {
  const rootDir = getRootDir(args);
  migrateLegacyStateLayout(rootDir);
  const project = required(args, "project");
  const title = required(args, "title");
  const logsDir = getLogsDir(rootDir);
  ensureDir(logsDir);
  const logFile = join(logsDir, `${project}.jsonl`);
  const line = JSON.stringify({
    schema: 2,
    ts: nowIso(),
    project,
    type: required(args, "type"),
    title,
    rule: required(args, "rule"),
    priority: args.get("priority") || "P2",
    status: args.get("status") || "active",
    scope: args.get("scope") || "project",
    source: args.get("source") || "manual",
    lang: args.get("lang") || "zh",
  });
  writeFileSync(logFile, `${existsSync(logFile) ? readFileSync(logFile, "utf8") : ""}${line}\n`);
  console.log(`Captured standard for '${project}': ${title}`);
}

function buildStandards(args) {
  const rootDir = getRootDir(args);
  migrateLegacyStateLayout(rootDir);
  const project = required(args, "project");
  const lang = args.get("lang") || "zh";
  const includeDrafts = args.get("include-drafts") === "true";
  const strings = COPY.zh;
  ensureDir(getGlobalDocsDir(rootDir));
  ensureDir(getProjectDocsDir(rootDir));
  ensureDir(getReportsDir(rootDir));

  const projectLog = join(getLogsDir(rootDir), `${project}.jsonl`);
  if (!existsSync(projectLog)) {
    throw new Error(`Project log not found: ${projectLog}`);
  }

  const allRulesRaw = readAllRules(rootDir);
  const { rules: allRules, duplicates } = dedupeRules(allRulesRaw);
  const visibleRules = includeDrafts ? allRules : allRules.filter((rule) => rule.status !== "draft");
  const projectRules = visibleRules.filter((rule) => rule.project === project);
  const projectAllRules = allRules.filter((rule) => rule.project === project);
  const conflicts = findConflicts(visibleRules);
  const projectConflicts = conflicts.filter((items) => items.some((item) => item.project === project));
  const duplicateSummary = strings.duplicateSummary
    .replace("{{kept}}", String(allRules.length))
    .replace("{{hidden}}", String(duplicates.length));

  const common = {
    GENERATED_AT: nowIso(),
    PROJECT_NAME: project,
    SUMMARY: renderSummary(allRules, conflicts, duplicates, strings),
    PROJECT_SUMMARY: renderSummary(projectAllRules, projectConflicts, duplicates.filter((rule) => rule.project === project), strings),
    DUPLICATE_SUMMARY: duplicateSummary,
    CONFLICTS: renderConflicts(conflicts, strings.noConflicts, strings.conflictHeader),
    PROJECT_CONFLICTS: renderConflicts(projectConflicts, strings.noConflicts, strings.conflictHeader),
    DRAFT_RULES: renderStatusRules(projectAllRules, "draft", strings.noRules),
    DEPRECATED_RULES: renderStatusRules(projectAllRules, "deprecated", strings.noRules),
    GENERAL_RULES: renderRulesByType(projectRules, "general", strings.noRules, false),
    ARCHITECTURE_RULES: renderRulesByType(projectRules, "architecture", strings.noRules, false),
    CODE_RULES: renderRulesByType(projectRules, "code", strings.noRules, false),
    API_RULES: renderRulesByType(projectRules, "api", strings.noRules, false),
    DATA_RULES: renderRulesByType(projectRules, "data", strings.noRules, false),
    SECURITY_RULES: renderRulesByType(projectRules, "security", strings.noRules, false),
    TESTING_RULES: renderRulesByType(projectRules, "testing", strings.noRules, false),
    DOCS_RULES: renderRulesByType(projectRules, "docs", strings.noRules, false),
    OPS_RULES: renderRulesByType(projectRules, "ops", strings.noRules, false),
    RELEASE_RULES: renderRulesByType(projectRules, "release", strings.noRules, false),
    GLOBAL_GENERAL_RULES: renderRulesByType(visibleRules, "general", strings.noRules, true),
    GLOBAL_ARCHITECTURE_RULES: renderRulesByType(visibleRules, "architecture", strings.noRules, true),
    GLOBAL_CODE_RULES: renderRulesByType(visibleRules, "code", strings.noRules, true),
    GLOBAL_API_RULES: renderRulesByType(visibleRules, "api", strings.noRules, true),
    GLOBAL_DATA_RULES: renderRulesByType(visibleRules, "data", strings.noRules, true),
    GLOBAL_SECURITY_RULES: renderRulesByType(visibleRules, "security", strings.noRules, true),
    GLOBAL_TESTING_RULES: renderRulesByType(visibleRules, "testing", strings.noRules, true),
    GLOBAL_DOCS_RULES: renderRulesByType(visibleRules, "docs", strings.noRules, true),
    GLOBAL_OPS_RULES: renderRulesByType(visibleRules, "ops", strings.noRules, true),
    GLOBAL_RELEASE_RULES: renderRulesByType(visibleRules, "release", strings.noRules, true),
    GLOBAL_RULES: renderRules(visibleRules, strings.noRules, true),
    PROJECT_RULES: renderRules(projectRules, strings.noRules, false),
  };

  const templatesDir = getTemplatesDir();
  const projectTemplate = readFileSync(join(templatesDir, "project-standard.zh.template.md"), "utf8");
  const globalTemplate = readFileSync(join(templatesDir, "global-standard.zh.template.md"), "utf8");
  const projectOutput = getProjectStandardFile(rootDir, project);
  const globalOutput = getGlobalStandardFile(rootDir);
  const conflictsOutput = getStandardsConflictsFile(rootDir);

  ensureDir(dirname(projectOutput));
  writeFileSync(projectOutput, renderTemplate(projectTemplate, common));
  writeFileSync(globalOutput, renderTemplate(globalTemplate, common));
  writeFileSync(conflictsOutput, [
    strings.reportTitle,
    "",
    `${strings.generated}: ${nowIso()}`,
    "",
    "## 冲突检测",
    "",
    renderConflicts(projectConflicts, strings.noConflicts, strings.conflictHeader),
    "",
    strings.dedupeTitle,
    "",
    duplicateSummary,
    "",
  ].join("\n"));

  for (const file of [globalOutput, projectOutput, conflictsOutput]) {
    console.log(`Generated: ${file}`);
  }
}

function usage() {
  return [
    "codemem skill runtime",
    "",
    "Usage:",
    "  node codemem.mjs init --root <project_root> --project <name> --owner <owner> --project-path <project_root> [--project-doc-path <relative_md_path>]",
    "  node codemem.mjs capture --root <project_root> --project <name> --type <type> --title <title> --rule <rule>",
    "  node codemem.mjs build --root <project_root> --project <name> --lang zh",
  ].join("\n");
}

try {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    process.exit(0);
  }

  const args = parseArgs(rest);
  if (command === "init") {
    initProject(args);
  } else if (command === "capture") {
    captureRule(args);
  } else if (command === "build") {
    buildStandards(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error(usage());
  process.exit(1);
}
