<?php
/**
 * Updates from the GitHub releases of the plugin's public repository.
 *
 * WordPress shows "update available" under Plugins and Dashboard > Updates, with an Update button, a "View version details" window
 * and optional automatic updates. The plugin header carries `Update URI: https://github.com/zulfame/wplus-addons`, so WordPress
 * never asks wordpress.org about this plugin (another plugin with the same name there can not send an update to this one), and
 * asks GitHub through the filter `update_plugins_github.com` whenever it checks its plugins (twice a day, and again when the
 * Plugins or Updates screen is opened), reusing an answer under 15 minutes old. Only the IP address of the site and a user
 * agent with the plugin version reach GitHub. The zip is checked against the checksum GitHub published before it is installed.
 * Turn it off with `define( 'WPLUS_ADDONS_DISABLE_UPDATES', true );` in wp-config.php or the `wplus_addons_updates_enabled` filter.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether update checks are on.
 *
 * @return bool
 */
function wplus_addons_updates_enabled() {
	$on = ! ( defined( 'WPLUS_ADDONS_DISABLE_UPDATES' ) && WPLUS_ADDONS_DISABLE_UPDATES );
	return (bool) apply_filters( 'wplus_addons_updates_enabled', $on );
}

/**
 * Repository (owner/name) that publishes the releases.
 *
 * @return string
 */
function wplus_addons_update_repo() {
	return (string) apply_filters( 'wplus_addons_update_repo', 'zulfame/wplus-addons' );
}

/**
 * Address of the "latest release" answer.
 *
 * @return string
 */
function wplus_addons_update_api_url() {
	return (string) apply_filters( 'wplus_addons_update_api_url', 'https://api.github.com/repos/' . wplus_addons_update_repo() . '/releases/latest' );
}

/**
 * Only files that live under this address are ever offered for download.
 *
 * @return string
 */
function wplus_addons_update_package_prefix() {
	return (string) apply_filters( 'wplus_addons_update_package_prefix', 'https://github.com/' . wplus_addons_update_repo() . '/releases/download/' );
}

/**
 * The plugin file as WordPress knows it (wplus-addons/wplus-addons.php).
 *
 * @return string
 */
function wplus_addons_plugin_file() {
	return plugin_basename( WPLUS_ADDONS_FILE );
}

/**
 * Turn the API answer into the few facts the plugin needs, or null when it is not a usable release.
 *
 * @param mixed $data Decoded JSON.
 * @return array<string,string>|null
 */
function wplus_addons_parse_release( $data ) {
	if ( ! is_array( $data ) || empty( $data['tag_name'] ) || ! empty( $data['draft'] ) || ! empty( $data['prerelease'] ) ) {
		return null;
	}
	$version = ltrim( (string) $data['tag_name'], 'vV' );
	if ( ! preg_match( '/^\d+\.\d+\.\d+$/', $version ) ) {
		return null;
	}
	$package = '';
	$sha256  = '';
	foreach ( (array) ( isset( $data['assets'] ) ? $data['assets'] : array() ) as $asset ) {
		if ( is_array( $asset ) && isset( $asset['name'], $asset['browser_download_url'] ) && 'wplus-addons-' . $version . '.zip' === $asset['name'] ) {
			$package = esc_url_raw( (string) $asset['browser_download_url'] );
			if ( isset( $asset['digest'] ) && preg_match( '/^sha256:([a-f0-9]{64})$/i', (string) $asset['digest'], $m ) ) {
				$sha256 = strtolower( $m[1] );
			}
		}
	}
	if ( '' === $package || 0 !== strpos( $package, wplus_addons_update_package_prefix() ) ) {
		return null;
	}
	return array(
		'checked'   => (string) time(),
		'version'   => $version,
		'package'   => $package,
		'sha256'    => $sha256,
		'notes'     => isset( $data['body'] ) ? (string) $data['body'] : '',
		'published' => isset( $data['published_at'] ) ? (string) $data['published_at'] : '',
		'page'      => isset( $data['html_url'] ) ? esc_url_raw( (string) $data['html_url'] ) : '',
	);
}

