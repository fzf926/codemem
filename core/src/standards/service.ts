import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ensureDir } from "../shared/fs";
import {
  getGlobalDocsDir,
  getGlobalStandardFile,
  getLogsDir,
  getMetaDir,
  getProjectDocsDir,
  getProjectStandardFile,
  getReportsDir,
  getStandardsConflictsFile,
  getTemplatesDir,
} from "../shared/paths";
import { nowIso } from "../shared/time";
import { migrateLegacyStateLayout } from "../shared/state-layout";
import { upsertProject } from "../registry/service";

export interface InitOptions {
  rootDir: string;
  project: string;
  owner: string;
  projectPath: string;
}

export interface CaptureOptions {
  rootDir: string;
  project: string;
  type: string;
  title: string;
  rule: string;
  priority: string;
  status: string;
  scope: string;
  source: string;
  lang: string;
}

export interface BuildOptions {
  rootDir: string;
  project: string;
  lang: string;
  includeDrafts: boolean;
}

interface Rule {
  schema: number;
  ts: string;
  project: string;
  type: string;
  title: string;
  rule: string;
  priority: string;
  status: string;
  scope: string;
  source: string;
  lang: string;
}

const priorityRank = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
]);

const copy = {
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
  en: {
    noRules: "- No rules captured yet.\n",
    noConflicts: "- No conflicts detected.\n",
    duplicateSummary: "Kept {{kept}} rules after dedupe, hid {{hidden}} duplicate records.",
    conflictHeader: "| Scope | Type | Title | Rules |\n|---|---|---|---|\n",
    summaryHeader: "| Metric | Count |\n|---|---:|\n",
    generated: "Generated at",
    activeRules: "Active rules",
    conflicts: "Conflicts",
    duplicates: "Duplicates",
    drafts: "Drafts",
    deprecated: "Deprecated",
    reportTitle: "# Standards Conflict Report",
    dedupeTitle: "## Dedupe",
  },
} as const;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseJsonl(file: string): Rule[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line) as Partial<Rule>;
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

function readAllRules(rootDir: string): Rule[] {
  const logsDir = getLogsDir(rootDir);
  ensureDir(logsDir);
  return readdirSync(logsDir)
    .filter((file) => file.endsWith(".jsonl"))
    .flatMap((file) => parseJsonl(join(logsDir, file)));
}

function dedupeRules(rules: Rule[]): { rules: Rule[]; duplicates: Rule[] } {
  const exact = new Map<string, Rule>();
  const duplicates: Rule[] = [];
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

function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((left, right) => {
    const diff = (priorityRank.get(left.priority) ?? 99) - (priorityRank.get(right.priority) ?? 99);
    if (diff !== 0) return diff;
    return [left.type, left.title, left.project].join("|").localeCompare([right.type, right.title, right.project].join("|"));
  });
}

function findConflicts(rules: Rule[]) {
  const groups = new Map<string, Rule[]>();
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
    .filter((item): item is Rule[] => Boolean(item));
}

function renderRules(rules: Rule[], noRules: string, globalMode = false): string {
  const active = sortRules(rules.filter((rule) => rule.status === "active"));
  if (active.length === 0) return noRules;
  return `${active.map((rule) => {
    const prefix = globalMode
      ? `[${rule.project}][${rule.scope}][${rule.type}][${rule.priority}]`
      : `[${rule.scope}][${rule.type}][${rule.priority}]`;
    return `- ${prefix} **${rule.title}**: ${rule.rule}`;
  }).join("\n")}\n`;
}

function renderRulesByType(rules: Rule[], type: string, noRules: string, globalMode = false): string {
  return renderRules(rules.filter((rule) => rule.type === type), noRules, globalMode);
}

function renderStatusRules(rules: Rule[], status: string, noRules: string): string {
  const filtered = sortRules(rules.filter((rule) => rule.status === status));
  if (filtered.length === 0) return noRules;
  return `${filtered.map((rule) => `- [${rule.type}][${rule.priority}] **${rule.title}**: ${rule.rule}`).join("\n")}\n`;
}

