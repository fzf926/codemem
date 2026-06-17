# Skill JS Project Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a checked-in `skills/codemem/scripts/codemem.mjs` runtime for project-local `init`, `capture`, and `build`, and make installed agent skills call it first.

**Architecture:** Keep the global CLI for install, upgrade, packaging, and uninstall. Add a Node-compatible script directly under the skill source directory, copy it during agent install/export, and update generated guidance to invoke `node <skill_dir>/scripts/codemem.mjs <command>`.

**Tech Stack:** Bun tests, Node.js ESM script, existing TypeScript installer/generator code.

---

### Task 1: Add Failing Tests For Skill Runtime Presence And Behavior

**Files:**
- Create: `test/skill-runtime.test.ts`
- Modify: `test/agent-install.test.ts`

- [ ] **Step 1: Write the failing direct-runtime tests**

Create `test/skill-runtime.test.ts` with tests that run `node skills/codemem/scripts/codemem.mjs init`, `capture`, and `build` against a temp project. Assert `.codemem-project.json`, JSONL logs, generated docs, and user-facing output.

- [ ] **Step 2: Write the failing install tests**

In `test/agent-install.test.ts`, assert that installed Cursor/Codex skills include `scripts/codemem.mjs`, exported packages include the script under `runtime/scripts/`, and generated guidance contains `node` plus `scripts/codemem.mjs`.

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
bun test test/skill-runtime.test.ts test/agent-install.test.ts
```

Expected: FAIL because `skills/codemem/scripts/codemem.mjs` and install copying do not exist yet.

### Task 2: Implement The Checked-In Skill Runtime

**Files:**
- Create: `skills/codemem/scripts/codemem.mjs`

- [ ] **Step 1: Add the Node ESM script**

Implement a plain Node script that:

- parses `init`, `capture`, and `build`
- accepts the same argument names as the CLI
- writes `.codemem` metadata, logs, docs, `.codemem-project.json`, `.gitignore`, `AGENTS.md`, and `.cursor/rules/codemem-standards.mdc`
- loads templates from `CODEMEM_TEMPLATES_DIR` or `../templates`
- renders project/global standards and conflict report

- [ ] **Step 2: Run direct-runtime tests**

Run:

```bash
bun test test/skill-runtime.test.ts
```

Expected: PASS.

### Task 3: Install And Export The Script With Agent Integrations

**Files:**
- Modify: `core/src/agent/service.ts`
- Modify: `test/agent-install.test.ts`

- [ ] **Step 1: Copy scripts during normal agent install**

Update `installSharedSkillBundle()` so it copies `skills/codemem/scripts/` into `<sharedSkillDir>/scripts/`, while keeping `runtime/bin` and `templates` for compatibility.

- [ ] **Step 2: Copy scripts during agent package export**

Update `exportAgentPackage()` and the generated `install.mjs` so exported packages include `runtime/scripts/codemem.mjs` and copy it into the installed skill `scripts/` directory.

- [ ] **Step 3: Run install/export tests**

Run:

```bash
bun test test/agent-install.test.ts
```

Expected: PASS.

### Task 4: Update Generated Guidance To Prefer JS Runtime

**Files:**
- Modify: `core/src/agent/service.ts`
- Generated: `skills/codemem/SKILL.md`
- Generated: `README.md`
- Generated: `docs/COMMANDS.md`
- Test: `test/agent-install.test.ts`

- [ ] **Step 1: Update guidance generation**

Update `renderSharedWorkflow()` and `renderCursorWorkflow()` to use:

```bash
node "<skill_dir>/scripts/codemem.mjs" init ...
node "<skill_dir>/scripts/codemem.mjs" capture ...
node "<skill_dir>/scripts/codemem.mjs" build ...
```

Keep legacy runtime/bin text only as fallback compatibility language if needed.

- [ ] **Step 2: Regenerate generated docs**

Run:

```bash
bun run scripts/gen-skill-docs.ts
bun run scripts/gen-readme.ts
bun run scripts/gen-package-json.ts
bun run scripts/build-cli.ts
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
bun test test/skill-runtime.test.ts test/agent-install.test.ts test/skill-docs.test.ts test/readme-docs.test.ts
```

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run the full test suite**

Run:

```bash
bun test
```

Expected: PASS.

- [ ] **Step 2: Inspect git diff**

Run:

```bash
git diff --stat
git status --short
```

Expected: changes are limited to skill runtime, agent install/export, generated guidance/docs, tests, and existing uncommitted `docs/SHARE.md`.
