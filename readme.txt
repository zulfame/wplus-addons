=== WPlus Addons ===
Contributors: zulfame
Tags: thumbnail, featured image, webp, cover image, hardening
Requires at least: 6.3
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Small, optional tools for WPlus UI and any WordPress site: a thumbnail generator and light security hardening. Each tool can be switched off.

== Description ==

Small, optional tools for WPlus UI and any WordPress theme. Each tool can be switched off in Settings > WPlus Addons.

= Thumbnail generator =

Make a cover picture for a post from its title, excerpt, tags and your site, and use it as the featured image. The picture is drawn in your browser: nothing is sent to another site.

* Three layouts (Minimal, Dots, Panel), left, center or right text, light or dark, your own theme color, logo, organization, two tags, three fonts and four sizes.
* Colors follow the theme color and the mode. Empty fields simply disappear, and long titles shrink to fit.
* Download as WebP (the default: lighter and better for page speed and SEO) or PNG, or save it straight to the Media Library with its title, alt text and description.
* A Thumbnail panel in the post editor makes the picture and sets the featured image with one button.
* A Bulk tab makes the featured image of many posts that have none, with a progress bar and a Stop button. A post that already has a featured image is never changed.
* Presets: named design choices shared by the whole site, one of them as the starting point.

= Light security hardening =

Six safe switches under Settings > WPlus Security (switch the tool on in Settings > WPlus Addons first): hide the WordPress version, turn off the file editor, send safety headers, give one message for a failed login, hide the list of users from visitors, and turn off XML-RPC (off to start with, because some apps need it). It also limits failed logins: after 5 failed logins from one address (changeable), that address is locked for 15 minutes, with a list of locked addresses, an Unlock button, an allow list and a setting for sites behind Cloudflare or another proxy. It is not a firewall and not a malware scanner.

The second tab, Security check, is a plain-language list of what is fine, worth a look or needs attention (WordPress, PHP, updates waiting, unused plugins, an administrator called admin, open registration, https, debug mode, wp-config.php permissions, the file editor, the login limit, a security plugin, a backup plugin), with a button to the place where you fix it. A button also checks whether files that should be secret (.env, .git, debug.log, database dumps and similar) can be opened by anyone; it asks only the address of your own site.

== Installation ==

1. Upload the zip in Plugins > Add New > Upload Plugin, or unpack it in `wp-content/plugins/`.
2. Activate WPlus Addons.
3. Open Tools > Thumbnail. The tools can be switched on or off in Settings > WPlus Addons.

== Frequently Asked Questions ==

= Does it send my pictures or texts anywhere? =

No. The picture is drawn in your browser and saved to your own Media Library. The fonts are part of the plugin. The only request to another site is the update check: it asks GitHub for the latest version and sends only the address of your site and the plugin version. Add `define( 'WPLUS_ADDONS_DISABLE_UPDATES', true );` to wp-config.php to turn it off.

= How do I update? =

Like any plugin: a new version appears under Plugins and Dashboard > Updates, with an Update button and optional automatic updates. Settings > WPlus Addons shows your version and has a Check now button.

= Is it a security plugin? =

Only a light one: the switches close common gaps and every switch is explained on its page. It does not scan for malware and is not a firewall, so keep a plugin made for that too. Nothing changes until you switch the tool on.

= I locked myself out of my site. What now? =

Wait for the lock time (15 minutes to start with), or add `define( 'WPLUS_ADDONS_DISABLE_LOGIN_LIMIT', true );` to wp-config.php. Another administrator can also press Unlock under Settings > WPlus Security. If your site is behind Cloudflare or another proxy, choose it on that page so that visitors are told apart.

= Who can use it? =

Anyone who may upload files. Only administrators can save presets. In Bulk, authors see only their own posts.

= Why WebP? =

A WebP picture is several times lighter than a PNG of the same picture, which helps page speed and SEO. If a browser cannot make WebP, a PNG is made instead.

= Why are some posts not in the Bulk list? =

Only posts without a featured image that you may edit are listed, newest first, up to 200 at a time. Run it again for the rest.

= Can I use another font or my own layout? =

Not yet. The fonts are DM Sans, Inter, Lora and the system font.

= What does it store about people? =

Only if the login limit is on: the IP address of an address with failed logins and how many, for a short time (at most 200 addresses), so that it can be locked. No user name or password is kept. The text for your privacy policy is in Settings > Privacy > Policy guide.

= What happens when I delete the plugin? =

Its settings, presets and the counts of failed logins are removed. The pictures you made stay in the Media Library.

== Third-party notices ==

The plugin includes the fonts DM Sans, Inter and Lora (Latin subset, regular and bold) under the SIL Open Font License 1.1. The licence files are in `modules/thumbnail/fonts/`.

== Changelog ==

= 0.1.0 =

* First skeleton: the settings page and the tool switches.
* New: Tools > Thumbnail with live preview, WebP or PNG download and Save to Media Library.
* New: Thumbnail panel in the post editor that sets the featured image.
* New: presets shared by the site, with one as the starting point.
* New: Bulk tab that makes the featured image of many posts without one.
