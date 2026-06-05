#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"

for file in "$@"; do
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$VERSION" > "$file"
done
