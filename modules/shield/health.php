<?php
/**
 * Security check: a plain-language list of what is fine, what is worth a look and what needs attention. It only reads and
 * explains; it changes nothing by itself. Only the check for files that should not be reachable asks the site's own address, and
 * only when its button is pressed.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Last day (UTC) on which each PHP version still gets security fixes, from php.net/supported-versions.
 *
 * @return array<string,string>
 */
function wplus_addons_health_php_support() {
	return array(
		'7.4' => '2022-11-28',
		'8.0' => '2023-11-26',
		'8.1' => '2025-12-31',
		'8.2' => '2026-12-31',
		'8.3' => '2027-12-31',
		'8.4' => '2028-12-31',
		'8.5' => '2029-12-31',
	);
}

/**
 * How healthy a PHP version is.
 *
 * @param string $version PHP version, for example 8.2.20.
 * @param int    $now     Time to judge at.
 * @return string good, warn or bad.
 */
function wplus_addons_health_php_status( $version, $now ) {
	$branch  = implode( '.', array_slice( explode( '.', (string) $version ), 0, 2 ) );
	$support = wplus_addons_health_php_support();
	if ( ! isset( $support[ $branch ] ) ) {
		return version_compare( $branch, '7.4', '<' ) ? 'bad' : 'good';
	}
	$end = strtotime( $support[ $branch ] . ' 23:59:59 UTC' );
	if ( $end < $now ) {
		return 'bad';
	}
	return $end - $now < 183 * DAY_IN_SECONDS ? 'warn' : 'good';
}

/**
 * How healthy the debug settings are for a live site.
 *
 * @param bool $debug   WP_DEBUG.
 * @param bool $display WP_DEBUG_DISPLAY (errors shown to visitors).
 * @return string good, warn or bad.
 */
function wplus_addons_health_debug_status( $debug, $display ) {
	if ( ! $debug ) {
		return 'good';
	}
	return $display ? 'bad' : 'warn';
}

/**
 * How healthy the "anyone can register" setting is.
 *
 * @param bool   $open Whether anyone may register.
 * @param string $role The role new users get.
 * @return string good, warn or bad.
 */
function wplus_addons_health_registration_status( $open, $role ) {
	if ( ! $open ) {
		return 'good';
	}
	if ( in_array( $role, array( 'administrator', 'editor' ), true ) ) {
		return 'bad';
	}
	return in_array( $role, array( 'author', 'contributor' ), true ) ? 'warn' : 'good';
}

/**
 * Files and folders that must not be reachable from the internet, with what a real one looks like (so a page that answers 200 to
 * everything is not taken for a leak).
 *
 * @return array<string,string> Path => regular expression the start of a real file matches.
 */
function wplus_addons_health_exposed_paths() {
	return array(
		'/.env'                 => '/^\s*[A-Z0-9_]+\s*=/mi',
		'/.git/HEAD'            => '/^ref:\s/',
		'/wp-config.php.bak'    => '/DB_PASSWORD|DB_NAME/',
		'/wp-config.php~'       => '/DB_PASSWORD|DB_NAME/',
		'/wp-config.php.old'    => '/DB_PASSWORD|DB_NAME/',
		'/wp-content/debug.log' => '/PHP (Warning|Notice|Fatal|Deprecated)|^\[\d{2}-\w{3}-\d{4}/m',
		'/backup.sql'           => '/CREATE TABLE|INSERT INTO/i',
		'/db.sql'               => '/CREATE TABLE|INSERT INTO/i',
		'/dump.sql'             => '/CREATE TABLE|INSERT INTO/i',
		'/phpinfo.php'          => '/phpinfo\(\)|PHP Version/i',
		'/wp-content/uploads/'  => '/Index of/i',
	);
}

/**
 * Ask the site's own address for each path above; returns the ones that answer with the real thing. The result is kept for a day.
 *
 * @return array{time:int,found:string[],failed:int}
 */
