<?php
/**
 * Settings > WPlus Security: the hardening switches.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the setting.
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
 * The page: one checkbox per switch, with what it does and what to know.
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
	submit_button();
	echo '</form></div>';
}
