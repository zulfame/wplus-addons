# Tests

The tests drive a real WordPress with Chrome, so they need:

1. A WordPress install with this plugin active (the folder of this plugin is `wp-content/plugins/wplus-addons`), served at `BASE_URL` (default `http://127.0.0.1:8091`), for example from the WordPress folder:

   ```bash
   PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8091 -t .
   ```

2. `puppeteer-core` in `WP_ROOT/node_modules` (`WP_ROOT` defaults to the WordPress folder this plugin sits in) and Chrome (`CHROME_PATH`, default the macOS path).

Run everything (one test after the other, they share one WordPress, so never in parallel):

```bash
node tests/run-all.mjs
```

or one file, for example `node tests/thumbnail-bulk.mjs`. Every test prints `PASS`/`FAIL` lines and a last line `SUMMARY pass=N fail=M`, and exits with 1 when something failed.

| File | What it checks |
| --- | --- |
| `thumbnail-render.mjs` | every layout, mode, alignment and size with full, empty and extreme texts: drawn, right size, not blank, follows the theme color |
| `thumbnail-media.mjs` | WebP default, real WebP/PNG export files, Save to Media Library, permissions |
| `thumbnail-presets.mjs` | save, update, default, delete, bad data cleaned, author rights, editor picker |
| `thumbnail-editor.mjs` | block editor panel and the featured image it sets |
| `thumbnail-bulk.mjs` | the Bulk tab: list, make, skip, stop, permissions, narrow screen |
| `lifecycle.mjs` | tools on and off, unavailable tool, deactivate and activate, uninstall |
| `i18n.mjs` | Indonesian and English |
| `updater.mjs` | the answers WordPress gets from the update check: newer, same, older, bad releases, cache, GitHub down, checksum, version details |
| `updater-screens.mjs` | the update screens a person uses (Update now, Plugins screen, Check now, version details, wrong checksum); clean site only, last |
| `upload-over-installed.mjs` | uploading a new zip over the installed plugin (needs `NEW_ZIP`); clean site only |

The tests create their own posts, users and pictures and remove them at the end, and put the administrator's language back.

**The release gate:** `tests/release-gate.sh dist/wplus-addons-<version>.zip` builds a throw-away WordPress (`tests/clean-site.sh`: new files, new database `wpa_clean`), installs that zip, runs everything and requires an empty PHP debug log. Run the tests that replace the plugin folder (`updater-screens`, `upload-over-installed`) only there.
