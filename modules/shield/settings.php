<?php
/**
 * Settings > WPlus Security: the hardening switches and the login attempt limit.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the settings.
 */
function wplus_addons_shield_register_settings() {
	register_setting(
		'wplus_addons_shield',
		'wplus_addons_shield',
		array(
			'type'              => 'object',
			'sanitize_callback' => 'wplus_addons_shield_sanitize',
			'default'           => array(),
		)
	);
	register_setting(
		'wplus_addons_shield',
		'wplus_addons_login',
		array(
			'type'              => 'object',
			'sanitize_callback' => 'wplus_addons_login_sanitize',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'wplus_addons_shield_register_settings' );

/**
 * Add the page under Settings.
 */
function wplus_addons_shield_menu() {
	add_options_page( __( 'WPlus Security', 'wplus-addons' ), __( 'WPlus Security', 'wplus-addons' ), 'manage_options', 'wplus-security', 'wplus_addons_shield_render_page' );
}
add_action( 'admin_menu', 'wplus_addons_shield_menu' );

/**
 * A number field of the login limit.
 *
 * @param string $name  Field name in the setting.
 * @param string $label Label.
 * @param int    $value Current value.
 * @param int    $min   Smallest value.
 * @param int    $max   Largest value.
 * @param string $unit  What it counts.
 */
function wplus_addons_shield_number_row( $name, $label, $value, $min, $max, $unit ) {
	$id = 'wplus-login-' . $name;
	echo '<tr><th scope="row"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label></th><td><input type="number" class="small-text" id="' . esc_attr( $id ) . '" name="wplus_addons_login[' . esc_attr( $name ) . ']" value="' . esc_attr( (string) $value ) . '" min="' . (int) $min . '" max="' . (int) $max . '" /> <span class="description">' . esc_html( $unit ) . '</span></td></tr>';
}

/**
 * The table of the locked addresses, with the Unlock buttons.
 */
function wplus_addons_shield_render_locks() {
	$locked = array_filter(
		wplus_addons_login_state(),
		static function ( $row ) {
			return $row['until'] > time();
		}
	);
	echo '<h2>' . esc_html__( 'Locked addresses', 'wplus-addons' ) . '</h2>';
	if ( isset( $_GET['unlocked'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only message.
		echo '<div class="notice notice-success inline"><p>' . esc_html__( 'Unlocked.', 'wplus-addons' ) . '</p></div>';
	}
	if ( ! $locked ) {
		echo '<p class="description">' . esc_html__( 'No address is locked now.', 'wplus-addons' ) . '</p>';
		return;
	}
	echo '<table class="widefat striped" style="max-width:640px"><thead><tr><th>' . esc_html__( 'Address', 'wplus-addons' ) . '</th><th>' . esc_html__( 'Failed logins', 'wplus-addons' ) . '</th><th>' . esc_html__( 'Locked for', 'wplus-addons' ) . '</th><th></th></tr></thead><tbody>';
	foreach ( $locked as $key => $row ) {
		$url = wp_nonce_url( admin_url( 'admin-post.php?action=wplus_addons_unlock&key=' . rawurlencode( $key ) ), 'wplus_addons_unlock' );
		/* translators: %s: how long, for example "12 minutes" */
		echo '<tr><td>' . esc_html( $row['ip'] ) . '</td><td>' . (int) $row['count'] . '</td><td>' . esc_html( sprintf( __( '%s more', 'wplus-addons' ), human_time_diff( time(), $row['until'] ) ) ) . '</td><td><a class="button" href="' . esc_url( $url ) . '">' . esc_html__( 'Unlock', 'wplus-addons' ) . '</a></td></tr>';
	}
	echo '</tbody></table>';
	echo '<p><a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=wplus_addons_unlock' ), 'wplus_addons_unlock' ) ) . '">' . esc_html__( 'Unlock all', 'wplus-addons' ) . '</a></p>';
}

/**
 * The page: one checkbox per switch, then the login limit.
 */
function wplus_addons_shield_render_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap"><h1>' . esc_html__( 'WPlus Security', 'wplus-addons' ) . '</h1>';
	echo '<p class="description">' . esc_html__( 'Safe switches that close common gaps. This is not a firewall and not a malware scanner: keep a plugin made for that too.', 'wplus-addons' ) . '</p>';
	echo '<form method="post" action="options.php">';
	settings_fields( 'wplus_addons_shield' );
	echo '<table class="form-table" role="presentation"><tbody>';
	foreach ( wplus_addons_shield_texts() as $slug => $text ) {
		$id = 'wplus-shield-' . $slug;
		echo '<tr><th scope="row">' . esc_html( $text['title'] ) . '</th><td>';
		echo '<label for="' . esc_attr( $id ) . '"><input type="checkbox" id="' . esc_attr( $id ) . '" name="wplus_addons_shield[' . esc_attr( $slug ) . ']" value="1"' . checked( wplus_addons_shield_on( $slug ), true, false ) . ' /> ' . esc_html__( 'On', 'wplus-addons' ) . '</label>';
		echo '<p class="description">' . esc_html( $text['description'] ) . '</p>';
		if ( '' !== $text['note'] ) {
			echo '<p class="description"><strong>' . esc_html__( 'Good to know:', 'wplus-addons' ) . '</strong> ' . esc_html( $text['note'] ) . '</p>';
		}
		echo '</td></tr>';
	}
	echo '</tbody></table>';

	$s = wplus_addons_login_settings();
	echo '<h2>' . esc_html__( 'Login attempts', 'wplus-addons' ) . '</h2>';
	echo '<p class="description">' . esc_html__( 'After too many failed logins from one address, that address can not log in for a while, even with the right password. A good login starts the count again.', 'wplus-addons' ) . '</p>';
	echo '<table class="form-table" role="presentation"><tbody>';
	echo '<tr><th scope="row">' . esc_html__( 'Limit failed logins', 'wplus-addons' ) . '</th><td><label for="wplus-login-enabled"><input type="checkbox" id="wplus-login-enabled" name="wplus_addons_login[enabled]" value="1"' . checked( $s['enabled'], true, false ) . ' /> ' . esc_html__( 'On', 'wplus-addons' ) . '</label></td></tr>';
	wplus_addons_shield_number_row( 'max', __( 'Failed logins allowed', 'wplus-addons' ), $s['max'], 3, 20, __( 'times', 'wplus-addons' ) );
	wplus_addons_shield_number_row( 'window', __( 'Counted within', 'wplus-addons' ), $s['window'], 1, 1440, __( 'minutes', 'wplus-addons' ) );
	wplus_addons_shield_number_row( 'lock', __( 'Locked for', 'wplus-addons' ), $s['lock'], 1, 1440, __( 'minutes', 'wplus-addons' ) );
	echo '<tr><th scope="row"><label for="wplus-login-proxy">' . esc_html__( 'Address of the visitor', 'wplus-addons' ) . '</label></th><td><select id="wplus-login-proxy" name="wplus_addons_login[proxy]">';
	foreach ( array(
		'none' => __( 'The address of the connection (no proxy or CDN)', 'wplus-addons' ),
		'cf'   => __( 'Cloudflare (header CF-Connecting-IP)', 'wplus-addons' ),
		'xff'  => __( 'Another proxy (first address of X-Forwarded-For)', 'wplus-addons' ),
	) as $value => $label ) {
		echo '<option value="' . esc_attr( $value ) . '"' . selected( $s['proxy'], $value, false ) . '>' . esc_html( $label ) . '</option>';
	}
	echo '</select>';
	echo '<p class="description">' . esc_html__( 'Behind a proxy or CDN every visitor can look like one address, and then one person could lock everybody out. Choose the header your proxy sets only if you really use one: a header from a visitor can be faked.', 'wplus-addons' ) . '</p>';
	/* translators: %s: an IP address */
	echo '<p class="description"><strong>' . esc_html( sprintf( __( 'The plugin sees you as %s. Is that your own address?', 'wplus-addons' ), wplus_addons_login_ip() ) ) . '</strong></p></td></tr>';
	echo '<tr><th scope="row"><label for="wplus-login-allow">' . esc_html__( 'Never lock these addresses', 'wplus-addons' ) . '</label></th><td><textarea id="wplus-login-allow" name="wplus_addons_login[allow]" rows="3" class="large-text code">' . esc_textarea( $s['allow'] ) . '</textarea><p class="description">' . esc_html__( 'One address per line, for example your office.', 'wplus-addons' ) . '</p></td></tr>';
	echo '</tbody></table>';
	echo '<p class="description">' . esc_html__( 'If you lock yourself out: wait for the time above, or add define( \'WPLUS_ADDONS_DISABLE_LOGIN_LIMIT\', true ); to wp-config.php.', 'wplus-addons' ) . '</p>';
	submit_button();
	echo '</form>';
	wplus_addons_shield_render_locks();
	echo '</div>';
}