/**
 * The latest release, from the cache or (when the cache is empty, older than $max_age or $force is set) from GitHub.
 * A failed request is remembered for 15 minutes so a slow or blocked connection does not slow every admin page.
 * An old answer never hides a release made since: WordPress asks within 15 minutes and gets a fresh answer.
 *
 * @param bool $force   Ask GitHub now.
 * @param int  $max_age Oldest cached answer to accept, in seconds.
 * @return array<string,string>|null
 */
function wplus_addons_latest_release( $force = false, $max_age = HOUR_IN_SECONDS ) {
	if ( ! wplus_addons_updates_enabled() ) {
		return null;
	}
	$cached = get_site_transient( 'wplus_addons_latest_release' );
	if ( is_array( $cached ) && array_diff( array( 'checked', 'version', 'package', 'sha256', 'notes', 'published', 'page' ), array_keys( $cached ) ) ) {
		$cached = false;
	}
	if ( is_array( $cached ) && time() - (int) $cached['checked'] > $max_age ) {
		$cached = false;
	}
	if ( ! $force && false !== $cached ) {
		return is_array( $cached ) ? $cached : null;
	}
	$response = wp_remote_get(
		wplus_addons_update_api_url(),
		array(
			'timeout'     => 8,
			'redirection' => 3,
			'headers'     => array(
				'Accept'     => 'application/vnd.github+json',
				'User-Agent' => 'WPlusAddons/' . WPLUS_ADDONS_VERSION,
			),
		)
	);
	$release  = null;
	if ( ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response ) ) {
		$release = wplus_addons_parse_release( json_decode( wp_remote_retrieve_body( $response ), true ) );
	}
	set_site_transient( 'wplus_addons_latest_release', $release ? $release : 'none', $release ? 12 * HOUR_IN_SECONDS : 15 * MINUTE_IN_SECONDS );
	return $release;
}

/**
 * Answer WordPress when it checks this plugin (the plugin header has an Update URI on github.com).
 * The answer is given for the same version too, so WordPress can show the automatic updates switch.
 *
 * @param array|false $update      Answer so far.
 * @param array       $plugin_data Plugin header data.
 * @param string      $plugin_file Plugin file.
 * @return array|false
 */
function wplus_addons_update_for_core( $update, $plugin_data, $plugin_file ) {
	if ( wplus_addons_plugin_file() !== $plugin_file || ! wplus_addons_updates_enabled() ) {
		return $update;
	}
	$release = wplus_addons_latest_release( false, 15 * MINUTE_IN_SECONDS );
	if ( ! $release ) {
		return $update;
	}
	return array(
		'id'           => 'github.com/' . wplus_addons_update_repo(),
		'slug'         => 'wplus-addons',
		'plugin'       => $plugin_file,
		'version'      => $release['version'],
		'url'          => 'https://github.com/' . wplus_addons_update_repo(),
		'package'      => version_compare( $release['version'], (string) $plugin_data['Version'], '>' ) ? $release['package'] : '',
		'requires'     => '6.3',
		'requires_php' => '7.4',
		'tested'       => '',
	);
}
add_filter( 'update_plugins_github.com', 'wplus_addons_update_for_core', 10, 3 );

/**
 * A small, safe subset of Markdown (bullet lists, bold labels, code) for the release notes.
 *
 * @param string $text Markdown from the release or the changelog.
 * @return string HTML.
 */
