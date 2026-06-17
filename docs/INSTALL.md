# 安装与使用指南

这份文档面向“规范提供方”和“规范使用方”两类角色，覆盖从生成分享包、发送给别人、安装到目标项目、后续升级验证的完整流程。

## 1. 适用场景

当你希望把某个项目里沉淀出的开发规范分享给其他项目时，推荐在 `codemem` 源码项目内执行安装和升级命令，只给目标项目安装 agent 集成，不再安装 shell 全局 `codemem` 命令。安装后 AI 可以在当前项目里自动完成初始化、记录规范，并默认一轮生成规范文档。

如果你只是要分发一个可分享安装包给别人，也可以继续使用后半部分的“导出安装包”流程。

## 2. 前置条件

规范提供方需要：

- 能运行当前仓库中的安装脚本或源码 CLI
- 已完成项目初始化
- 已录入规范并生成文档

规范使用方需要：

- Bun 1.0 或更高版本
- Git
- 一个可写入的目标项目目录
- 从你这里拿到安装脚本，或拿到离线安装包文件

## 3. 推荐分发方式：给别人一个安装脚本

你给别人的首选产物是仓库里的安装脚本：

```bash
scripts/install.sh
```

如果脚本已经发布到 GitHub，对方可以在自己的业务项目目录直接执行：

```bash
curl -fsSL https://raw.githubusercontent.com/fzf926/codemem/main/scripts/install.sh | bash -s -- --agent cursor
```

这条命令会把当前目录作为业务项目，自动临时 clone `codemem` 源码、构建 runtime、安装 agent skill，然后删除临时源码目录。它不会安装 shell 全局 `codemem` 命令，也不会写入 `~/.local/bin`。同一台机器上，Cursor/Codex 的 skill 安装一次后可供所有项目使用。

如果对方已经拿到源码仓库，也可以在业务项目目录执行源码脚本：

```bash
cd /path/to/target-project
bash /path/to/codemem/scripts/install.sh --agent cursor
```

这个脚本会自动：

- 执行 `bash scripts/build.sh`
- 安装或刷新 `~/.codex/skills/codemem/` 下的 skill、scripts、runtime 和 templates
- 为指定目标项目写入对应 agent 集成

## 4. 已安装后的最简流程：直接给指定 agent 安装集成

这是现在最推荐的使用方式。

### 第一步：执行统一安装器

```bash
bun run core/src/cli/agent.ts --root . install
```

CLI 会让你选择目标 agent：

- `Codex`
- `Cursor`
- `Claude Code`

也可以直接非交互执行：

```bash
bun run core/src/cli/agent.ts --root . install --agent codex --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . install --agent cursor --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . install --agent claude-code --target-dir /path/to/target-project
```

### 第二步：安装器会做什么

安装器会自动完成这些动作：

- 把 skill 脚本和 runtime 安装到 `~/.codex/skills/codemem/scripts/` 与 `~/.codex/skills/codemem/runtime/bin/`
- 把共享文档模板安装到 `~/.codex/skills/codemem/templates/`
- 为所选 agent 写入对应集成文件
- 如果你没有传 `--skill-dir`，会先自动探测该 agent 常见的已有安装目录，探测不到才回退到默认位置
- 如果在交互式终端里探测到的是“非默认目录”，CLI 会先询问你是否确认使用

默认探测与回退规则：

- `Codex`：使用 `~/.codex/skills/codemem/`
- `Cursor`：使用全局 skill 目录 `~/.codex/skills/codemem/`
- `Claude Code`：优先使用已存在的 `<project>/.claude/commands/` 或 `~/.claude/commands/`，否则回退到 `<project>/.claude/commands/`

如果你要覆盖默认安装目录，可以传：

```bash
--skill-dir <custom_dir>
```

### 第三步：后续如何使用

安装完成后：

- 在 `Codex` 中，直接调用 `codemem` 开发规范 skill
- 在 `Cursor` 中，直接搜索或调用 `codemem` 这个 skill
- 在 `Claude Code` 中，可通过 `/codemem` 使用这套工作流

AI 的默认行为是：

- 自动判断当前项目是否需要初始化
- 自动推断项目名称；不确定时才追问
- 在开发过程中记录稳定规范
- 默认一轮完成初始化、规范记录和文档生成
- 只有项目身份不确定、可能覆盖重要内容、或冲突无法安全决策时才打断确认

### 第四步：检测当前接入状态

如果你想确认当前项目和当前 agent 是否已经接好，可以执行：

```bash
bun run core/src/cli/agent.ts --root . detect --agent codex --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . detect --agent cursor --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . detect --agent claude-code --target-dir /path/to/target-project
```

