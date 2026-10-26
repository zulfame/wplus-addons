# WPlus Addons

Small, optional tools for [WPlus UI](https://github.com/zulfame/wplus-ui) and any other WordPress theme. Each tool can be switched off in **Settings > WPlus Addons**, and WordPress works the same without the plugin.

| Tool | Status |
| --- | --- |
| Thumbnail generator | ready |
| Light security hardening | planned |

Requires WordPress 6.3 and PHP 7.4. Licence: GPL-2.0-or-later (the bundled fonts are under the SIL Open Font License, see below).

## Thumbnail generator

Makes a cover picture for a post from its title, excerpt, tags and your site, and uses it as the featured image. The picture is drawn **in your browser** on a canvas: nothing is sent to another site, and no extra plugin or server library is needed.

### Tools > Thumbnail > Generator

- **Layouts:** Minimal (a thin frame), Dots (a soft 3D ring of dots in the corner) and Panel (a bar, the brand and tags in a footer).
- **Choices:** alignment, title, description, organization, logo (from the Media Library), two tags, theme color, light or dark mode, font (DM Sans, Inter, Lora or the system font) and size (1200 x 630 for sharing, 16:9, 4:3 or 1:1).
- **Colors follow one choice:** pick the theme color and the mode; the tint, glow, frame, dots, bar, tag outlines and even the text and dark background lean towards it.
- **Empty fields are fine:** an empty description, tags, organization or logo simply disappear and the text rearranges. Long titles shrink to fit, then end with "…".
- **Export** downloads the picture as **WebP** (the default: much lighter, good for page speed and SEO) or PNG. A browser that cannot make WebP gets a PNG.
- **Save to Media Library** stores it with the title, alt text and description filled in.

### The editor panel

In the block editor, open the **Post** tab and the **Thumbnail** panel. It fills itself from the post (title, excerpt or the start of the text, the first two tags or categories, the site name and logo), shows a preview and has one button that makes the picture, saves it attached to the post and sets it as the featured image. Update the post to keep it.

### Bulk

**Tools > Thumbnail > Bulk** lists the posts that have no featured image. Tick the ones you want and press **Make the pictures**: each gets its own picture, one after another, with a progress bar and a **Stop** button. A post that already has (or got, meanwhile) a featured image is never changed. Up to 200 posts are listed at once; run it again for the rest.

### Presets

A preset is a named set of design choices (layout, alignment, color, mode, font, size, logo, organization), not the texts. Administrators save, update and delete presets under **Manage presets**, and can make one the default starting point. Everyone who makes thumbnails can pick them, in the Generator, in Bulk and in the editor panel. Without a default preset the starting color follows WPlus UI when that theme is active, else a neutral blue. Your last choices are also remembered in your browser.

### Who can do what

| Action | Needs |
| --- | --- |
| Use the tools and the editor panel | permission to upload files |
| Bulk: posts listed | posts you may edit (authors see their own) |
| Save, update or delete presets | permission to manage options (administrators) |

Saving goes through the REST API of WordPress itself (`/wp/v2/media`, `/wp/v2/posts`, `/wp/v2/settings`), so WordPress checks who may do what and what the file is. The plugin adds no endpoint of its own.

## Privacy

- No request to any other site. The fonts are part of the plugin.
- Your last design choices stay in your browser (`localStorage`). Presets are one option in the site database.
- Deleting the plugin removes its settings and presets (the pictures you made stay in the Media Library).

## Languages

English and Indonesian (`languages/`). The plugin follows the language of each user.

## Fonts and licences

DM Sans, Inter and Lora (Latin subset, regular and bold) are included under the SIL Open Font License 1.1; the licence files are in `modules/thumbnail/fonts/`.

## Development

```bash
bin/build-zip.sh            # dist/wplus-addons-<version>.zip
node tests/run-all.mjs      # every test, one after the other
```

- PHP follows the WordPress coding standards (`phpcs --standard=WordPress-Extra,WordPress-Docs`); CI runs it, builds the zip and checks the syntax on every push.
- The tests drive a real WordPress with Chrome. See `tests/README.md`.
- Strings: `bin/make-pot.sh` rebuilds `languages/wplus-addons.pot`, updates every `.po` and compiles the `.mo` files (needs gettext). Translate the new entries in `languages/wplus-addons-id_ID.po`, then run it again.
- Releases: update the version in `wplus-addons.php`, `readme.txt` and `CHANGELOG.md`, then push a `v*` tag; the Release workflow builds the zip and publishes it with the changelog section as its text.

## Layout of the code

```
wplus-addons.php            plugin header, text domain, loads the tools that are on
includes/                   the list of tools and the settings page
modules/thumbnail/          module.php (page, editor assets), bulk.php, presets.php
  assets/renderer.js        draws the picture (used by every screen)
  assets/common.js          helpers shared by the screens
  assets/admin.js           Generator tab    assets/bulk.js  Bulk tab    assets/editor.js  editor panel
  fonts/                    DM Sans, Inter, Lora (OFL)
languages/                  .pot, id_ID .po and .mo
tests/                      browser tests
```
