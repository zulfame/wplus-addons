<?php
/**
 * Plugin Name:       WPlus Addons
 * Plugin URI:        https://github.com/zulfame/wplus-addons
 * Description:       Small, optional tools for WPlus UI and any WordPress site: a thumbnail generator and light security hardening. Each tool can be switched off.
 * Version:           0.1.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Zulfadli Rizal
 * Author URI:        https://github.com/zulfame
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain:       wplus-addons
 * Domain Path:       /languages
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WPLUS_ADDONS_VERSION', '0.1.0' );
define( 'WPLUS_ADDONS_FILE', __FILE__ );
define( 'WPLUS_ADDONS_DIR', plugin_dir_path( __FILE__ ) );
define( 'WPLUS_ADDONS_URL', plugin_dir_url( __FILE__ ) );

require_once WPLUS_ADDONS_DIR . 'includes/modules.php';
require_once WPLUS_ADDONS_DIR . 'includes/settings.php';

/**
 * Load the translation files of the plugin (languages/wplus-addons-<locale>.mo).
 */
function wplus_addons_load_textdomain() {
	load_plugin_textdomain( 'wplus-addons', false, dirname( plugin_basename( WPLUS_ADDONS_FILE ) ) . '/languages' );
}
add_action( 'init', 'wplus_addons_load_textdomain' );

/**
 * Load every module that is switched on.
 */
function wplus_addons_load_modules() {
	foreach ( wplus_addons_modules() as $slug => $module ) {
		if ( ! $module['available'] || ! wplus_addons_module_enabled( $slug ) ) {
			continue;
		}
		$file = WPLUS_ADDONS_DIR . 'modules/' . $slug . '/module.php';
		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
}
add_action( 'plugins_loaded', 'wplus_addons_load_modules' );
