#!/usr/bin/env bash
# Build dist/wplus-addons-<version>.zip. Usage: bin/build-zip.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="$(sed -n 's/^ \* Version:[[:space:]]*//p' "$ROOT/wplus-addons.php" | head -1 | tr -d '\r')"
OUT="$ROOT/dist/wplus-addons-$VER.zip"
mkdir -p "$ROOT/dist"
rm -f "$OUT"
tmp="$(mktemp -d)"
rsync -a --exclude-from="$ROOT/.distignore" "$ROOT/" "$tmp/wplus-addons/"
(cd "$tmp" && zip -qr "$OUT" wplus-addons)
rm -rf "$tmp"
echo "$OUT ($(du -h "$OUT" | cut -f1))"
