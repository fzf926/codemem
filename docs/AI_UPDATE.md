# AI 自动更新指南

这份文档给 AI agent 阅读。目标是当用户说“更新 codemem”“升级 codemem skill”“我发了新版包，帮我更新”时，AI 可以直接完成更新和验证。

## 1. 默认判断

- 当前业务项目目录：默认使用 AI 当前所在的工作目录，也就是 `pwd`。
- 当前 agent：能从上下文判断时直接使用 `codex`、`cursor` 或 `claude-code`；不能判断时优先让用户说明当前使用的 agent。
- 更新目标：刷新 `~/.codex/skills/codemem/` 下的 skill、runtime、templates 和 scripts。
- 不安装 shell 全局 `codemem` 命令。
- 不把 runtime、templates 或内部状态复制到业务项目。

## 2. 优先使用 skill 内部 update 命令

如果当前机器已经安装过 codemem skill，优先执行：

```bash
node ~/.codex/skills/codemem/scripts/codemem.mjs update \
  --target-dir <project_dir> \
  --agent <codex|cursor|claude-code>
```

这个命令默认会通过 GitHub 远程安装脚本刷新当前 skill。

## 3. 用户提供 portable 包

如果用户提供 `codemem-skill-portable-<version>.tgz`，执行：

```bash
node ~/.codex/skills/codemem/scripts/codemem.mjs update \
  --target-dir <project_dir> \
  --agent <codex|cursor|claude-code> \
  --portable codemem-skill-portable-<version>.tgz
```

如果同目录存在 `.sha256`，更新前先校验：

```bash
shasum -a 256 codemem-skill-portable-<version>.tgz
cat codemem-skill-portable-<version>.tgz.sha256
```

## 4. 用户提供 codemem 源码目录

如果用户本机有新版 codemem 源码仓库，执行：

```bash
node ~/.codex/skills/codemem/scripts/codemem.mjs update \
  --target-dir <project_dir> \
  --agent <codex|cursor|claude-code> \
  --source-dir <codemem_repo>
```

## 5. 旧版本 skill 没有 update 命令

如果执行 `node ~/.codex/skills/codemem/scripts/codemem.mjs --help` 看不到 `update`，说明用户安装的是旧版。直接使用远程安装脚本覆盖刷新：

```bash
curl -fsSL https://raw.githubusercontent.com/fzf926/codemem/main/scripts/install.sh | bash -s -- \
  --agent <codex|cursor|claude-code> \
  --target-dir <project_dir>
```

如果远程脚本也还不支持 `--target-dir`，先切到业务项目目录再执行：

```bash
cd <project_dir>
curl -fsSL https://raw.githubusercontent.com/fzf926/codemem/main/scripts/install.sh | bash -s -- \
  --agent <codex|cursor|claude-code>
```

## 6. 更新后验证

```bash
test -f ~/.codex/skills/codemem/SKILL.md
test -f ~/.codex/skills/codemem/scripts/codemem.mjs
test -d ~/.codex/skills/codemem/templates
test -d ~/.codex/skills/codemem/runtime/bin
node ~/.codex/skills/codemem/scripts/codemem.mjs --help
```

`--help` 输出中应包含 `update`。

## 7. 回复用户的格式

```text
已完成 codemem 更新。
- 更新方式：<skill update | portable 包 | 本地源码 | 远程安装脚本>
- 当前 agent：<codex|cursor|claude-code>
- 业务项目：<project_dir>
- 验证结果：<通过/失败及原因>
```
