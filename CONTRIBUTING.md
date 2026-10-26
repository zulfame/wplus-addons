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

1. **Code:** `phpcs --standard=WordPress-Extra,WordPress-Docs --extensions=php .` shows nothing.
2. **Texts:** `bin/make-pot.sh`, translate every new entry in `languages/wplus-addons-id_ID.po` (the script must report no untranslated message), run it again.
3. **Version and changelog** updated as above, the `Unreleased` section turned into the new version with today's date.
4. **Zip:** `bin/build-zip.sh`. It must hold only what the plugin needs (no `tests/`, `bin/`, `.github/`, `*.md`).
5. **Gate:** `tests/release-gate.sh dist/wplus-addons-<version>.zip`. It builds a new WordPress with an empty database, installs *that zip* and runs every
   test (the tests, the update screens against a fake GitHub, the languages) and requires an empty PHP debug log. It must end with `RELEASE GATE PASSED`.
6. **Upgrade from the last release:** install the previous release zip on a clean site, then upload the new zip over it the way a person does
   (`NEW_ZIP=<zip> node tests/upload-over-installed.mjs`). Settings and presets must stay, the plugin must stay active.
7. Commit, push, wait until CI is green.
8. **Tag** `vX.Y.Z` and push it. The Release workflow builds the zip and publishes it with the changelog section as its text.
9. **Check the release:** download the zip from the release page, compare it with the local build (`diff -r` of the unpacked folders must be empty),
   and check that a site with the previous version is offered the update (Plugins screen, or Settings > WPlus Addons > Check now).

Nothing is released without the owner asking for it.

## Updates from the dashboard

Every release after the one that introduced them can be installed from the WordPress dashboard (Plugins > Update now, or Settings > WPlus Addons).
A site that still has a version without that code needs the new zip uploaded once (step 6 above).

## Tests

See `tests/README.md`.
