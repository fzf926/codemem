#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CODEMEM_REPO_URL:-git@github.com:fzf926/codemem.git}"
INSTALL_DIR="${CODEMEM_HOME:-$PWD}"
AGENT="${CODEMEM_AGENT:-cursor}"
TARGET_DIR="$PWD"
LANGUAGE="${CODEMEM_LANG:-zh}"

usage() {
  cat <<'EOF'
Build codemem and install the agent integration for one project.

Usage:
  bash scripts/install.sh [options]

Options:
  --repo-url <url>       Git repository URL. Defaults to git@github.com:fzf926/codemem.git
  --install-dir <dir>    Local source checkout directory. Defaults to current directory
  --agent <agent>        codex, cursor, or claude-code. Defaults to cursor
  --target-dir <dir>     Project directory used for agent installation. Defaults to current directory
  --lang <zh>            Prompt language. Only zh is supported.
  -h, --help             Show this help

Environment overrides:
  CODEMEM_REPO_URL
  CODEMEM_HOME
  CODEMEM_AGENT
  CODEMEM_LANG
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo-url)
      REPO_URL="${2:?missing value for --repo-url}"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="${2:?missing value for --install-dir}"
      shift 2
      ;;
    --agent)
      AGENT="${2:?missing value for --agent}"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="${2:?missing value for --target-dir}"
      shift 2
      ;;
    --lang)
      LANGUAGE="${2:?missing value for --lang}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "codemem install: unknown argument $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$AGENT" in
  codex|cursor|claude-code) ;;
  *)
    echo "codemem install: --agent must be codex, cursor, or claude-code" >&2
    exit 1
    ;;
esac

case "$LANGUAGE" in
  zh) ;;
  *)
    echo "codemem install: --lang must be zh" >&2
    exit 1
    ;;
esac

for required in git bash bun; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "codemem install: missing required command '$required'" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating codemem source in $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  if [ -e "$INSTALL_DIR" ]; then
    echo "codemem install: $INSTALL_DIR exists but is not a git checkout" >&2
    exit 1
  fi
  echo "Cloning codemem into $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

echo "Building codemem"
bash "$INSTALL_DIR/scripts/build.sh"

echo "Installing codemem agent integration"
bun run "$INSTALL_DIR/core/src/cli/agent.ts" --root "$INSTALL_DIR" install --agent "$AGENT" --target-dir "$TARGET_DIR" --lang "$LANGUAGE"

echo
echo "codemem agent integration installed successfully."
