<?php
/**
 * Thumbnail presets: named sets of design choices that the whole site shares, and one of them can be the starting point.
 * Saved in one option through the REST settings of WordPress itself, so only people who may manage options can change them.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Most presets that can be saved.
 *
 * @return int
 */
function wplus_addons_thumbnail_max_presets() {
	return 20;
}

/**
 * The accent color to start from: the WPlus UI accent when that theme (or its child) is active, else a neutral blue.
 *
 * @return string Hex color.
 */
function wplus_addons_thumbnail_theme_accent() {
	if ( 'wplus-ui' === get_template() ) {
		$accent = sanitize_hex_color( (string) get_theme_mod( 'wplusui_accent_light', '' ) );
		return $accent ? $accent : '#1976d2';
	}
	return '#2563eb';
}

/**
 * Keep only the design choices of a preset, each one valid.
 *
 * @param mixed $in Submitted settings.
 * @return array<string,string>
 */
function wplus_addons_thumbnail_clean_settings( $in ) {
	$in     = is_array( $in ) ? $in : array();
	$pick   = static function ( $key, $allowed, $fallback ) use ( $in ) {
		return isset( $in[ $key ] ) && in_array( (string) $in[ $key ], $allowed, true ) ? (string) $in[ $key ] : $fallback;
	};
	$accent = isset( $in['accent'] ) ? sanitize_hex_color( (string) $in['accent'] ) : '';
	$logo   = isset( $in['logo'] ) ? esc_url_raw( (string) $in['logo'] ) : '';
	// The picture is drawn in the browser, so a logo must come from this site (another host would block saving the result).
	if ( $logo && wp_parse_url( $logo, PHP_URL_HOST ) !== wp_parse_url( home_url(), PHP_URL_HOST ) ) {
		$logo = '';
	}
	return array(
		'layout' => $pick( 'layout', array( 'minimal', 'dots', 'panel' ), 'minimal' ),
		'align'  => $pick( 'align', array( 'left', 'center', 'right' ), 'left' ),
		'mode'   => $pick( 'mode', array( 'light', 'dark' ), 'light' ),
		'font'   => $pick( 'font', array_keys( wplus_addons_thumbnail_fonts() ), 'dm-sans' ),
		'ratio'  => $pick( 'ratio', array_keys( wplus_addons_thumbnail_ratios() ), '1200x630' ),
		'format' => $pick( 'format', array( 'webp', 'png' ), 'webp' ),
		'accent' => $accent ? $accent : wplus_addons_thumbnail_theme_accent(),
		'org'    => isset( $in['org'] ) ? mb_substr( sanitize_text_field( (string) $in['org'] ), 0, 80 ) : '',
		'logo'   => $logo,
	);
}

/**
 * Clean the whole preset option: a list of presets and which one is the default.
 *
 * @param mixed $in Submitted value.
 * @return array{default:string,items:array<int,array{id:string,name:string,settings:array<string,string>}>}
 */
function wplus_addons_thumbnail_sanitize_presets( $in ) {
	$in    = is_array( $in ) ? $in : array();
	$items = array();
	$seen  = array();
	foreach ( isset( $in['items'] ) && is_array( $in['items'] ) ? $in['items'] : array() as $item ) {
		if ( ! is_array( $item ) || count( $items ) >= wplus_addons_thumbnail_max_presets() ) {
			continue;
		}
		$name = isset( $item['name'] ) ? mb_substr( sanitize_text_field( (string) $item['name'] ), 0, 60 ) : '';
		$id   = isset( $item['id'] ) ? substr( sanitize_key( (string) $item['id'] ), 0, 40 ) : '';
		if ( '' === $name || '' === $id || isset( $seen[ $id ] ) ) {
			continue;
		}
		$seen[ $id ] = true;
		$items[]     = array(
			'id'       => $id,
			'name'     => $name,
			'settings' => wplus_addons_thumbnail_clean_settings( isset( $item['settings'] ) ? $item['settings'] : array() ),
		);
	}
	$default = isset( $in['default'] ) ? sanitize_key( (string) $in['default'] ) : '';
	return array(
		'default' => isset( $seen[ $default ] ) ? $default : '',
		'items'   => $items,
	);
}

/**
 * The saved presets (always clean).
 *
 * @return array{default:string,items:array<int,array{id:string,name:string,settings:array<string,string>}>}
 */
function wplus_addons_thumbnail_presets() {
	return wplus_addons_thumbnail_sanitize_presets( get_option( 'wplus_addons_thumbnail_presets', array() ) );
}

/**
 * Register the option so the REST settings of WordPress can read and save it (administrators only).
 */
function wplus_addons_thumbnail_register_presets() {
	register_setting(
		'wplus_addons',
		'wplus_addons_thumbnail_presets',
		array(
			'type'              => 'object',
			'sanitize_callback' => 'wplus_addons_thumbnail_sanitize_presets',
			'default'           => array(
				'default' => '',
				'items'   => array(),
			),
			'show_in_rest'      => array(
				'schema' => array(
					'type'                 => 'object',
					'additionalProperties' => false,
					'properties'           => array(
						'default' => array( 'type' => 'string' ),
						'items'   => array(
							'type'  => 'array',
							'items' => array(
								'type'                 => 'object',
								'additionalProperties' => true,
							),
						),
					),
				),
			),
		)
	);
}
add_action( 'init', 'wplus_addons_thumbnail_register_presets' );
