#!/usr/bin/env bash
# The gate before a release: build a clean WordPress, install the zip that would be released, run every test and require an empty
# PHP debug log. Usage: tests/release-gate.sh dist/wplus-addons-<version>.zip
# Needs what tests/clean-site.sh needs (php, mysql, rsync, unzip) plus Node and Chrome (see tests/README.md).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ZIP="${1:?usage: release-gate.sh <plugin zip>}"
export CLEAN_DIR="${CLEAN_DIR:-${TMPDIR:-/tmp}/wpa-clean-site}"
PORT="${CLEAN_PORT:-8099}"
status=0
"$HERE/clean-site.sh" create "$ZIP" || { echo "could not build the clean site" >&2; exit 1; }
WP_ROOT="$CLEAN_DIR" BASE_URL="http://127.0.0.1:$PORT" node "$HERE/run-all.mjs" || status=1
LOG="$CLEAN_DIR/wp-content/debug.log"
if [[ -s "$LOG" ]]; then echo "PHP debug log is not empty:"; head -10 "$LOG"; status=1; else echo "PHP debug log is empty"; fi
"$HERE/clean-site.sh" destroy
[[ $status -eq 0 ]] && echo "RELEASE GATE PASSED" || echo "RELEASE GATE FAILED"
exit $status