function renderConflicts(conflicts: Rule[][], noConflicts: string, header: string): string {
  if (conflicts.length === 0) return noConflicts;
  return `${header}${conflicts.map((items) => {
    const first = items[0];
    const rules = items.map((item) => `${item.project}: ${item.rule}`).join("<br>");
    return `| ${first.scope} | ${first.type} | ${first.title} | ${rules} |`;
  }).join("\n")}\n`;
}

function renderSummary(rules: Rule[], conflicts: Rule[][], duplicates: Rule[], strings: typeof copy.zh): string {
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

function loadTemplate(rootDir: string, fileName: string): string {
  const templateFile = join(getTemplatesDir(rootDir), fileName);
  return readFileSync(templateFile, "utf8");
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
    template,
  );
}

const AGENTS_MANAGED_START = "<!-- codemem:managed:start -->";
const AGENTS_MANAGED_END = "<!-- codemem:managed:end -->";

function renderAgentsSection(project: string): string {
  return [
    AGENTS_MANAGED_START,
    "## Codemem Standards",
    "",
    "Before making code changes, architecture decisions, or workflow recommendations, read these files when they exist:",
    "",
    "1. `.codemem/docs/global/global-standard.md`",
    `2. \`.codemem/docs/projects/project-standard.${project}.md\``,
    "3. `.codemem/docs/reports/standards-conflicts.md`",
    "",
    "Behavior rules:",
    "",
    "- Treat the project standard as the closest project-specific source of truth.",
    "- Treat the global standard as the default cross-project baseline.",
    "- If the conflict report shows unresolved contradictions, do not silently pick one. Call out the conflict and ask for confirmation when the choice matters.",
    "- If standards docs are missing, initialize or regenerate them through the local codemem CLI before relying on unstated conventions.",
    "- Default to finishing initialization, standards capture, and document regeneration in one pass.",
    "- Do not end with optional follow-up offers for obvious low-risk work. If the next step is clearly part of the user's request, complete it before the final response.",
    "- Only pause for confirmation when project identity is uncertain, a change would overwrite meaningful user content, or a standards conflict cannot be resolved safely.",
    AGENTS_MANAGED_END,
    "",
  ].join("\n");
}

