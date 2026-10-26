#!/usr/bin/env bash
# A throw-away WordPress to test a plugin zip the way a visitor of the release page would: fresh database, fresh files, plugin
# installed from the zip. It only ever creates and drops the database `wpa_clean` and the folder it made itself.
#
#   tests/clean-site.sh create dist/wplus-addons-0.1.0.zip   # builds the site, prints the folder; serves it on 127.0.0.1:8099
#   WP_ROOT=<folder> BASE_URL=http://127.0.0.1:8099 node tests/run-all.mjs
#   tests/clean-site.sh destroy                               # stops the server, drops the database, deletes the folder
#
# Needs: a WordPress folder to copy the core from (SOURCE_WP, default the WordPress this plugin sits in), `php`, `mysql` (root without
# password on localhost), `rsync`, `unzip`. CLEAN_DIR and CLEAN_PORT can change the folder and port.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SOURCE_WP="${SOURCE_WP:-$(cd "$HERE/../../../.." && pwd)}"
DIR="${CLEAN_DIR:-${TMPDIR:-/tmp}/wpa-clean-site}"
PORT="${CLEAN_PORT:-8099}"
DB="wpa_clean"
MARK="$DIR/.wpa-clean-site"

# php -S with workers leaves child processes behind when only its main process is stopped, so stop everything that serves our port
stop_server() {
	[[ -f "$DIR/server.pid" ]] && kill "$(cat "$DIR/server.pid")" 2>/dev/null || true
	pkill -f "php -S 127.0.0.1:$PORT" 2>/dev/null || true
	sleep 1
}

case "${1:-}" in
create)
	ZIP="${2:?usage: clean-site.sh create <plugin zip>}"
	[[ -f "$ZIP" ]] || { echo "no such zip: $ZIP" >&2; exit 1; }
	ZIP="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"
	"$0" destroy >/dev/null 2>&1 || true
	mkdir -p "$DIR" && touch "$MARK"
	rsync -a --exclude='/wp-config.php' --exclude='/wp-content/' --exclude='/.git*' --exclude='/node_modules/' --exclude='/dist/' --exclude='/tests/' --exclude='/docs/' --exclude='/bin/' --exclude='/.github/' --exclude='/*.md' --exclude='/package*.json' "$SOURCE_WP/" "$DIR/"
	mkdir -p "$DIR/wp-content/plugins" "$DIR/wp-content/themes" "$DIR/wp-content/uploads" "$DIR/wp-content/languages"
	cp "$SOURCE_WP/wp-content/index.php" "$DIR/wp-content/" 2>/dev/null || echo '<?php // Silence is golden.' > "$DIR/wp-content/index.php"
	THEME="$(ls -d "$SOURCE_WP"/wp-content/themes/twenty* 2>/dev/null | tail -1 || true)"
	[[ -n "$THEME" ]] && cp -R "$THEME" "$DIR/wp-content/themes/"
	ln -s "$SOURCE_WP/node_modules" "$DIR/node_modules"
	mysql -u root -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4;"
	cat > "$DIR/wp-config.php" <<PHP
<?php
define( 'DB_NAME', '$DB' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );
define( 'AUTH_KEY', 'a' ); define( 'SECURE_AUTH_KEY', 'b' ); define( 'LOGGED_IN_KEY', 'c' ); define( 'NONCE_KEY', 'd' );
define( 'AUTH_SALT', 'e' ); define( 'SECURE_AUTH_SALT', 'f' ); define( 'LOGGED_IN_SALT', 'g' ); define( 'NONCE_SALT', 'h' );
\$table_prefix = 'wp_';
define( 'WP_HOME', 'http://127.0.0.1:$PORT' );
define( 'WP_SITEURL', 'http://127.0.0.1:$PORT' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'FS_METHOD', 'direct' );
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
require_once ABSPATH . 'wp-settings.php';
PHP
	(cd "$DIR" && php -r 'define("WP_INSTALLING", true); require "wp-load.php"; require ABSPATH . "wp-admin/includes/upgrade.php"; wp_install("WPA clean site", "admin", "admin@example.invalid", true, "", "x-Test-9aQ!zz");' >/dev/null)
	unzip -q -o "$ZIP" -d "$DIR/wp-content/plugins/"
	(cd "$DIR" && php -r 'require "wp-load.php"; require_once ABSPATH . "wp-admin/includes/plugin.php"; $r = activate_plugin("wplus-addons/wplus-addons.php"); if (is_wp_error($r)) { fwrite(STDERR, $r->get_error_message() . "\n"); exit(1); }')
	# a router so that pretty permalinks (and files like /wp-sitemap.xml) work like on a real server: a file or folder that exists is served
	# as it is, everything else goes to WordPress
	cat > "$DIR/router.php" <<'PHP'
<?php
$path = rawurldecode( (string) parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) );
$file = __DIR__ . $path;
if ( '/' !== $path && ( is_file( $file ) || ( is_dir( $file ) && is_file( rtrim( $file, '/' ) . '/index.php' ) ) ) ) {
	return false;
}
$_SERVER['SCRIPT_NAME']     = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';
require __DIR__ . '/index.php';
PHP
	# the server must not keep the output of this script open, or whoever runs the script would wait for it for ever
	cd "$DIR"
	PHP_CLI_SERVER_WORKERS=4 nohup php -S "127.0.0.1:$PORT" -t . "$DIR/router.php" > "$DIR/server.log" 2>&1 < /dev/null &
	echo $! > "$DIR/server.pid"
	sleep 2
	echo "clean site ready: $DIR (http://127.0.0.1:$PORT)"
	;;
destroy)
	stop_server
	mysql -u root -e "DROP DATABASE IF EXISTS \`$DB\`;" 2>/dev/null || true
	[[ -f "$MARK" ]] && rm -rf "$DIR"
	echo "clean site removed"
	;;
*)
	echo "usage: clean-site.sh create <plugin zip> | destroy" >&2
	exit 1
	;;
esac
