#!/usr/bin/env bash
# Rebuild languages/wplus-addons.pot from the PHP files, bring every .po up to date and compile the .mo files.
# Needs gettext (xgettext, msgmerge, msgfmt). Usage: bin/make-pot.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="$(sed -n 's/^ \* Version:[[:space:]]*//p' wplus-addons.php | head -1 | tr -d '\r')"
FILES=$(find . -name '*.php' -not -path './dist/*' -not -path './node_modules/*' | sort)
# shellcheck disable=SC2086
xgettext --language=PHP --from-code=UTF-8 --add-comments=translators \
	--keyword=__ --keyword=_e --keyword=esc_html__ --keyword=esc_attr__ --keyword=esc_html_e --keyword=esc_attr_e --keyword=_x:1,2c --keyword=_n:1,2 \
	--package-name="WPlus Addons" --package-version="$VERSION" --copyright-holder="Zulfadli Rizal" \
	--msgid-bugs-address="https://github.com/zulfame/wplus-addons/issues" -o languages/wplus-addons.pot $FILES
sed -i.bak -e 's/^# SOME DESCRIPTIVE TITLE\./# WPlus Addons (translation template)./' -e 's/^# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR\./# Zulfadli Rizal, 2026./' -e '/^#, fuzzy$/d' -e 's/Last-Translator: FULL NAME <EMAIL@ADDRESS>/Last-Translator: Zulfadli Rizal/' languages/wplus-addons.pot && rm -f languages/wplus-addons.pot.bak
status=0
for po in languages/*.po; do
	[[ -f "$po" ]] || continue
	msgmerge --quiet --update --backup=none "$po" languages/wplus-addons.pot
	stats="$(msgfmt --check --statistics -o "${po%.po}.mo" "$po" 2>&1)"
	echo "$po: $stats"
	if grep -qE 'untranslated|fuzzy' <<<"$stats"; then
		echo "  -> translate or fix these entries, then run this script again:" >&2
		msgattrib --untranslated --no-obsolete "$po" | grep -A2 '^msgid "' | grep -v '^--' | head -20 >&2
		status=1
	fi
done
exit $status
