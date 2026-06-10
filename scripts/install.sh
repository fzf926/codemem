#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${CODEMEM_REPO_URL:-git@github.com:fzf926/codemem.git}"
INSTALL_DIR="${CODEMEM_HOME:-$HOME/.codemem/source}"
BIN_DIR="${CODEMEM_BIN_DIR:-$HOME/.local/bin}"
AGENT="${CODEMEM_AGENT:-cursor}"
TARGET_DIR="$PWD"
LANGUAGE="${CODEMEM_LANG:-zh}"

usage() {
  cat <<'EOF'
Install codemem and register the global codemem command.

Usage:
  bash scripts/install.sh [options]

Options:
  --repo-url <url>       Git repository URL. Defaults to git@github.com:fzf926/codemem.git
  --install-dir <dir>    Local source install directory. Defaults to ~/.codemem/source
  --bin-dir <dir>        Directory for the global codemem command. Defaults to ~/.local/bin
  --agent <agent>        codex, cursor, or claude-code. Defaults to cursor
  --target-dir <dir>     Project directory used for agent installation. Defaults to current directory
  --lang <zh|en>         Prompt language. Defaults to zh
  -h, --help             Show this help

Environment overrides:
  CODEMEM_REPO_URL
  CODEMEM_HOME
  CODEMEM_BIN_DIR
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
    --bin-dir)
      BIN_DIR="${2:?missing value for --bin-dir}"
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
  zh|en) ;;
  *)
    echo "codemem install: --lang must be zh or en" >&2
    exit 1
    ;;
esac

for required in git bash bun; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "codemem install: missing required command '$required'" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$INSTALL_DIR")" "$BIN_DIR"

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

SHIM="$BIN_DIR/codemem"
cat > "$SHIM" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$INSTALL_DIR/bin/codemem" "\$@"
EOF
chmod +x "$SHIM"

echo "Installing codemem agent integration"
"$INSTALL_DIR/bin/codemem" agent install --agent "$AGENT" --target-dir "$TARGET_DIR" --lang "$LANGUAGE"

echo
echo "codemem installed successfully."
echo "Command: $SHIM"
echo
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "Add this to your shell profile if codemem is not found:"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi
echo "Next update command:"
echo "  codemem upgrade"