输出会显示：

- 当前 agent
- 是否已配置完成
- 当前选中的集成目录来源原因
- 集成文件路径
- 全局共享 runtime 路径
- 全局共享模板路径

`reason` 目前可能包含：

- `explicit_override`：你显式传入了 `--skill-dir`
- `detected_existing_project`：探测到了项目内已有目录
- `detected_existing_home`：探测到了用户目录下已有目录
- `default_fallback`：没有探测到已有目录，回退到了默认位置

如果你要在脚本或 CI 中消费检测结果，可以加：

```bash
bun run core/src/cli/agent.ts --root . detect --agent codex --target-dir /path/to/target-project --json
```

### 第五步：后续待办

- Windows 常见 agent 安装路径探测
- Linux 常见 agent 安装路径探测

### 第六步：后续如何更新

如果你本机已经装好了 `codemem` 的 agent 集成，后续更新最推荐回到源码项目执行：

```bash
bun run core/src/cli/upgrade.ts --root . --agent cursor --target-dir /path/to/target-project --lang zh
```

这时它会自动：

- 重建当前源码项目
- 根据已安装集成自动识别当前 agent
- 重新安装最新 skill 资源到 `~/.codex/skills/codemem/`

如果你希望更新前先拉最新代码，可以执行：

```bash
bun run core/src/cli/upgrade.ts --root . --agent cursor --target-dir /path/to/target-project --pull true
```

### 第七步：后续如何卸载

如果你后续不想继续使用 `codemem`，可以执行：

```bash
bun run core/src/cli/uninstall.ts --root . --target-dir /path/to/target-project
```

默认卸载会删除：

- agent skill、runtime 和 templates，例如 `~/.codex/skills/codemem/`
- Claude Code 命令集成，例如 `~/.claude/commands/codemem.md`
- 旧版全局命令 shim、安装元数据、受管源码目录和 shell profile PATH 块，如果它们存在

默认不会删除目标项目里已经生成的 `.codemem/` 规范历史，也不会改动 `AGENTS.md`、`.cursor/rules/codemem-standards.mdc` 或 `.gitignore`，避免误删项目沉淀。

如果你确认也要删除某个目标项目的历史规范和 codemem 项目侧引用，再显式执行：

```bash
bun run core/src/cli/uninstall.ts --root . --delete-project-data true --target-dir /path/to/target-project
```

如果你想先预览会删除哪些内容，可以加 dry run：

```bash
bun run core/src/cli/uninstall.ts --root . --dry-run true --target-dir /path/to/target-project
```


## 5. 提供方流程：生成并分享安装包

### 第一步：初始化项目

如果当前项目还没有接入 `codemem`，先执行：

```bash
bun run core/src/cli/init.ts --root . --project <project_name> --owner <owner_name>
```

### 第二步：持续记录开发规范

在开发过程中，把约定逐条录入：

```bash
bun run core/src/cli/capture.ts --root . \
  --project <project_name> \
  --type code \
  --title "组件命名规则" \
  --rule "React 组件文件使用 PascalCase 命名" \
  --priority P1 \
  --status active \
  --scope project
```

如果这条规范适用于多个项目，可以改成：

```bash
--scope global
```

### 第三步：生成规范文档

```bash
bun run core/src/cli/build.ts --root . --project <project_name> --lang zh
```

生成产物位于 `.codemem/docs/`：

- `docs/global/global-standard.md`
- `docs/projects/project-standard.<project_name>.md`
- `docs/reports/standards-conflicts.md`

### 第四步：生成分享安装包

```bash
bun run core/src/cli/package.ts --root . --project <project_name> --version <version> --lang zh
```

生成产物位于 `.codemem/_system/packages/standards/`：

- `<package-id>-<version>/`
- `<package-id>-<version>.tgz`
- `<package-id>-<version>.tgz.sha256`

其中：

- `.tgz` 是给别人分发的主安装包
- `.sha256` 是归档摘要文件，可用于校验包是否被篡改
- 同名目录是未压缩安装包，便于你本地检查内容

### 第五步：把安装包发给别人

推荐至少发送这两个文件：

- `<package-id>-<version>.tgz`
- `<package-id>-<version>.tgz.sha256`

如果对方不通过主 CLI 安装，而是想手动解包后运行安装器，也可以把整个目录包一起发过去。

## 5. 使用方流程：安装到目标项目

使用方拿到安装包后，有两种方式。

### 方式 A：通过源码 CLI 安装 agent 集成

如果对方也拿到了当前仓库，最推荐直接执行：

