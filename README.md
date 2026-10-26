# WPlus Addons

Small, optional tools for [WPlus UI](https://github.com/zulfame/wplus-ui) and any WordPress site. Each tool can be switched off in Settings > WPlus Addons.

- **Thumbnail generator** (in progress): make a cover picture from a post's title and description and use it as the featured image.
- **Light security hardening** (planned).

Requires WordPress 6.3 and PHP 7.4. Licence: GPL-2.0-or-later.

## Development

- `bin/build-zip.sh` builds `dist/wplus-addons-<version>.zip`.
- PHP follows the WordPress coding standards (`phpcs --standard=WordPress-Extra,WordPress-Docs`); CI runs it on every push.
- Releases: update the version in `wplus-addons.php`, `readme.txt` and `CHANGELOG.md`, then push a `v*` tag.
