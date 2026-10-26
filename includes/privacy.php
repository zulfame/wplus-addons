<?php
/**
 * Suggested text for the privacy policy of the site (Settings > Privacy > Policy guide).
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Tell the site owner what this plugin does with data, so it can go into the privacy policy.
 */
function wplus_addons_privacy_policy() {
	if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
		return;
	}
	$text  = '<p class="privacy-policy-tutorial">' . esc_html__( 'The texts below say what WPlus Addons does with data. Copy what is true for your site into your privacy policy.', 'wplus-addons' ) . '</p>';
	$text .= '<h2>' . esc_html__( 'Thumbnail generator', 'wplus-addons' ) . '</h2>';
	$text .= '<p>' . esc_html__( 'The cover pictures are drawn in the browser of the person who makes them and saved in the Media Library of this site. No text or picture is sent to another site, and no visitor data is collected. The fonts are part of the plugin.', 'wplus-addons' ) . '</p>';
	$text .= '<h2>' . esc_html__( 'Updates', 'wplus-addons' ) . '</h2>';
	$text .= '<p>' . esc_html__( 'When WordPress checks for updates, the plugin asks GitHub for the latest version. GitHub receives the address of this site\'s server and the version of the plugin, and nothing about your visitors or users.', 'wplus-addons' ) . '</p>';
	$text .= '<h2>' . esc_html__( 'Login attempts', 'wplus-addons' ) . '</h2>';
	$text .= '<p>' . esc_html__( 'If the limit on failed logins is on, the plugin keeps the IP address of every address with failed logins, and how many, for a short time (until the counting time is over, 15 minutes to start with, and at most 200 addresses) so that an address that tries too often can be locked. They are removed when that time is over, when an administrator presses Unlock, and when the plugin is deleted. No user name or password is kept.', 'wplus-addons' ) . '</p>';
	wp_add_privacy_policy_content( 'WPlus Addons', wp_kses_post( wpautop( $text, false ) ) );
}
add_action( 'admin_init', 'wplus_addons_privacy_policy' );