```bash
bun run core/src/cli/agent.ts --root . install --agent codex --target-dir /path/to/target-project
```

或者：

```bash
bun run core/src/cli/agent.ts --root . install --agent cursor --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . install --agent claude-code --target-dir /path/to/target-project
```

### 方式 B：通过源码 CLI 安装共享规范包

这适合已经在本地具备 `codemem` 源码项目的团队。

#### 第一步：准备目标项目目录

假设目标项目目录是：

```bash
/path/to/target-project
```

#### 第二步：执行安装

```bash
bun run core/src/cli/install.ts --root . \
  --package /path/to/shared-standard-<project>-<version>.tgz \
  --target /path/to/target-project \
  --project <target_project_name> \
  --owner <owner_name>
```

安装成功后，CLI 会输出：

- `Install action: installed|upgraded|downgraded|reinstalled`
- 兼容性摘要
- 安装目标路径

#### 第三步：需要机器可读结果时使用 JSON 模式

如果是在脚本、CI 或其他工具链中调用，建议使用：

```bash
bun run core/src/cli/install.ts --root . \
  --package /path/to/shared-standard-<project>-<version>.tgz \
  --target /path/to/target-project \
  --project <target_project_name> \
  --owner <owner_name> \
  --json
```

返回结果示例：

```json
{
  "action": "installed",
  "packageId": "shared-standard-demo",
  "packageVersion": "1.2.0",
  "target": "/path/to/target-project",
  "compatibility": {
    "hostCodememVersion": "0.1.0",
    "requiredCodememVersion": ">=0.1.0",
    "requiredNodeVersion": ">=18"
  }
}
```

### 方式 C：直接运行安装包内的 `install.mjs`

这适合只拿到分享包、但不想依赖完整仓库 CLI 的场景。

#### 第一步：解压安装包

```bash
mkdir -p /tmp/codemem-package
tar -xzf /path/to/shared-standard-<project>-<version>.tgz -C /tmp/codemem-package
```

解压后会得到一个同名目录，比如：

```bash
/tmp/codemem-package/shared-standard-demo-1.2.0
```

#### 第二步：执行内置安装器

```bash
node /tmp/codemem-package/shared-standard-demo-1.2.0/install.mjs \
  --target /path/to/target-project \
  --project <target_project_name> \
  --owner <owner_name>
```

如果你想查看参数帮助：

```bash
node /tmp/codemem-package/shared-standard-demo-1.2.0/install.mjs --help
```

如果你想得到 JSON 输出：

```bash
node /tmp/codemem-package/shared-standard-demo-1.2.0/install.mjs \
  --target /path/to/target-project \
  --project <target_project_name> \
  --owner <owner_name> \
  --json
```

## 6. 安装后会生成什么

安装完成后，目标项目下会生成 `.codemem/` 相关内容：

- `.codemem/installed-standard/`
- `.codemem/installed-standard.json`
- `.codemem/_system/meta/standards/<project>.env`
- `.codemem/_system/logs/standards/<project>.jsonl`
- `.codemem-project.json`
- `~/.codemem/_system/registry/projects-registry.json`

这些文件分别用于：

- 保存安装过来的规范文档和 manifest
- 记录当前安装状态
- 记录目标项目的共享接入信息，便于其他协作者拉代码后识别这是一个已启用 codemem 的项目
- 记录当前机器上登记过的项目注册表

## 7. 如何确认安装成功

可以从三个层面确认：

### 看命令输出

命令返回 `installed`、`upgraded`、`downgraded` 或 `reinstalled` 之一，说明安装动作已完成。

### 看目标目录

确认这些文件存在：

```bash
ls -la /path/to/target-project/.codemem
```

### 看项目注册状态

如果你通过主 CLI 安装，可以在源仓库里查看已接入项目：

```bash
bun run core/src/cli/projects.ts --root .
```

## 8. 升级、降级、重装规则

默认策略如下：

- 首次安装：允许，结果为 `installed`
- 新版本覆盖旧版本：允许，结果为 `upgraded`
- 同版本重复安装：默认拒绝，需要 `--force`
- 旧版本覆盖新版本：默认拒绝，需要 `--allow-downgrade`
- 不同安装包 ID 互相替换：默认拒绝，需要 `--force`

示例：

```bash
bun run core/src/cli/install.ts --root . \
  --package /path/to/shared-standard-demo-1.1.0.tgz \
  --target /path/to/target-project \
  --project target-project \
  --allow-downgrade
```

## 9. 完整性与兼容性校验

安装前后，系统会自动做这些检查：

