# AI 自动安装指南

这份文档给 AI agent 阅读。目标是让 AI 在用户说“帮我安装 codemem”“接入 codemem”“使用这个包”时，能直接判断安装方式、执行命令并完成验证，不要求用户手动阅读安装步骤。

## 1. 默认判断

- 当前业务项目目录：默认使用 AI 当前所在的工作目录，也就是 `pwd`。
- 当前 agent：能从运行环境判断时直接使用对应值。
  - Codex：`codex`
  - Cursor：`cursor`
  - Claude Code：`claude-code`
- 语言：默认使用 `zh`。
- 安装目标：安装或刷新 agent 集成，不安装 shell 全局 `codemem` 命令。
- 项目状态：内部状态写入 `~/.codemem/projects/<project_state_key>/`，业务项目内只保留项目规范文档和 agent 入口文档。

只有在无法确认当前业务项目目录、无法确认 agent 类型、或即将覆盖用户自定义文件时，才向用户提问。

## 2. 优先安装方式

按以下顺序选择可用方案。

### 方案 A：用户提供 portable skill 包

当用户提供 `codemem-skill-portable-<version>.tgz` 时，优先使用这个方案。它不需要源码仓库，不需要运行安装脚本，适合 Codex 和 Cursor。

如果旁边有 `.sha256` 文件，先校验：

```bash
shasum -a 256 codemem-skill-portable-<version>.tgz
cat codemem-skill-portable-<version>.tgz.sha256
```

然后直接解压：

```bash
mkdir -p ~/.codex/skills
tar -xzf codemem-skill-portable-<version>.tgz -C ~/.codex/skills
```

验证：

```bash
test -f ~/.codex/skills/codemem/SKILL.md
test -f ~/.codex/skills/codemem/scripts/codemem.mjs
test -d ~/.codex/skills/codemem/templates
test -d ~/.codex/skills/codemem/runtime/bin
```

如果当前是 Claude Code，需要 `/codemem` 命令入口时，改用方案 B 或方案 C。

### 方案 B：用户提供 agent 安装包

当用户提供 `codemem-agent-kit-<version>.tgz` 时，解压后运行包内安装器：

```bash
tar -xzf codemem-agent-kit-<version>.tgz
cd codemem-agent-kit-<version>
node install.mjs --agent <codex|cursor|claude-code> --target-dir <project_dir>
```

验证：

```bash
test -f ~/.codex/skills/codemem/SKILL.md
test -f ~/.codex/skills/codemem/scripts/codemem.mjs
```

Claude Code 还应验证：

```bash
test -f <project_dir>/.claude/commands/codemem.md || test -f ~/.claude/commands/codemem.md
```

### 方案 C：允许联网，从 GitHub 自动安装

当用户没有提供安装包，但允许联网时，在业务项目目录执行：

```bash
curl -fsSL https://raw.githubusercontent.com/fzf926/codemem/main/scripts/install.sh | bash -s -- --agent <codex|cursor|claude-code>
```

这条命令会临时 clone `codemem` 源码、构建 runtime、安装 agent skill，然后清理临时目录。它不会安装 shell 全局 `codemem` 命令。

如果当前 shell 的工作目录已经被删除，先切到业务项目目录再执行：

```bash
cd <project_dir>
curl -fsSL https://raw.githubusercontent.com/fzf926/codemem/main/scripts/install.sh | bash -s -- --agent <codex|cursor|claude-code>
```

### 方案 D：本机已有 codemem 源码仓库

当当前目录就是 `codemem` 源码仓库，或用户给出了源码仓库路径时，执行：

```bash
cd <codemem_repo>
bash scripts/build.sh
bun run core/src/cli/agent.ts --root . install --agent <codex|cursor|claude-code> --target-dir <project_dir> --lang zh
```

## 3. 安装后可选初始化

如果用户的目标只是“安装”，安装验证通过后即可结束。

如果用户明确要求“安装并初始化当前项目”，或者安装后立刻要求生成项目规范，则执行：

```bash
node ~/.codex/skills/codemem/scripts/codemem.mjs init \
  --root <project_dir> \
  --project <project_name> \
  --owner unknown \
  --project-path <project_dir>
```

默认项目规范文档位置为：

```text
<project_dir>/docs/spec/project-standard.<project_name>.md
```

如果用户指定了项目规范文档相对路径和文件名，初始化时传入：

```bash
--project-doc-path <relative_md_path>
```

## 4. 不要做的事

- 不要要求用户手动复制 `SKILL.md`、runtime 或 templates。
- 不要安装 shell 全局 `codemem` 命令。
- 不要把 runtime、templates、内部日志或注册表复制到业务项目。
- 不要在业务项目中创建旧版 `.codemem/` 状态目录。
- 不要在能安全推断项目目录和 agent 类型时反复询问用户。

## 5. 回复用户的格式

安装结束后，简短汇报：

```text
已完成 codemem 安装。
- 安装方式：<portable 包 | agent 安装包 | GitHub 远程脚本 | 本地源码>
- 当前 agent：<codex|cursor|claude-code>
- 业务项目：<project_dir>
- 验证结果：<通过/失败及原因>
- 下一步：可以在当前 agent 中直接使用 codemem；需要生成规范时告诉我“初始化 codemem”。
```
