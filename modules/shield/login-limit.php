<?php
/**
 * Login attempt limit: after a number of failed logins from one address, that address can not log in for a while.
 * Counted per address (not per user name, so nobody can lock another person out by typing their name). A good login starts the
 * count again. Addresses on the allow list are never locked. Behind a proxy or CDN the real address of the visitor is read from a
 * header only when the owner says so, because a header from anyone else can be faked.
 *
 * To get back in when you locked yourself out: wait, or add `define( 'WPLUS_ADDONS_DISABLE_LOGIN_LIMIT', true );` to wp-config.php.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Starting values.
 *
 * @return array{enabled:bool,max:int,window:int,lock:int,proxy:string,allow:string}
 */
function wplus_addons_login_defaults() {
	return array(
		'enabled' => true,
		'max'     => 5,
		'window'  => 15,
		'lock'    => 15,
		'proxy'   => 'none',
		'allow'   => '',
	);
}

/**
 * Keep the settings inside sensible limits.
 *
 * @param mixed $in Submitted value.
 * @return array{enabled:bool,max:int,window:int,lock:int,proxy:string,allow:string}
 */
function wplus_addons_login_sanitize( $in ) {
	$in       = is_array( $in ) ? $in : array();
	$defaults = wplus_addons_login_defaults();
	$clamp    = static function ( $key, $min, $max ) use ( $in, $defaults ) {
		return isset( $in[ $key ] ) && is_numeric( $in[ $key ] ) ? max( $min, min( $max, (int) $in[ $key ] ) ) : $defaults[ $key ];
	};
	$allow    = array();
	foreach ( preg_split( '/[\s,]+/', isset( $in['allow'] ) ? (string) $in['allow'] : '' ) as $ip ) {
		if ( '' !== $ip && false !== filter_var( $ip, FILTER_VALIDATE_IP ) && count( $allow ) < 20 ) {
			$allow[ $ip ] = $ip;
		}
	}
	return array(
		'enabled' => ! empty( $in['enabled'] ),
		'max'     => $clamp( 'max', 3, 20 ),
		'window'  => $clamp( 'window', 1, 1440 ),
		'lock'    => $clamp( 'lock', 1, 1440 ),
		'proxy'   => isset( $in['proxy'] ) && in_array( (string) $in['proxy'], array( 'none', 'cf', 'xff' ), true ) ? (string) $in['proxy'] : 'none',
		'allow'   => implode( "\n", $allow ),
	);
}

/**
 * The saved settings (always clean). Nothing saved yet means the starting values.
 *
 * @return array{enabled:bool,max:int,window:int,lock:int,proxy:string,allow:string}
 */
function wplus_addons_login_settings() {
	$saved = get_option( 'wplus_addons_login', null );
	return is_array( $saved ) ? wplus_addons_login_sanitize( $saved ) : wplus_addons_login_defaults();
}

/**
 * Whether the limit is working.
 *
 * @return bool
 */
function wplus_addons_login_enabled() {
	$on = wplus_addons_login_settings()['enabled'] && ! ( defined( 'WPLUS_ADDONS_DISABLE_LOGIN_LIMIT' ) && WPLUS_ADDONS_DISABLE_LOGIN_LIMIT );
	return (bool) apply_filters( 'wplus_addons_login_limit_enabled', $on );
}

/**
 * The address of the visitor: the address of the connection, or (only if the owner chose so) the one a proxy or CDN reports.
 *
 * @return string
 */
function wplus_addons_login_ip() {
	$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	$proxy = wplus_addons_login_settings()['proxy'];
	if ( 'cf' === $proxy && ! empty( $_SERVER['HTTP_CF_CONNECTING_IP'] ) ) {
		$header = sanitize_text_field( wp_unslash( $_SERVER['HTTP_CF_CONNECTING_IP'] ) );
		if ( false !== filter_var( $header, FILTER_VALIDATE_IP ) ) {
			$ip = $header;
		}
	} elseif ( 'xff' === $proxy && ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
		$first = trim( explode( ',', sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) )[0] );
		if ( false !== filter_var( $first, FILTER_VALIDATE_IP ) ) {
			$ip = $first;
		}
	}
	return $ip;
}

/**
 * Whether an address is on the allow list.
 *
 * @param string $ip Address.
 * @return bool
 */
function wplus_addons_login_allowed( $ip ) {
	return in_array( $ip, preg_split( '/\s+/', wplus_addons_login_settings()['allow'], -1, PREG_SPLIT_NO_EMPTY ), true );
}

/**
 * The counts and locks: address hash => count, first failure, locked until. Old entries are dropped, and there are never more than 200.
 *
 * @return array<string,array{ip:string,count:int,first:int,until:int}>
 */
function wplus_addons_login_state() {
	$state = get_option( 'wplus_addons_login_state', array() );
	$state = is_array( $state ) ? $state : array();
	$s     = wplus_addons_login_settings();
	$now   = time();
	foreach ( $state as $key => $row ) {
		if ( ! is_array( $row ) || ! isset( $row['ip'], $row['count'], $row['first'], $row['until'] ) || ( $row['until'] <= $now && $row['first'] + $s['window'] * MINUTE_IN_SECONDS <= $now ) ) {
			unset( $state[ $key ] );
		}
	}
	return $state;
}

