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
delete_option( 'wplus_addons_shield' );
delete_option( 'wplus_addons_login' );
delete_option( 'wplus_addons_login_state' );
delete_transient( 'wplus_addons_health_files' );