function wplus_addons_health_exposed() {
	$found  = array();
	$failed = 0;
	foreach ( wplus_addons_health_exposed_paths() as $path => $signature ) {
		$response = wp_remote_get(
			home_url( $path ),
			array(
				'timeout'     => 5,
				'redirection' => 0,
				'sslverify'   => apply_filters( 'https_local_ssl_verify', false ), // phpcs:ignore WordPress.WP.AlternativeFunctions -- the site asks itself.
				'headers'     => array( 'Range' => 'bytes=0-2047' ),
			)
		);
		if ( is_wp_error( $response ) ) {
			++$failed;
			continue;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( ( 200 === $code || 206 === $code ) && preg_match( $signature, substr( (string) wp_remote_retrieve_body( $response ), 0, 2048 ) ) ) {
			$found[] = $path;
		}
	}
	$result = array(
		'time'   => time(),
		'found'  => $found,
		'failed' => $failed,
	);
	set_transient( 'wplus_addons_health_files', $result, DAY_IN_SECONDS );
	return $result;
}

/**
 * The button of the file check.
 */
function wplus_addons_health_run_file_check() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'wplus-addons' ), 403 );
	}
	check_admin_referer( 'wplus_addons_health_files' );
	wplus_addons_health_exposed();
	wp_safe_redirect( admin_url( 'options-general.php?page=wplus-security&tab=check&checked=1' ) );
	exit;
}
add_action( 'admin_post_wplus_addons_health_files', 'wplus_addons_health_run_file_check' );

/**
 * Names of the plugins (by folder) that are known as security plugins, firewalls or scanners.
 *
 * @return array<string,string> Folder => name.
 */
function wplus_addons_health_security_plugins() {
	return array(
		'wordfence'                           => 'Wordfence',
		'better-wp-security'                  => 'Solid Security',
		'ithemes-security-pro'                => 'Solid Security Pro',
		'sucuri-scanner'                      => 'Sucuri Security',
		'patchstack'                          => 'Patchstack',
		'all-in-one-wp-security-and-firewall' => 'All In One WP Security',
		'wp-cerber'                           => 'WP Cerber',
		'security-ninja'                      => 'Security Ninja',
	);
}

/**
 * Backup plugins that are known.
 *
 * @return array<string,string> Folder => name.
 */
function wplus_addons_health_backup_plugins() {
	return array(
		'updraftplus'                => 'UpdraftPlus',
		'backwpup'                   => 'BackWPup',
		'duplicator'                 => 'Duplicator',
		'duplicator-pro'             => 'Duplicator Pro',
		'all-in-one-wp-migration'    => 'All-in-One WP Migration',
		'jetpack'                    => 'Jetpack (VaultPress Backup)',
		'wpvivid-backuprestore'      => 'WPvivid',
		'blogvault-real-time-backup' => 'BlogVault',
	);
}

/**
 * Which of the given plugins (folder => name) are switched on.
 *
 * @param array<string,string> $known Folder => name.
 * @return string[] Names.
 */
function wplus_addons_health_active_of( $known ) {
	$names  = array();
	$active = (array) get_option( 'active_plugins', array() );
	foreach ( $active as $file ) {
		$folder = strtok( (string) $file, '/' );
		if ( isset( $known[ $folder ] ) ) {
			$names[ $known[ $folder ] ] = $known[ $folder ];
		}
	}
	return array_values( $names );
}

/**
 * Whether an address is a local one (no https needed there).
 *
 * @param string $url Address.
 * @return bool
 */
function wplus_addons_health_is_local( $url ) {
	$host = (string) wp_parse_url( $url, PHP_URL_HOST );
	return in_array( $host, array( 'localhost', '127.0.0.1', '::1' ), true ) || '.test' === substr( $host, -5 ) || '.local' === substr( $host, -6 ) || '.localhost' === substr( $host, -10 );
}

/**
 * The checks, worst first. Each: id, status (bad, warn, good), title, text and, where there is something to do, an action (label, url).
 * Needs the texts, so call it from the init action onwards, and in the admin.
 *
 * @return array<int,array{id:string,status:string,title:string,text:string,action?:array{0:string,1:string}}>
 */
