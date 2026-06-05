# 安装与使用指南

这份文档面向“规范提供方”和“规范使用方”两类角色，覆盖从生成分享包、发送给别人、安装到目标项目、后续升级验证的完整流程。

## 1. 适用场景

当你希望把某个项目里沉淀出的开发规范分享给其他项目时，推荐优先使用新的 `codemem-agent` 流程。它可以把 `codemem` 作为 agent 集成安装到 `Codex`、`Cursor` 或 `Claude Code` 中，让 AI 在当前项目里自动完成初始化、记录规范，并在需要时建议更新文档。

如果你只是要分发一个可分享安装包给别人，也可以继续使用后半部分的“导出安装包”流程。

## 2. 前置条件

规范提供方需要：

- 能运行当前仓库中的 `codemem` 命令
- 已完成项目初始化
- 已录入规范并生成文档

规范使用方需要：

- Node.js 18 或更高版本
- 一个可写入的目标项目目录
- 从你这里拿到安装包文件

## 3. 最简流程：直接给指定 agent 安装集成

这是现在最推荐的使用方式。

### 第一步：执行统一安装器

```bash
./bin/codemem-agent install
```

CLI 会让你选择目标 agent：

- `Codex`
- `Cursor`
- `Claude Code`

也可以直接非交互执行：

```bash
./bin/codemem-agent install --agent codex --target-dir /path/to/target-project
./bin/codemem-agent install --agent cursor --target-dir /path/to/target-project
./bin/codemem-agent install --agent claude-code --target-dir /path/to/target-project
```

### 第二步：安装器会做什么

安装器会自动完成这些动作：

- 把项目 runtime 二进制安装到目标项目 `.codemem/_system/runtime/agent-runtime/bin/`
- 把文档模板安装到目标项目 `skills/codemem/templates/`
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
- 当检测到规范变更时，先建议更新文档，再等待你确认执行

### 第四步：检测当前接入状态

如果你想确认当前项目和当前 agent 是否已经接好，可以执行：

```bash
./bin/codemem-agent detect --agent codex --target-dir /path/to/target-project
./bin/codemem-agent detect --agent cursor --target-dir /path/to/target-project
./bin/codemem-agent detect --agent claude-code --target-dir /path/to/target-project
```

输出会显示：

- 当前 agent
- 是否已配置完成
- 当前选中的集成目录来源原因
- 集成文件路径
- runtime 路径
- 模板路径

`reason` 目前可能包含：

- `explicit_override`：你显式传入了 `--skill-dir`
- `detected_existing_project`：探测到了项目内已有目录
- `detected_existing_home`：探测到了用户目录下已有目录
- `default_fallback`：没有探测到已有目录，回退到了默认位置

如果你要在脚本或 CI 中消费检测结果，可以加：

```bash
./bin/codemem-agent detect --agent codex --target-dir /path/to/target-project --json
```

### 第五步：后续待办

- Windows 常见 agent 安装路径探测
- Linux 常见 agent 安装路径探测

## 4. 提供方流程：生成并分享安装包

### 第一步：初始化项目

如果当前项目还没有接入 `codemem`，先执行：

```bash
./bin/codemem-init --project <project_name> --owner <owner_name>
```

### 第二步：持续记录开发规范

在开发过程中，把约定逐条录入：

```bash
./bin/codemem-capture \
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
./bin/codemem-build --project <project_name> --lang zh
```

生成产物位于 `.codemem/docs/`：

- `docs/global/global-standard.md`
- `docs/projects/project-standard.<project_name>.md`
- `docs/reports/standards-conflicts.md`

### 第四步：生成分享安装包

```bash
./bin/codemem-package --project <project_name> --version <version> --lang zh
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

### 方式 A：通过 `codemem-agent install` 安装 agent 集成

如果对方也拿到了当前仓库，最推荐直接执行：

```bash
./bin/codemem-agent install --agent codex --target-dir /path/to/target-project
```

或者：

```bash
./bin/codemem-agent install --agent cursor --target-dir /path/to/target-project
./bin/codemem-agent install --agent claude-code --target-dir /path/to/target-project
```

### 方式 B：通过 `codemem-install` 安装旧版共享规范包

这适合已经在本地具备 `codemem` 运行环境的团队。

#### 第一步：准备目标项目目录

假设目标项目目录是：

```bash
/path/to/target-project
```

#### 第二步：执行安装

```bash
./bin/codemem-install \
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
./bin/codemem-install \
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
- `.codemem/_system/registry/projects-registry.json`

这些文件分别用于：

- 保存安装过来的规范文档和 manifest
- 记录当前安装状态
- 记录目标项目的接入信息
- 记录项目注册表

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
./bin/codemem-projects
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
./bin/codemem-install \
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

如果你希望把 agent 集成能力整体打包给别人使用，可以执行：

```bash
./bin/codemem-agent export --agent all --target-dir /path/to/output --version 1.0.0
```

也可以只导出某一个 agent：

```bash
./bin/codemem-agent export --agent codex --target-dir /path/to/output --version 1.0.0
```

如果要在脚本中读取导出结果：

```bash
./bin/codemem-agent export --agent codex --target-dir /path/to/output --version 1.0.0 --json
```

导出产物会包含：

- agent runtime 二进制
- 文档模板
- 各 agent 的集成文件
- `install.mjs`
- `.tgz`
- `.sha256`

拿到导出包后，对方可以直接：

```bash
node install.mjs --agent codex --target-dir /path/to/target-project
```

## 11. 推荐给外部使用方的最小交付说明

如果你要把这套能力交给别的团队，最小可以附上这段说明：

```text
1. 安装要求：Node.js >= 18
2. 你会收到一个 .tgz 安装包和一个 .sha256 校验文件
3. 如果你有 codemem CLI，优先使用 codemem-install 安装
4. 如果没有，也可以解压后直接执行 install.mjs
5. 安装完成后，目标项目的 .codemem/ 目录中会留下规范文档和安装记录
```

## 12. 常见命令速查

推荐入口：

```bash
./bin/codemem-agent install
./bin/codemem-agent detect --agent codex --target-dir /path/to/target-project
./bin/codemem-agent export --agent all --target-dir /path/to/output --version 1.0.0
```

提供方：

```bash
./bin/codemem-init --project demo --owner cm
./bin/codemem-capture --project demo --type code --title "命名规则" --rule "组件使用 PascalCase" --priority P1 --status active --scope global
./bin/codemem-build --project demo --lang zh
./bin/codemem-package --project demo --version 1.0.0 --lang zh
```

使用方：

```bash
./bin/codemem-install \
  --package /path/to/shared-standard-demo-1.0.0.tgz \
  --target /path/to/target-project \
  --project target-project \
  --owner cm
```