- 包 manifest schema 校验
- installer schema 校验
- `codemem` 版本要求校验
- Node.js 版本要求校验
- payload 文件完整性校验

另外你也可以手动校验归档摘要文件：

```bash
shasum -a 256 /path/to/shared-standard-<project>-<version>.tgz
cat /path/to/shared-standard-<project>-<version>.tgz.sha256
```

如果两个 SHA256 一致，说明压缩包未被修改。

## 10. 导出可分享 agent 安装包

如果你希望把 agent 集成能力整体打包给别人使用，推荐用这个流程。导出的包是自包含的，使用方不需要拿到 `codemem` 源码仓库。

```bash
bun run core/src/cli/agent.ts --root . export --agent all --target-dir /path/to/output --version 1.0.0
```

当前项目的默认导出路径可以直接使用：

```bash
bun run core/src/cli/agent.ts --root . export --agent all --target-dir .codemem/_system/packages/agents --version 0.1.0 --lang zh
```

对应产物示例：

- `.codemem/_system/packages/agents/codemem-agent-kit-0.1.0/`
- `.codemem/_system/packages/agents/codemem-agent-kit-0.1.0.tgz`
- `.codemem/_system/packages/agents/codemem-agent-kit-0.1.0.tgz.sha256`

也可以只导出某一个 agent：

```bash
bun run core/src/cli/agent.ts --root . export --agent codex --target-dir /path/to/output --version 1.0.0
```

如果要在脚本中读取导出结果：

```bash
bun run core/src/cli/agent.ts --root . export --agent codex --target-dir /path/to/output --version 1.0.0 --json
```

导出产物会包含：

- agent runtime 二进制
- skill JavaScript 脚本
- 文档模板
- 各 agent 的集成文件模板
- `install.mjs`
- `.tgz`
- `.sha256`

你需要发给对方：

- `<package-name>-<version>.tgz`
- `<package-name>-<version>.tgz.sha256`

拿到导出包后，对方先校验摘要：

```bash
shasum -a 256 <package-name>-<version>.tgz
cat <package-name>-<version>.tgz.sha256
```

然后解压并安装到目标项目：

```bash
tar -xzf <package-name>-<version>.tgz
cd <package-name>-<version>
node install.mjs --agent cursor --target-dir /path/to/target-project
```

也可以安装到 Codex 或 Claude Code：

```bash
node install.mjs --agent codex --target-dir /path/to/target-project
node install.mjs --agent claude-code --target-dir /path/to/target-project
```

如果对方的 agent skill 目录比较特殊，可以显式指定：

```bash
node install.mjs --agent cursor --target-dir /path/to/target-project --skill-dir /path/to/skill-dir
```

`install.mjs` 会在对方机器上按实际路径写入 `SKILL.md` 或 `codemem.md`，不会使用打包者本机路径。

安装完成后：

- Cursor/Codex 会从 `~/.codex/skills/codemem/` 读取 skill。
- Claude Code 默认会在目标项目写入 `.claude/commands/codemem.md`，并共用 `~/.codex/skills/codemem/` 下的 runtime。
- 目标业务项目不需要复制 runtime 或模板；后续由 agent 在项目内生成 `.codemem/` 状态和规范文档。

## 11. 推荐给外部使用方的最小交付说明

如果你要把这套能力交给别的团队，最小可以附上这段说明：

```text
1. 安装要求：Node.js >= 18
2. 你会收到一个 .tgz 安装包和一个 .sha256 校验文件
3. 校验 .tgz 的 SHA256 摘要
4. 解压后进入包目录，执行 node install.mjs --agent cursor --target-dir <你的项目目录>
5. 安装完成后，在 Cursor/Codex/Claude Code 中直接使用 codemem skill
```

## 12. 常见命令速查

推荐入口：

```bash
bun run core/src/cli/agent.ts --root . install
bun run core/src/cli/agent.ts --root . detect --agent codex --target-dir /path/to/target-project
bun run core/src/cli/agent.ts --root . export --agent all --target-dir /path/to/output --version 1.0.0
```

提供方：

```bash
bun run core/src/cli/init.ts --root . --project demo --owner cm
bun run core/src/cli/capture.ts --root . --project demo --type code --title "命名规则" --rule "组件使用 PascalCase" --priority P1 --status active --scope global
bun run core/src/cli/build.ts --root . --project demo --lang zh
bun run core/src/cli/package.ts --root . --project demo --version 1.0.0 --lang zh
```

使用方：

```bash
bun run core/src/cli/install.ts --root . \
  --package /path/to/shared-standard-demo-1.0.0.tgz \
  --target /path/to/target-project \
  --project target-project \
  --owner cm
```
