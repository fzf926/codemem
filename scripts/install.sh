#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CODEMEM_REPO_URL:-https://github.com/fzf926/codemem.git}"
INSTALL_DIR="${CODEMEM_HOME:-}"
AGENT="${CODEMEM_AGENT:-cursor}"
LANGUAGE="${CODEMEM_LANG:-zh}"
TEMP_INSTALL_ROOT=""
CURRENT_DIR=""
TARGET_DIR=""

usage() {
  cat <<'EOF'
Build codemem and install the agent integration for one project.

Usage:
  bash scripts/install.sh [options]

Options:
  --repo-url <url>       Git repository URL. Defaults to https://github.com/fzf926/codemem.git
  --install-dir <dir>    Local source checkout directory. Defaults to current directory when it is a codemem checkout; otherwise a temporary clone
  --agent <agent>        codex, cursor, or claude-code. Defaults to cursor
  --target-dir <dir>     Business project directory to install for. Defaults to current directory
  --lang <zh>            Prompt language. Only zh is supported.
  -h, --help             Show this help

Environment overrides:
  CODEMEM_REPO_URL
  CODEMEM_HOME
  CODEMEM_AGENT
  CODEMEM_LANG
EOF
}

is_codemem_checkout() {
  [ -d "$1/.git" ] && [ -f "$1/scripts/build.sh" ] && [ -f "$1/core/src/cli/agent.ts" ]
}

cleanup_temp_install() {
  if [ -n "$TEMP_INSTALL_ROOT" ] && [ -d "$TEMP_INSTALL_ROOT" ]; then
    rm -rf "$TEMP_INSTALL_ROOT"
  fi
}

resolve_current_dir() {
  if CURRENT_DIR="$(pwd -P 2>/dev/null)"; then
    TARGET_DIR="$CURRENT_DIR"
    return
  fi

  CURRENT_DIR=""
  TARGET_DIR="${HOME:-/tmp}"
  echo "codemem install: current directory is unavailable; using $TARGET_DIR as install context" >&2
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

if [ -z "$TARGET_DIR" ]; then
  resolve_current_dir
else
  if [ ! -d "$TARGET_DIR" ]; then
    echo "codemem install: --target-dir does not exist: $TARGET_DIR" >&2
    exit 1
  fi
  TARGET_DIR="$(cd "$TARGET_DIR" && pwd -P)"
fi

if [ -z "$INSTALL_DIR" ]; then
  if [ -n "$CURRENT_DIR" ] && is_codemem_checkout "$CURRENT_DIR"; then
    INSTALL_DIR="$CURRENT_DIR"
  else
    TEMP_INSTALL_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/codemem-install.XXXXXX")"
    trap cleanup_temp_install EXIT
    INSTALL_DIR="$TEMP_INSTALL_ROOT/source"
  fi
fi

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

if [ -n "$TEMP_INSTALL_ROOT" ]; then
  cd "$TEMP_INSTALL_ROOT"
fi

if is_codemem_checkout "$INSTALL_DIR"; then
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
