<?php
/**
 * The list of tools (modules) and which of them are switched on.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Every tool of the plugin. A tool that is not available yet is listed but cannot be switched on.
 * Only plain facts here: the texts come from wplus_addons_module_texts(), so no translation is loaded early.
 *
 * @return array<string,array{available:bool,default:bool}>
 */
function wplus_addons_modules() {
	return array(
		'thumbnail' => array(
			'available' => true,
			'default'   => true,
		),
		'shield'    => array(
			'available' => false,
			'default'   => false,
		),
	);
}

/**
 * Title and description of each tool (translated; call this only from the init action onwards).
 *
 * @return array<string,array{title:string,description:string}>
 */
function wplus_addons_module_texts() {
	return array(
		'thumbnail' => array(
			'title'       => __( 'Thumbnail generator', 'wplus-addons' ),
			'description' => __( 'Make a cover picture for a post from its title and description, and use it as the featured image.', 'wplus-addons' ),
		),
		'shield'    => array(
			'title'       => __( 'Light security hardening', 'wplus-addons' ),
			'description' => __( 'Safe switches that close common gaps, a login attempt limit and a plain-language security check.', 'wplus-addons' ),
		),
	);
}

/**
 * Whether a tool is switched on (the saved choice, or its default).
 *
 * @param string $slug Tool slug.
 * @return bool
 */
function wplus_addons_module_enabled( $slug ) {
	$modules = wplus_addons_modules();
	if ( ! isset( $modules[ $slug ] ) ) {
		return false;
	}
	$saved = get_option( 'wplus_addons_modules', null );
	if ( is_array( $saved ) && array_key_exists( $slug, $saved ) ) {
		return (bool) $saved[ $slug ];
	}
	return (bool) $modules[ $slug ]['default'];
}