function wplus_addons_notes_html( $text ) {
	$html    = '';
	$in_list = false;
	foreach ( preg_split( '/\R/', (string) $text ) as $line ) {
		$line = rtrim( $line );
		if ( preg_match( '/^\s*[-*]\s+(.*)$/', $line, $m ) ) {
			$item    = esc_html( $m[1] );
			$item    = preg_replace( '/^(New|Fix|Improved|Safe|Changed):/', '<strong>$1:</strong>', $item );
			$item    = preg_replace( '/`([^`]+)`/', '<code>$1</code>', $item );
			$html   .= ( $in_list ? '' : '<ul>' ) . '<li>' . $item . '</li>';
			$in_list = true;
			continue;
		}
		if ( $in_list ) {
			$html   .= '</ul>';
			$in_list = false;
		}
		if ( '' !== trim( $line ) ) {
			$html .= '<p>' . esc_html( $line ) . '</p>';
		}
	}
	return $html . ( $in_list ? '</ul>' : '' );
}

/**
 * The text of the changelog of the installed version (its first section), for when GitHub can not be asked.
 *
 * @return string
 */
function wplus_addons_installed_changelog() {
	$file = WPLUS_ADDONS_DIR . 'readme.txt';
	if ( ! is_readable( $file ) ) {
		return '';
	}
	$out = array();
	$on  = false;
	foreach ( preg_split( '/\R/', (string) file_get_contents( $file ) ) as $line ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.
		if ( preg_match( '/^= .+ =$/', $line ) ) {
			if ( $on ) {
				break;
			}
			$on = true;
			continue;
		}
		if ( $on && preg_match( '/^\*\s+(.*)$/', $line, $m ) ) {
			$out[] = '- ' . $m[1];
		}
	}
	return implode( "\n", $out );
}

/**
 * The "View version details" window of the Plugins screen.
 *
 * @param false|object|array $result Answer so far.
 * @param string             $action  plugin_information, query_plugins, ...
 * @param object             $args    Request (slug).
 * @return false|object|array
 */
function wplus_addons_plugin_information( $result, $action, $args ) {
	if ( 'plugin_information' !== $action || ! is_object( $args ) || ! isset( $args->slug ) || 'wplus-addons' !== $args->slug || ! wplus_addons_updates_enabled() ) {
		return $result;
	}
	$release = wplus_addons_latest_release();
	$version = $release ? $release['version'] : WPLUS_ADDONS_VERSION;
	$notes   = $release ? $release['notes'] : wplus_addons_installed_changelog();
	return (object) array(
		'name'          => 'WPlus Addons',
		'slug'          => 'wplus-addons',
		'version'       => $version,
		'author'        => '<a href="https://github.com/zulfame">Zulfadli Rizal</a>',
		'homepage'      => 'https://github.com/' . wplus_addons_update_repo(),
		'requires'      => '6.3',
		'requires_php'  => '7.4',
		'last_updated'  => $release ? $release['published'] : '',
		'download_link' => $release ? $release['package'] : '',
		'sections'      => array(
			'description' => '<p>' . esc_html__( 'Small, optional tools for WPlus UI and any WordPress site. Each tool can be switched off.', 'wplus-addons' ) . '</p>',
			'changelog'   => wplus_addons_notes_html( $notes ),
		),
	);
}
add_filter( 'plugins_api', 'wplus_addons_plugin_information', 10, 3 );

/**
 * Check the zip against the checksum GitHub published for it before WordPress installs it.
 *
 * @param bool|string|WP_Error $reply   Earlier answer; false when nobody handled the download yet.
 * @param string               $package Address of the package.
 * @return bool|string|WP_Error
 */
function wplus_addons_verify_download( $reply, $package ) {
	if ( false !== $reply || ! wplus_addons_updates_enabled() ) {
		return $reply;
	}
	$cached = get_site_transient( 'wplus_addons_latest_release' );
	if ( ! is_array( $cached ) || ! isset( $cached['package'], $cached['sha256'] ) || $package !== $cached['package'] || '' === $cached['sha256'] ) {
		return $reply;
	}
	$file = download_url( $package );
	if ( is_wp_error( $file ) ) {
		return $file;
	}
	if ( ! hash_equals( $cached['sha256'], (string) hash_file( 'sha256', $file ) ) ) {
		wp_delete_file( $file );
		return new WP_Error( 'wplus_addons_checksum', __( 'The downloaded plugin file does not match its checksum, so it was not installed.', 'wplus-addons' ) );
	}
	return $file;
}
add_filter( 'upgrader_pre_download', 'wplus_addons_verify_download', 10, 2 );

