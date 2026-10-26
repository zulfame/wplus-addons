<?php
/**
 * Light security hardening: safe switches that close common gaps. It is not a firewall and not a malware scanner; a plugin made for
 * that (Wordfence, Solid Security, Patchstack) does that job, and this one steps aside where the work overlaps.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/hardening.php';
require_once __DIR__ . '/settings.php';
