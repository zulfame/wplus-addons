# Contributing and releasing

## Versions

Semantic versions: `0.1.1` for fixes and small changes, `0.2.0` for new features, `1.0.0` when the plugin is meant to be relied on.
The version is in three places that must agree: `wplus-addons.php` (header `Version:` and `WPLUS_ADDONS_VERSION`), `readme.txt` (`Stable tag:`)
and a `## X.Y.Z - YYYY-MM-DD` section of `CHANGELOG.md`. Work in progress goes under `## Unreleased` and does not change the version.

## The changelog is written for users

`CHANGELOG.md` is the text people read in WordPress (the "View version details" window) and on the release page. Three to eight lines per
version, each starting with `New:`, `Fix:`, `Improved:`, `Safe:` or `Changed:`, in plain words: no file names, test names or code. The Release
workflow stops when the tag has no section in the changelog.

## Before every release (the checklist)

1. **Code:** `phpcs --standard=WordPress-Extra,WordPress-Docs --extensions=php --ignore=tests,dist .` shows nothing (the scripts in `tests/` are for developers and are not shipped).
2. **Texts:** `bin/make-pot.sh`, translate every new entry in `languages/wplus-addons-id_ID.po` (the script must report no untranslated message), run it again.
3. **Version and changelog** updated as above, the `Unreleased` section turned into the new version with today's date.
4. **Zip:** `bin/build-zip.sh`. It must hold only what the plugin needs (no `tests/`, `bin/`, `.github/`, `*.md`).
5. **Claims:** the plugin header promises PHP 7.4 and WordPress 6.3. Prove both before a release:
   `PARSER_AUTOLOAD=<nikic/php-parser autoload.php> php tests/check-php74.php` (it must say `0 problem(s)`), and the gate on the oldest WordPress:
   download that WordPress from wordpress.org, unpack it in its own folder and run
   `SOURCE_WP=<that folder> NODE_MODULES=<puppeteer folder> GATE_ONLY_PLUGIN_LOG=1 tests/release-gate.sh <zip>` (only lines of the plugin count in the log then,
   because an old WordPress on a new PHP writes warnings of its own). Raise the numbers in the header only after the same two checks pass.
6. **Gate:** `tests/release-gate.sh dist/wplus-addons-<version>.zip`. It builds a new WordPress with an empty database, installs *that zip* and runs every
   test (the tests, the update screens against a fake GitHub, the languages) and requires an empty PHP debug log. It must end with `RELEASE GATE PASSED`.
7. **Upgrade from the last release:** install the previous release zip on a clean site, then upload the new zip over it the way a person does
   (`NEW_ZIP=<zip> node tests/upload-over-installed.mjs`). Settings and presets must stay, the plugin must stay active.
8. Commit, push, wait until CI is green.
9. **Tag** `vX.Y.Z` and push it. The Release workflow builds the zip and publishes it with the changelog section as its text.
10. **Check the release:** download the zip from the release page, compare it with the local build (`diff -r` of the unpacked folders must be empty),
   and check that a site with the previous version is offered the update (Plugins screen, or Settings > WPlus Addons > Check now).

Nothing is released without the owner asking for it.

## Updates from the dashboard

Every release after the one that introduced them can be installed from the WordPress dashboard (Plugins > Update now, or Settings > WPlus Addons).
A site that still has a version without that code needs the new zip uploaded once (step 7 above).

## Tests

See `tests/README.md`.