/**
 * Save the counts and locks.
 *
 * @param array<string,array{ip:string,count:int,first:int,until:int}> $state The state.
 */
function wplus_addons_login_save_state( $state ) {
	if ( count( $state ) > 200 ) {
		uasort(
			$state,
			static function ( $a, $b ) {
				return $b['first'] <=> $a['first'];
			}
		);
		$state = array_slice( $state, 0, 200, true );
	}
	update_option( 'wplus_addons_login_state', $state, false );
}

/**
 * The key of an address in the state.
 *
 * @param string $ip Address.
 * @return string
 */
function wplus_addons_login_key( $ip ) {
	return substr( md5( $ip ), 0, 20 );
}

/**
 * The last word of the login: while the address is locked, even a right password is refused, with the same message.
 *
 * @param WP_User|WP_Error|null $user User so far.
 * @return WP_User|WP_Error|null
 */
function wplus_addons_login_gate( $user ) {
	if ( ! wplus_addons_login_enabled() ) {
		return $user;
	}
	$ip = wplus_addons_login_ip();
	if ( '' === $ip || wplus_addons_login_allowed( $ip ) ) {
		return $user;
	}
	$state = wplus_addons_login_state();
	$key   = wplus_addons_login_key( $ip );
	if ( isset( $state[ $key ] ) && $state[ $key ]['until'] > time() ) {
		$minutes = (int) ceil( ( $state[ $key ]['until'] - time() ) / MINUTE_IN_SECONDS );
		/* translators: %d: minutes to wait */
		return new WP_Error( 'wplus_login_locked', sprintf( _n( '<strong>Error:</strong> Too many failed logins. Try again in %d minute.', '<strong>Error:</strong> Too many failed logins. Try again in %d minutes.', $minutes, 'wplus-addons' ), $minutes ) );
	}
	return $user;
}

/**
 * Count a failed login.
 *
 * @param string        $username Name that was tried.
 * @param WP_Error|null $error    The error.
 */
function wplus_addons_login_failed( $username, $error = null ) {
	if ( ! wplus_addons_login_enabled() || ! $error instanceof WP_Error ) {
		return;
	}
	$real = array_intersect( array( 'invalid_username', 'invalid_email', 'incorrect_password' ), $error->get_error_codes() );
	$ip   = wplus_addons_login_ip();
	if ( ! $real || '' === $ip || wplus_addons_login_allowed( $ip ) ) {
		return; // an empty form or our own "locked" answer is not a new failure.
	}
	$s     = wplus_addons_login_settings();
	$state = wplus_addons_login_state();
	$key   = wplus_addons_login_key( $ip );
	$now   = time();
	$row   = isset( $state[ $key ] ) ? $state[ $key ] : array(
		'ip'    => $ip,
		'count' => 0,
		'first' => $now,
		'until' => 0,
	);
	if ( $row['until'] <= $now && $row['first'] + $s['window'] * MINUTE_IN_SECONDS <= $now ) {
		$row['count'] = 0;
		$row['first'] = $now;
	}
	++$row['count'];
	if ( $row['count'] >= $s['max'] ) {
		$row['until'] = $now + $s['lock'] * MINUTE_IN_SECONDS;
	}
	$state[ $key ] = $row;
	wplus_addons_login_save_state( $state );
}

/**
 * A good login starts the count again.
 */
function wplus_addons_login_succeeded() {
	if ( ! wplus_addons_login_enabled() ) {
		return;
	}
	$state = wplus_addons_login_state();
	$key   = wplus_addons_login_key( wplus_addons_login_ip() );
	if ( isset( $state[ $key ] ) ) {
		unset( $state[ $key ] );
		wplus_addons_login_save_state( $state );
	}
}

/**
 * Unlock one address, or all of them (the Unlock buttons of the Security page).
 */
function wplus_addons_login_unlock() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You are not allowed to do this.', 'wplus-addons' ), 403 );
	}
	check_admin_referer( 'wplus_addons_unlock' );
	$state = wplus_addons_login_state();
	$one   = isset( $_GET['key'] ) ? sanitize_key( wp_unslash( $_GET['key'] ) ) : '';
	if ( '' !== $one ) {
		unset( $state[ $one ] );
	} else {
		$state = array();
	}
	wplus_addons_login_save_state( $state );
	wp_safe_redirect( add_query_arg( 'unlocked', '1', admin_url( 'options-general.php?page=wplus-security' ) ) );
	exit;
}
add_action( 'admin_post_wplus_addons_unlock', 'wplus_addons_login_unlock' );

add_filter( 'authenticate', 'wplus_addons_login_gate', 100 );
add_action( 'wp_login_failed', 'wplus_addons_login_failed', 10, 2 );
add_action( 'wp_login', 'wplus_addons_login_succeeded' );