function wplus_addons_health_checks() {
	$checks = array();
	$add    = static function ( $id, $status, $title, $text, $action = null ) use ( &$checks ) {
		$row = array(
			'id'     => $id,
			'status' => $status,
			'title'  => $title,
			'text'   => $text,
		);
		if ( $action ) {
			$row['action'] = $action;
		}
		$checks[] = $row;
	};
	if ( ! function_exists( 'get_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	// WordPress itself.
	$core    = get_site_transient( 'update_core' );
	$current = get_bloginfo( 'version' );
	$newer   = '';
	if ( is_object( $core ) && ! empty( $core->updates ) ) {
		foreach ( (array) $core->updates as $offer ) {
			if ( isset( $offer->response, $offer->current ) && 'upgrade' === $offer->response && version_compare( $offer->current, $current, '>' ) ) {
				$newer = (string) $offer->current;
				break;
			}
		}
	}
	if ( '' !== $newer ) {
		/* translators: 1: installed version, 2: new version */
		$add( 'core', 'warn', __( 'WordPress is not up to date', 'wplus-addons' ), sprintf( __( 'You have WordPress %1$s and %2$s is available. Updates close security holes that are already known.', 'wplus-addons' ), $current, $newer ), array( __( 'Update WordPress', 'wplus-addons' ), admin_url( 'update-core.php' ) ) );
	} else {
		/* translators: %s: version */
		$add( 'core', 'good', __( 'WordPress is up to date', 'wplus-addons' ), sprintf( __( 'You have WordPress %s and no newer version is waiting.', 'wplus-addons' ), $current ) );
	}

	// PHP.
	$php = wplus_addons_health_php_status( PHP_VERSION, time() );
	/* translators: %s: PHP version */
	$php_text = sprintf( __( 'Your server runs PHP %s.', 'wplus-addons' ), PHP_VERSION );
	if ( 'bad' === $php ) {
		$add( 'php', 'bad', __( 'PHP is no longer supported', 'wplus-addons' ), $php_text . ' ' . __( 'This version does not get security fixes any more. Ask your host to switch to a newer PHP.', 'wplus-addons' ) );
	} elseif ( 'warn' === $php ) {
		$add( 'php', 'warn', __( 'PHP will stop being supported soon', 'wplus-addons' ), $php_text . ' ' . __( 'Its security fixes end within six months. Plan the switch to a newer PHP with your host.', 'wplus-addons' ) );
	} else {
		$add( 'php', 'good', __( 'PHP is supported', 'wplus-addons' ), $php_text );
	}

	// Plugins and themes with updates, and plugins that are not used.
	$plugins = get_plugins();
	$updates = get_site_transient( 'update_plugins' );
	$waiting = array();
	if ( is_object( $updates ) && ! empty( $updates->response ) ) {
		foreach ( array_keys( (array) $updates->response ) as $file ) {
			$waiting[] = isset( $plugins[ $file ]['Name'] ) ? $plugins[ $file ]['Name'] : $file;
		}
	}
	$themes_updates = get_site_transient( 'update_themes' );
	if ( is_object( $themes_updates ) && ! empty( $themes_updates->response ) ) {
		foreach ( array_keys( (array) $themes_updates->response ) as $slug ) {
			$theme     = wp_get_theme( $slug );
			$waiting[] = $theme->exists() ? $theme->get( 'Name' ) : $slug;
		}
	}
	if ( $waiting ) {
		/* translators: %s: names of plugins and themes */
		$add( 'updates', 'warn', __( 'Plugins or themes are waiting for an update', 'wplus-addons' ), sprintf( __( 'Waiting: %s. An old plugin is the most common way a site is broken into.', 'wplus-addons' ), implode( ', ', $waiting ) ), array( __( 'See the updates', 'wplus-addons' ), admin_url( 'update-core.php' ) ) );
	} else {
		$add( 'updates', 'good', __( 'Plugins and themes are up to date', 'wplus-addons' ), __( 'None of them is waiting for an update.', 'wplus-addons' ) );
	}
	$inactive = array();
	foreach ( $plugins as $file => $data ) {
		if ( ! is_plugin_active( $file ) && ! is_plugin_active_for_network( $file ) ) {
			$inactive[] = $data['Name'];
		}
	}
	if ( $inactive ) {
		/* translators: 1: number of plugins, 2: their names */
		$add( 'inactive', 'warn', __( 'Plugins are installed but not used', 'wplus-addons' ), sprintf( __( '%1$d not used: %2$s. A plugin that is switched off can still be attacked if it has a hole. Delete what you do not need.', 'wplus-addons' ), count( $inactive ), implode( ', ', array_slice( $inactive, 0, 8 ) ) . ( count( $inactive ) > 8 ? '…' : '' ) ), array( __( 'Open Plugins', 'wplus-addons' ), admin_url( 'plugins.php?plugin_status=inactive' ) ) );
	} else {
		$add( 'inactive', 'good', __( 'No unused plugins', 'wplus-addons' ), __( 'Every installed plugin is in use.', 'wplus-addons' ) );
	}

	// People.
	$admin_user = get_user_by( 'login', 'admin' );
	if ( $admin_user && in_array( 'administrator', (array) $admin_user->roles, true ) ) {
		$add( 'adminuser', 'warn', __( 'An administrator is called "admin"', 'wplus-addons' ), __( 'Everybody tries this name first when guessing passwords. Make a new administrator with another name, log in with it and delete the old one (give its posts to the new one).', 'wplus-addons' ), array( __( 'Open Users', 'wplus-addons' ), admin_url( 'users.php' ) ) );
	} else {
		$add( 'adminuser', 'good', __( 'No administrator is called "admin"', 'wplus-addons' ), __( 'The most guessed user name is not an administrator here.', 'wplus-addons' ) );
	}
	$admins = count(
		get_users(
			array(
				'role'   => 'administrator',
				'fields' => 'ID',
			)
		)
	);
	if ( $admins > 3 ) {
		/* translators: %d: number of administrators */
		$add( 'admins', 'warn', __( 'Many administrators', 'wplus-addons' ), sprintf( __( 'There are %d administrators. Each one is a way in. Give people the lowest role that lets them do their work.', 'wplus-addons' ), $admins ), array( __( 'Open Users', 'wplus-addons' ), admin_url( 'users.php?role=administrator' ) ) );
	} else {
		/* translators: %d: number of administrators */
		$add( 'admins', 'good', __( 'Few administrators', 'wplus-addons' ), sprintf( __( 'There are %d administrators.', 'wplus-addons' ), $admins ) );
	}
	$open = (bool) get_option( 'users_can_register' );
	$role = (string) get_option( 'default_role' );
	$reg  = wplus_addons_health_registration_status( $open, $role );
	if ( 'bad' === $reg ) {
		/* translators: %s: role name */
		$add( 'register', 'bad', __( 'Anyone can register as an editor or administrator', 'wplus-addons' ), sprintf( __( 'Registration is open and new people get the role "%s". Anyone could take over your site. Close registration or change the role to Subscriber.', 'wplus-addons' ), $role ), array( __( 'Open General settings', 'wplus-addons' ), admin_url( 'options-general.php' ) ) );
	} elseif ( 'warn' === $reg ) {
		/* translators: %s: role name */
		$add( 'register', 'warn', __( 'Anyone can register and write', 'wplus-addons' ), sprintf( __( 'Registration is open and new people get the role "%s". Make it Subscriber unless you really want strangers to write.', 'wplus-addons' ), $role ), array( __( 'Open General settings', 'wplus-addons' ), admin_url( 'options-general.php' ) ) );
	} else {
		$add( 'register', 'good', __( 'Registration is closed or harmless', 'wplus-addons' ), $open ? __( 'People can register, but only as subscribers.', 'wplus-addons' ) : __( 'Nobody can register themselves.', 'wplus-addons' ) );
	}

	// The site and its server.
	if ( is_ssl() || 'https' === wp_parse_url( home_url(), PHP_URL_SCHEME ) ) {
		$add( 'https', 'good', __( 'The site uses https', 'wplus-addons' ), __( 'Visitors and you talk to the site over a secure connection.', 'wplus-addons' ) );
	} elseif ( wplus_addons_health_is_local( home_url() ) ) {
		$add( 'https', 'good', __( 'https is not needed on this address', 'wplus-addons' ), __( 'This is a local address (for tests).', 'wplus-addons' ) );
	} else {
		$add( 'https', 'bad', __( 'The site does not use https', 'wplus-addons' ), __( 'Passwords and logins travel in the open. Ask your host for a certificate and set both addresses in General settings to https.', 'wplus-addons' ), array( __( 'Open General settings', 'wplus-addons' ), admin_url( 'options-general.php' ) ) );
	}
	$debug_on      = defined( 'WP_DEBUG' ) && WP_DEBUG;
	$debug_display = $debug_on && ( ! defined( 'WP_DEBUG_DISPLAY' ) || WP_DEBUG_DISPLAY );
	$debug         = wplus_addons_health_debug_status( $debug_on, $debug_display );
	if ( 'bad' === $debug ) {
		$add( 'debug', 'bad', __( 'Errors are shown to visitors', 'wplus-addons' ), __( 'Debug mode is on and shows PHP errors on the pages. They can reveal paths and settings. Set WP_DEBUG to false in wp-config.php on a live site.', 'wplus-addons' ) );
	} elseif ( 'warn' === $debug ) {
		$add( 'debug', 'warn', __( 'Debug mode is on', 'wplus-addons' ), __( 'Errors are not shown, but they are written to a log. Switch WP_DEBUG off on a live site when you are done testing.', 'wplus-addons' ) );
	} else {
		$add( 'debug', 'good', __( 'Debug mode is off', 'wplus-addons' ), __( 'Nothing is written or shown for debugging.', 'wplus-addons' ) );
	}
	$config = ABSPATH . 'wp-config.php';
	if ( ! is_readable( $config ) && is_readable( dirname( ABSPATH ) . '/wp-config.php' ) ) {
		$config = dirname( ABSPATH ) . '/wp-config.php';
	}
	if ( is_readable( $config ) && ( fileperms( $config ) & 0002 ) ) {
		$add( 'config', 'bad', __( 'wp-config.php can be changed by everyone', 'wplus-addons' ), __( 'Anyone with an account on the server can read or change the file that holds your database password. Set its permissions to 640 or 600.', 'wplus-addons' ) );
	} else {
		$add( 'config', 'good', __( 'wp-config.php is protected', 'wplus-addons' ), __( 'The file with the database password is not open to everyone on the server.', 'wplus-addons' ) );
	}

	// What this plugin and others do for you.
	$switches_on = 0;
	foreach ( array_keys( wplus_addons_shield_defaults() ) as $slug ) {
		if ( wplus_addons_shield_on( $slug ) ) {
			++$switches_on;
		}
	}
	$file_edit_closed = ( defined( 'DISALLOW_FILE_EDIT' ) && DISALLOW_FILE_EDIT ) || wplus_addons_shield_on( 'file_edit' );
	if ( $file_edit_closed ) {
		$add( 'fileedit', 'good', __( 'The file editor is closed', 'wplus-addons' ), __( 'Nobody can change theme or plugin code from the dashboard.', 'wplus-addons' ) );
	} else {
		$add( 'fileedit', 'warn', __( 'The file editor is open', 'wplus-addons' ), __( 'Someone who gets into an administrator account can change your code from the dashboard. Switch "Turn off the file editor" on.', 'wplus-addons' ), array( __( 'Open the switches', 'wplus-addons' ), admin_url( 'options-general.php?page=wplus-security' ) ) );
	}
	if ( wplus_addons_login_enabled() ) {
		$add( 'login', 'good', __( 'Failed logins are limited', 'wplus-addons' ), __( 'An address that fails to log in too often is locked for a while.', 'wplus-addons' ) );
	} else {
		$add( 'login', 'warn', __( 'Failed logins are not limited', 'wplus-addons' ), __( 'Bots can try passwords for ever. Switch "Limit failed logins" on.', 'wplus-addons' ), array( __( 'Open the switches', 'wplus-addons' ), admin_url( 'options-general.php?page=wplus-security' ) ) );
	}
	$security = wplus_addons_health_active_of( wplus_addons_health_security_plugins() );
	if ( $security ) {
		/* translators: %s: plugin names */
		$add( 'securityplugin', 'good', __( 'A security plugin is active', 'wplus-addons' ), sprintf( __( 'Active: %s.', 'wplus-addons' ), implode( ', ', $security ) ) );
	} else {
		$add( 'securityplugin', 'warn', __( 'No firewall or malware scanner found', 'wplus-addons' ), __( 'The switches here close common gaps, but they are not a firewall and not a scanner. Add a plugin made for that, such as Wordfence, Solid Security or Patchstack.', 'wplus-addons' ), array( __( 'Find plugins', 'wplus-addons' ), admin_url( 'plugin-install.php?s=wordfence&tab=search&type=term' ) ) );
	}
	$backup = wplus_addons_health_active_of( wplus_addons_health_backup_plugins() );
	if ( $backup ) {
		/* translators: %s: plugin names */
		$add( 'backup', 'good', __( 'A backup plugin is active', 'wplus-addons' ), sprintf( __( 'Active: %s. Check now and then that a recent backup exists and that you can restore it.', 'wplus-addons' ), implode( ', ', $backup ) ) );
	} else {
		$add( 'backup', 'warn', __( 'No backup plugin found', 'wplus-addons' ), __( 'If your host does not keep backups for you, one broken update or one attack can cost you the whole site. Add a backup plugin, or ask your host.', 'wplus-addons' ), array( __( 'Find plugins', 'wplus-addons' ), admin_url( 'plugin-install.php?s=backup&tab=search&type=term' ) ) );
	}

	// Files that must not be reachable (only after the button was pressed).
	$files = get_transient( 'wplus_addons_health_files' );
	if ( is_array( $files ) ) {
		$when = human_time_diff( (int) $files['time'] );
		if ( $files['found'] ) {
			/* translators: 1: addresses, 2: how long ago */
			$add( 'files', 'bad', __( 'Files that should be secret can be opened', 'wplus-addons' ), sprintf( __( 'Anyone can open: %1$s (checked %2$s ago). They can hold passwords or your data. Remove them from the server or block them, then check again.', 'wplus-addons' ), implode( ', ', $files['found'] ), $when ) );
		} elseif ( (int) $files['failed'] >= count( wplus_addons_health_exposed_paths() ) ) {
			$add( 'files', 'warn', __( 'The files could not be checked', 'wplus-addons' ), __( 'The site could not ask its own address (some servers do not allow that). Try again later.', 'wplus-addons' ) );
		} else {
			/* translators: %s: how long ago */
			$add( 'files', 'good', __( 'No secret files can be opened', 'wplus-addons' ), sprintf( __( 'Common leftovers (.env, .git, copies of wp-config.php, debug.log, database dumps, phpinfo, a folder listing) are not reachable (checked %s ago).', 'wplus-addons' ), $when ) );
		}
	}

	$order = array(
		'bad'  => 0,
		'warn' => 1,
		'good' => 2,
	);
	usort(
		$checks,
		static function ( $a, $b ) use ( $order ) {
			return $order[ $a['status'] ] <=> $order[ $b['status'] ];
		}
	);
	return $checks;
}

/**
 * The Check tab.
 */
function wplus_addons_health_render() {
	$checks = wplus_addons_health_checks();
	$count  = array(
		'bad'  => 0,
		'warn' => 0,
		'good' => 0,
	);
	foreach ( $checks as $check ) {
		++$count[ $check['status'] ];
	}
	echo '<p id="wpa-health-summary"><strong>' . esc_html(
		sprintf(
			/* translators: 1: number needing attention, 2: number worth a look, 3: number fine */
			__( '%1$d need attention, %2$d worth a look, %3$d fine.', 'wplus-addons' ),
			$count['bad'],
			$count['warn'],
			$count['good']
		)
	) . '</strong></p>';
	if ( isset( $_GET['checked'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only message.
		echo '<div class="notice notice-success inline"><p>' . esc_html__( 'Checked just now.', 'wplus-addons' ) . '</p></div>';
	}
	$classes = array(
		'bad'  => 'notice-error',
		'warn' => 'notice-warning',
		'good' => 'notice-success',
	);
	$marks   = array(
		'bad'  => __( 'Needs attention', 'wplus-addons' ),
		'warn' => __( 'Worth a look', 'wplus-addons' ),
		'good' => __( 'Fine', 'wplus-addons' ),
	);
	foreach ( $checks as $check ) {
		echo '<div class="notice ' . esc_attr( $classes[ $check['status'] ] ) . ' inline wpa-check" data-check="' . esc_attr( $check['id'] ) . '" data-status="' . esc_attr( $check['status'] ) . '" style="max-width:760px"><p><strong>' . esc_html( $check['title'] ) . '</strong> <span class="description">(' . esc_html( $marks[ $check['status'] ] ) . ')</span></p><p>' . esc_html( $check['text'] ) . '</p>';
		if ( ! empty( $check['action'] ) ) {
			echo '<p><a class="button" href="' . esc_url( $check['action'][1] ) . '">' . esc_html( $check['action'][0] ) . '</a></p>';
		}
		echo '</div>';
	}
	echo '<h2>' . esc_html__( 'Files that should be secret', 'wplus-addons' ) . '</h2>';
	echo '<p class="description">' . esc_html__( 'Looks whether a few leftovers (.env, .git, copies of wp-config.php, debug.log, database dumps, phpinfo and a folder listing of uploads) can be opened by anyone. It only asks the address of this site, and only when you press the button.', 'wplus-addons' ) . '</p>';
	echo '<p><a class="button button-primary" id="wpa-check-files" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=wplus_addons_health_files' ), 'wplus_addons_health_files' ) ) . '">' . esc_html__( 'Check the files now', 'wplus-addons' ) . '</a></p>';
}