/**
 * Check now: ask again, and let WordPress run its plugin check with the fresh answer.
 */
function wplus_addons_check_updates_now() {
	if ( ! current_user_can( 'update_plugins' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'wplus-addons' ), 403 );
	}
	check_admin_referer( 'wplus_addons_check_updates' );
	wplus_addons_latest_release( true );
	delete_site_transient( 'update_plugins' );
	wp_update_plugins();
	wp_safe_redirect( add_query_arg( 'checked', '1', admin_url( 'options-general.php?page=wplus-addons' ) ) );
	exit;
}
add_action( 'admin_post_wplus_addons_check_updates', 'wplus_addons_check_updates_now' );

/**
 * The update box at the top of Settings > WPlus Addons.
 */
function wplus_addons_render_update_box() {
	if ( ! current_user_can( 'update_plugins' ) ) {
		return;
	}
	echo '<div class="card" style="max-width:640px;margin:16px 0 8px;padding:4px 20px 14px">';
	if ( ! wplus_addons_updates_enabled() ) {
		echo '<p><strong>' . esc_html__( 'Update checks are turned off for this site.', 'wplus-addons' ) . '</strong></p></div>';
		return;
	}
	$release = wplus_addons_latest_release();
	$newer   = $release && version_compare( $release['version'], WPLUS_ADDONS_VERSION, '>' );
	if ( $newer ) {
		/* translators: %s: version number */
		echo '<p><strong>' . esc_html( sprintf( __( 'Version %s is available', 'wplus-addons' ), $release['version'] ) ) . '</strong> ';
		/* translators: %s: version number */
		echo '<span class="description">' . esc_html( sprintf( __( 'You have version %s.', 'wplus-addons' ), WPLUS_ADDONS_VERSION ) ) . '</span></p>';
	} elseif ( $release ) {
		/* translators: %s: version number */
		echo '<p><span class="dashicons dashicons-yes-alt" style="color:#00a32a"></span> <strong>' . esc_html( sprintf( __( 'You have the latest version (%s)', 'wplus-addons' ), WPLUS_ADDONS_VERSION ) ) . '</strong></p>';
	} else {
		/* translators: %s: version number */
		echo '<p><span class="dashicons dashicons-warning" style="color:#996800"></span> <strong>' . esc_html( sprintf( __( 'Version %s. The latest version could not be checked right now.', 'wplus-addons' ), WPLUS_ADDONS_VERSION ) ) . '</strong></p>';
	}
	echo '<p style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
	if ( $newer ) {
		$file = wplus_addons_plugin_file();
		echo '<a class="button button-primary" href="' . esc_url( wp_nonce_url( self_admin_url( 'update.php?action=upgrade-plugin&plugin=' . rawurlencode( $file ) ), 'upgrade-plugin_' . $file ) ) . '">' . esc_html__( 'Update now', 'wplus-addons' ) . '</a>';
	}
	echo '<a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=wplus_addons_check_updates' ), 'wplus_addons_check_updates' ) ) . '">' . esc_html__( 'Check now', 'wplus-addons' ) . '</a>';
	if ( $release && '' !== $release['checked'] ) {
		/* translators: %s: how long ago, for example "5 minutes" */
		echo '<span class="description">' . esc_html( sprintf( __( 'Last checked %s ago.', 'wplus-addons' ), human_time_diff( (int) $release['checked'] ) ) ) . '</span>';
	}
	echo '</p></div>';
}
