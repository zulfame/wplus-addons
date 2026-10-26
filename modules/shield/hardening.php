<?php
/**
 * The hardening switches and what each one does. A switch that is off changes nothing.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The switches and their starting value. Everything that is safe for an ordinary site starts on; XML-RPC starts off because
 * the WordPress mobile app, Jetpack and a few other services use it.
 *
 * @return array<string,bool>
 */
function wplus_addons_shield_defaults() {
	return array(
		'version'   => true,
		'file_edit' => true,
		'headers'   => true,
		'login_msg' => true,
		'users'     => true,
		'xmlrpc'    => false,
	);
}

/**
 * Title, what it does and (where it matters) what to know, of each switch. Translated: call from the init action onwards.
 *
 * @return array<string,array{title:string,description:string,note:string}>
 */
function wplus_addons_shield_texts() {
	return array(
		'version'   => array(
			'title'       => __( 'Hide the WordPress version', 'wplus-addons' ),
			'description' => __( 'Removes the generator tag from the pages and the feeds, so bots that look for sites with an old version learn less about yours.', 'wplus-addons' ),
			'note'        => '',
		),
		'file_edit' => array(
			'title'       => __( 'Turn off the file editor', 'wplus-addons' ),
			'description' => __( 'Removes the theme and plugin code editors from the dashboard. Someone who gets into an account can not change your code from there.', 'wplus-addons' ),
			'note'        => '',
		),
		'headers'   => array(
			'title'       => __( 'Send safety headers', 'wplus-addons' ),
			'description' => __( 'Asks browsers not to guess file types, not to show your pages inside frames of other sites, and to share less of the address when a visitor leaves.', 'wplus-addons' ),
			'note'        => __( 'Other sites can no longer show your pages in a frame.', 'wplus-addons' ),
		),
		'login_msg' => array(
			'title'       => __( 'Give one message for a failed login', 'wplus-addons' ),
			'description' => __( 'The login page no longer says whether the user name exists or the password was wrong, so nobody can find out which user names are real.', 'wplus-addons' ),
			'note'        => '',
		),
		'users'     => array(
			'title'       => __( 'Hide the list of users from visitors', 'wplus-addons' ),
			'description' => __( 'Visitors who are not logged in can not list user names through ?author=1, the REST API or the sitemap. Author pages with the name in the address keep working.', 'wplus-addons' ),
			'note'        => '',
		),
		'xmlrpc'    => array(
			'title'       => __( 'Turn off XML-RPC', 'wplus-addons' ),
			'description' => __( 'XML-RPC is an old way for apps to talk to WordPress, often used by bots to guess passwords in bulk. Turning it off closes that door.', 'wplus-addons' ),
			'note'        => __( 'The WordPress mobile app, Jetpack and some publishing tools need it. Leave it off if you use one of them.', 'wplus-addons' ),
		),
	);
}

/**
 * Whether a switch is on (the saved choice, or its starting value).
 *
 * @param string $slug Switch name.
 * @return bool
 */
function wplus_addons_shield_on( $slug ) {
	$defaults = wplus_addons_shield_defaults();
	if ( ! isset( $defaults[ $slug ] ) ) {
		return false;
	}
	$saved = get_option( 'wplus_addons_shield', null );
	if ( is_array( $saved ) && array_key_exists( $slug, $saved ) ) {
		return (bool) $saved[ $slug ];
	}
	return $defaults[ $slug ];
}

/**
 * Keep only known switches, as booleans.
 *
 * @param mixed $in Submitted value.
 * @return array<string,bool>
 */
function wplus_addons_shield_sanitize( $in ) {
	$in  = is_array( $in ) ? $in : array();
	$out = array();
	foreach ( array_keys( wplus_addons_shield_defaults() ) as $slug ) {
		$out[ $slug ] = ! empty( $in[ $slug ] );
	}
	return $out;
}

/**
 * Refuse every XML-RPC request at once. The filter `xmlrpc_enabled` alone only stops the calls that need a login; the others
 * (system.listMethods, pingbacks) would still answer.
 */
function wplus_addons_shield_refuse_xmlrpc() {
	if ( defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST ) {
		status_header( 403 );
		header( 'Content-Type: text/plain; charset=UTF-8' );
		echo 'XML-RPC services are disabled on this site.';
		exit;
	}
}

/**
 * Take the pingback address out of the response headers.
 *
 * @param array<string,string> $headers Headers WordPress is about to send.
 * @return array<string,string>
 */
