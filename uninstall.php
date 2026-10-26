<?php
/**
 * Remove the plugin's saved settings when it is deleted.
 *
 * @package wplus-addons
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'wplus_addons_modules' );
delete_option( 'wplus_addons_thumbnail_presets' );