function syncAgentsGuide(rootDir: string, project: string): string {
  const agentsFile = join(rootDir, "AGENTS.md");
  const managedSection = renderAgentsSection(project);

  if (!existsSync(agentsFile)) {
    writeFileSync(agentsFile, [
      "# AGENTS.md",
      "",
      "This project uses codemem to capture and enforce development standards.",
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

function syncCursorRule(rootDir: string, project: string): string {
  const ruleFile = join(rootDir, ".cursor", "rules", "codemem-standards.mdc");
  ensureDir(dirname(ruleFile));
  writeFileSync(ruleFile, [
    "---",
    "description: Codemem standards bootstrap",
    "alwaysApply: false",
    "---",
    "",
    "# Codemem Standards",
    "",
    "Before answering implementation questions or editing code, read these files when they exist:",
    "",
    "1. `.codemem/docs/global/global-standard.md`",
    `2. \`.codemem/docs/projects/project-standard.${project}.md\``,
    "3. `.codemem/docs/reports/standards-conflicts.md`",
    "",
    "Use those documents as the default project conventions before proposing code or workflow changes.",
    "",
    "Default to finishing initialization, standards capture, and document regeneration in one pass.",
    "Do not end with optional follow-up offers for obvious low-risk work. If the next step is clearly part of the user's request, complete it before the final response.",
    "Only pause for confirmation when project identity is uncertain, a change would overwrite meaningful user content, or a standards conflict cannot be resolved safely.",
    "",
  ].join("\n"));
  return ruleFile;
}

export function initProject(options: InitOptions): { metaFile: string; logFile: string; agentsFile: string; cursorRuleFile: string } {
  migrateLegacyStateLayout(options.rootDir);
  const metaDir = getMetaDir(options.rootDir);
  const logsDir = getLogsDir(options.rootDir);
  ensureDir(metaDir);
  ensureDir(logsDir);

  const createdAt = nowIso();
  const metaFile = join(metaDir, `${options.project}.env`);
  const logFile = join(logsDir, `${options.project}.jsonl`);

  writeFileSync(metaFile, [
    `PROJECT=${options.project}`,
    `OWNER=${options.owner}`,
    `PROJECT_PATH=${options.projectPath}`,
    `INITIALIZED_AT=${createdAt}`,
  ].join("\n") + "\n");

  if (!existsSync(logFile)) {
    writeFileSync(logFile, "");
  }

  upsertProject(options.rootDir, {
    project: options.project,
    owner: options.owner,
    mode: "local",
    projectPath: options.projectPath,
    packageId: "",
    packageVersion: "",
    packageFile: "",
    sourceProject: "",
    configuredAt: createdAt,
  });

  const agentsFile = syncAgentsGuide(options.rootDir, options.project);
  const cursorRuleFile = syncCursorRule(options.rootDir, options.project);

  return { metaFile, logFile, agentsFile, cursorRuleFile };
}

export function captureRule(options: CaptureOptions): string {
  migrateLegacyStateLayout(options.rootDir);
  const logsDir = getLogsDir(options.rootDir);
  ensureDir(logsDir);
  const logFile = join(logsDir, `${options.project}.jsonl`);
  const line = JSON.stringify({
    schema: 2,
    ts: nowIso(),
    project: options.project,
    type: options.type,
    title: options.title,
    rule: options.rule,
    priority: options.priority,
    status: options.status,
    scope: options.scope,
    source: options.source,
    lang: options.lang,
  });
  writeFileSync(logFile, `${existsSync(logFile) ? readFileSync(logFile, "utf8") : ""}${line}\n`);
  return logFile;
}

export function buildStandards(options: BuildOptions): string[] {
  migrateLegacyStateLayout(options.rootDir);
  const strings = options.lang === "en" ? copy.en : copy.zh;
  ensureDir(getGlobalDocsDir(options.rootDir));
  ensureDir(getProjectDocsDir(options.rootDir));
  ensureDir(getReportsDir(options.rootDir));

  const projectLog = join(getLogsDir(options.rootDir), `${options.project}.jsonl`);
  if (!existsSync(projectLog)) {
    throw new Error(`Project log not found: ${projectLog}`);
  }

  const allRulesRaw = readAllRules(options.rootDir);
  const { rules: allRules, duplicates } = dedupeRules(allRulesRaw);
  const visibleRules = options.includeDrafts ? allRules : allRules.filter((rule) => rule.status !== "draft");
  const projectRules = visibleRules.filter((rule) => rule.project === options.project);
  const projectAllRules = allRules.filter((rule) => rule.project === options.project);
  const conflicts = findConflicts(visibleRules);
  const projectConflicts = conflicts.filter((items) => items.some((item) => item.project === options.project));
  const duplicateSummary = strings.duplicateSummary
    .replace("{{kept}}", String(allRules.length))
    .replace("{{hidden}}", String(duplicates.length));

  const common = {
    GENERATED_AT: nowIso(),
    PROJECT_NAME: options.project,
    SUMMARY: renderSummary(allRules, conflicts, duplicates, strings),
    PROJECT_SUMMARY: renderSummary(projectAllRules, projectConflicts, duplicates.filter((rule) => rule.project === options.project), strings),
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

  const projectTemplate = loadTemplate(options.rootDir, `project-standard.${options.lang}.template.md`);
  const globalTemplate = loadTemplate(options.rootDir, `global-standard.${options.lang}.template.md`);

  const projectOutput = getProjectStandardFile(options.rootDir, options.project);
  const globalOutput = getGlobalStandardFile(options.rootDir);
  const conflictsOutput = getStandardsConflictsFile(options.rootDir);

  writeFileSync(projectOutput, renderTemplate(projectTemplate, common));
  writeFileSync(globalOutput, renderTemplate(globalTemplate, common));
  writeFileSync(conflictsOutput, [
    strings.reportTitle,
    "",
    `${strings.generated}: ${nowIso()}`,
    "",
    options.lang === "en" ? "## Conflict Detection" : "## 冲突检测",
    "",
    renderConflicts(conflicts, strings.noConflicts, strings.conflictHeader).trim(),
    "",
    strings.dedupeTitle,
    "",
    duplicateSummary,
    "",
  ].join("\n"));

  return [globalOutput, projectOutput, conflictsOutput];
}
