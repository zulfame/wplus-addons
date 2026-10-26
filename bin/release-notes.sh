#!/usr/bin/env bash
# Prints the CHANGELOG.md section of one version (the text of its GitHub release). Usage: bin/release-notes.sh 0.1.0
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?usage: release-notes.sh X.Y.Z}"
VERSION="${VERSION#v}"
awk -v v="$VERSION" '
	/^## / { if (found) exit; if (index($0, "## " v " ") == 1 || $0 == "## " v) { found = 1; next } }
	found { print }
' "$ROOT/CHANGELOG.md" | sed -e '/./,$!d'
