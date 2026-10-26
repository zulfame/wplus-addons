<?php
/**
 * Settings > WPlus Addons: switch each tool on or off.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep only known tools, as booleans.
 *
 * @param mixed $input Submitted value.
 * @return array<string,bool>
 */
function wplus_addons_sanitize_modules( $input ) {
	$input = is_array( $input ) ? $input : array();
	$out   = array();
	foreach ( wplus_addons_modules() as $slug => $module ) {
		$out[ $slug ] = $module['available'] && ! empty( $input[ $slug ] );
	}
	return $out;
}

/**
 * Register the setting and the page.
 */
function wplus_addons_register_settings() {
	register_setting(
		'wplus_addons',
		'wplus_addons_modules',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'wplus_addons_sanitize_modules',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'wplus_addons_register_settings' );

/**
 * Add the page under Settings.
 */
function wplus_addons_menu() {
	add_options_page( __( 'WPlus Addons', 'wplus-addons' ), __( 'WPlus Addons', 'wplus-addons' ), 'manage_options', 'wplus-addons', 'wplus_addons_render_settings' );
}
add_action( 'admin_menu', 'wplus_addons_menu' );

/**
 * The page: one checkbox per tool.
 */
function wplus_addons_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap"><h1>' . esc_html__( 'WPlus Addons', 'wplus-addons' ) . '</h1>';
	if ( isset( $_GET['checked'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only message.
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Checked just now.', 'wplus-addons' ) . '</p></div>';
	}
	wplus_addons_render_update_box();
	echo '<form method="post" action="options.php">';
	settings_fields( 'wplus_addons' );
	echo '<table class="form-table" role="presentation"><tbody>';
	$texts = wplus_addons_module_texts();
	foreach ( wplus_addons_modules() as $slug => $module ) {
		if ( ! $module['available'] ) {
			continue; // a tool that is not built yet is not shown.
		}
		$id = 'wplus-addons-' . $slug;
		echo '<tr><th scope="row">' . esc_html( $texts[ $slug ]['title'] ) . '</th><td>';
		echo '<label for="' . esc_attr( $id ) . '"><input type="checkbox" id="' . esc_attr( $id ) . '" name="wplus_addons_modules[' . esc_attr( $slug ) . ']" value="1"' . checked( wplus_addons_module_enabled( $slug ), true, false ) . ' /> ';
		echo esc_html__( 'Switched on', 'wplus-addons' ) . '</label>';
		echo '<p class="description">' . esc_html( $texts[ $slug ]['description'] ) . '</p></td></tr>';
	}
	echo '</tbody></table>';
	submit_button();
	echo '</form></div>';
}
