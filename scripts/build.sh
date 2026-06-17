#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT"

bun run gen:package-json
bun run gen:skill-docs
bun run gen:readme
bun run build:compiled-cli
bash scripts/write-version-files.sh core/dist/.version
chmod +x core/dist/*