function wplus_addons_shield_no_pingback_header( $headers ) {
	unset( $headers['X-Pingback'] );
	return $headers;
}

/**
 * Send the safety headers on the pages of the site.
 */
function wplus_addons_shield_send_headers() {
	header( 'X-Content-Type-Options: nosniff' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	header( 'Referrer-Policy: strict-origin-when-cross-origin' );
}

/**
 * Nobody may edit theme or plugin code from the dashboard.
 *
 * @param string[] $caps Capabilities needed.
 * @param string   $cap  The capability asked about.
 * @return string[]
 */
function wplus_addons_shield_map_meta_cap( $caps, $cap ) {
	if ( in_array( $cap, array( 'edit_themes', 'edit_plugins', 'edit_files' ), true ) ) {
		return array( 'do_not_allow' );
	}
	return $caps;
}

/**
 * A visitor asking for ?author=<number> goes to the home page instead of learning the user name.
 */
function wplus_addons_shield_block_author_query() {
	if ( is_user_logged_in() ) {
		return;
	}
	if ( isset( $_GET['author'] ) && is_numeric( wp_unslash( $_GET['author'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a visitor's address, nothing is changed.
		wp_safe_redirect( home_url( '/' ), 301 );
		exit;
	}
}

/**
 * Visitors who are not logged in get no user routes in the REST API.
 *
 * @param array<string,mixed> $endpoints Routes.
 * @return array<string,mixed>
 */
function wplus_addons_shield_rest_endpoints( $endpoints ) {
	if ( is_user_logged_in() ) {
		return $endpoints;
	}
	foreach ( array_keys( $endpoints ) as $route ) {
		if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
			unset( $endpoints[ $route ] );
		}
	}
	return $endpoints;
}

/**
 * No user list in the sitemap.
 *
 * @param object|false $provider Sitemap provider.
 * @param string       $name     Its name.
 * @return object|false
 */
function wplus_addons_shield_sitemap_provider( $provider, $name ) {
	return 'users' === $name ? false : $provider;
}

/**
 * One message for every failed login.
 *
 * @param WP_Error $errors Errors of the login page.
 * @return WP_Error
 */
function wplus_addons_shield_login_errors( $errors ) {
	if ( ! $errors instanceof WP_Error ) {
		return $errors;
	}
	$hit = false;
	foreach ( array( 'invalid_username', 'invalid_email', 'incorrect_password' ) as $code ) {
		if ( $errors->get_error_message( $code ) ) {
			$errors->remove( $code );
			$hit = true;
		}
	}
	if ( $hit ) {
		$errors->add( 'wplus_login_failed', __( '<strong>Error:</strong> The user name or the password is not right.', 'wplus-addons' ) );
	}
	return $errors;
}

/**
 * Put the switches that are on to work.
 */
function wplus_addons_shield_boot() {
	if ( wplus_addons_shield_on( 'xmlrpc' ) ) {
		wplus_addons_shield_refuse_xmlrpc();
		add_filter( 'xmlrpc_enabled', '__return_false' );
		add_filter( 'wp_headers', 'wplus_addons_shield_no_pingback_header' );
		remove_action( 'wp_head', 'rsd_link' );
	}
	if ( wplus_addons_shield_on( 'version' ) ) {
		remove_action( 'wp_head', 'wp_generator' );
		add_filter( 'the_generator', '__return_empty_string' );
	}
	if ( wplus_addons_shield_on( 'file_edit' ) ) {
		add_filter( 'map_meta_cap', 'wplus_addons_shield_map_meta_cap', 10, 2 );
	}
	if ( wplus_addons_shield_on( 'headers' ) ) {
		add_action( 'send_headers', 'wplus_addons_shield_send_headers' );
	}
	if ( wplus_addons_shield_on( 'login_msg' ) ) {
		add_filter( 'wp_login_errors', 'wplus_addons_shield_login_errors' );
	}
	if ( wplus_addons_shield_on( 'users' ) ) {
		add_action( 'template_redirect', 'wplus_addons_shield_block_author_query', 0 );
		add_filter( 'rest_endpoints', 'wplus_addons_shield_rest_endpoints' );
		add_filter( 'wp_sitemaps_add_provider', 'wplus_addons_shield_sitemap_provider', 10, 2 );
	}
}
wplus_addons_shield_boot();
