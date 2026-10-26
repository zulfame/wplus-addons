<?php
/**
 * Thumbnail generator, Bulk tab: make the featured image of many posts that have none. The pictures are drawn in the
 * browser one by one; each post gets its own picture, and a post that already has a featured image is never touched.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Most posts listed at once (run again for the rest).
 *
 * @return int
 */
function wplus_addons_thumbnail_bulk_limit() {
	return 200;
}

/**
 * Whether the Bulk tab is open.
 *
 * @return bool
 */
function wplus_addons_thumbnail_is_bulk_tab() {
	return isset( $_GET['tab'] ) && 'bulk' === sanitize_key( wp_unslash( $_GET['tab'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only tab switch.
}

/**
 * The two tabs of the Thumbnail page.
 *
 * @param string $active generator or bulk.
 */
function wplus_addons_thumbnail_tabs( $active ) {
	$tabs = array(
		'generator' => array( __( 'Generator', 'wplus-addons' ), admin_url( 'tools.php?page=wplus-thumbnail' ) ),
		'bulk'      => array( __( 'Bulk', 'wplus-addons' ), admin_url( 'tools.php?page=wplus-thumbnail&tab=bulk' ) ),
	);
	echo '<nav class="nav-tab-wrapper wpa-tabs" aria-label="' . esc_attr__( 'Thumbnail tools', 'wplus-addons' ) . '">';
	foreach ( $tabs as $key => $tab ) {
		echo '<a class="nav-tab' . ( $key === $active ? ' nav-tab-active' : '' ) . '" href="' . esc_url( $tab[1] ) . '"' . ( $key === $active ? ' aria-current="page"' : '' ) . '>' . esc_html( $tab[0] ) . '</a>';
	}
	echo '</nav>';
}

/**
 * Posts without a featured image that the current user may edit, newest first.
 *
 * @return array{posts:array<int,array<string,mixed>>,total:int}
 */
function wplus_addons_thumbnail_bulk_candidates() {
	$args = array(
		'post_type'           => 'post',
		'post_status'         => array( 'publish', 'future', 'draft', 'pending', 'private' ),
		'posts_per_page'      => wplus_addons_thumbnail_bulk_limit(),
		'orderby'             => 'date',
		'order'               => 'DESC',
		'ignore_sticky_posts' => true,
		'meta_query'          => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- one admin screen, capped at 200 posts.
			'relation' => 'OR',
			array(
				'key'     => '_thumbnail_id',
				'compare' => 'NOT EXISTS',
			),
			array(
				'key'     => '_thumbnail_id',
				'value'   => array( '', '0' ),
				'compare' => 'IN',
			),
		),
	);
	if ( ! current_user_can( 'edit_others_posts' ) ) {
		$args['author'] = get_current_user_id();
	}
	$query = new WP_Query( $args );
	$posts = array();
	foreach ( $query->posts as $post ) {
		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			continue;
		}
		$text    = '' !== trim( $post->post_excerpt ) ? $post->post_excerpt : strip_shortcodes( $post->post_content );
		$text    = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( excerpt_remove_blocks( $text ) ) ) );
		$text    = wp_html_excerpt( $text, 160, '…' );
		$tags    = wp_list_pluck( get_the_tags( $post->ID ) ? get_the_tags( $post->ID ) : array(), 'name' );
		$cats    = wp_list_pluck(
			array_filter(
				get_the_category( $post->ID ),
				static function ( $cat ) {
					return (int) get_option( 'default_category' ) !== (int) $cat->term_id; // "Uncategorized" says nothing on a picture.
				}
			),
			'name'
		);
		$posts[] = array(
			'id'          => (int) $post->ID,
			'title'       => html_entity_decode( wp_strip_all_tags( get_the_title( $post ) ), ENT_QUOTES, 'UTF-8' ),
			'description' => html_entity_decode( $text, ENT_QUOTES, 'UTF-8' ),
			'labels'      => array_slice( array_merge( $tags, $cats ), 0, 2 ),
			'status'      => $post->post_status,
			'date'        => mysql2date( get_option( 'date_format' ), $post->post_date ),
		);
	}
	return array(
		'posts' => $posts,
		'total' => (int) $query->found_posts,
	);
}

/**
 * Scripts of the Bulk tab.
 */
function wplus_addons_thumbnail_bulk_assets() {
	$base = WPLUS_ADDONS_URL . 'modules/thumbnail/';
	wp_enqueue_style( 'wplus-addons-thumbnail', $base . 'assets/admin.css', array(), WPLUS_ADDONS_VERSION );
	wp_enqueue_script( 'wplus-addons-thumbnail-renderer', $base . 'assets/renderer.js', array(), WPLUS_ADDONS_VERSION, true );
	wp_enqueue_script( 'wplus-addons-thumbnail-common', $base . 'assets/common.js', array(), WPLUS_ADDONS_VERSION, true );
	wp_enqueue_script( 'wplus-addons-thumbnail-bulk', $base . 'assets/bulk.js', array( 'wplus-addons-thumbnail-renderer', 'wplus-addons-thumbnail-common', 'wp-api-fetch' ), WPLUS_ADDONS_VERSION, true );
	$found = wplus_addons_thumbnail_bulk_candidates();
	wp_localize_script(
		'wplus-addons-thumbnail-bulk',
		'wplusBulk',
		array(
			'fonts'    => wplus_addons_thumbnail_font_config(),
			'defaults' => wplus_addons_thumbnail_defaults(),
			'presets'  => wplus_addons_thumbnail_presets(),
			'posts'    => $found['posts'],
			'editUrl'  => admin_url( 'post.php' ),
			'i18n'     => array(
				'custom'       => __( 'My last settings', 'wplus-addons' ),
				'defaultTag'   => __( '(default)', 'wplus-addons' ),
				'working'      => __( 'Working…', 'wplus-addons' ),
				'done'         => __( 'Done', 'wplus-addons' ),
				'skipped'      => __( 'Skipped: it already has a featured image.', 'wplus-addons' ),
				'noTitle'      => __( 'Skipped: no title.', 'wplus-addons' ),
				'failed'       => __( 'Failed:', 'wplus-addons' ),
				'stopped'      => __( 'Stopped. The pictures made so far are kept.', 'wplus-addons' ),
				'finished'     => __( 'Finished.', 'wplus-addons' ),
				'confirm'      => __( 'Make a picture for each ticked post and set it as its featured image? The posts are not changed in any other way.', 'wplus-addons' ),
				'none'         => __( 'Tick at least one post.', 'wplus-addons' ),
				'progress'     => __( 'posts done', 'wplus-addons' ),
				'webpFallback' => __( 'WebP is not available in this browser, so PNG was used.', 'wplus-addons' ),
			),
		)
	);
}

/**
 * The Bulk tab.
 */
function wplus_addons_thumbnail_render_bulk() {
	$found  = wplus_addons_thumbnail_bulk_candidates();
	$labels = array(
		'publish' => __( 'Published', 'wplus-addons' ),
		'future'  => __( 'Scheduled', 'wplus-addons' ),
		'draft'   => __( 'Draft', 'wplus-addons' ),
		'pending' => __( 'Pending', 'wplus-addons' ),
		'private' => __( 'Private', 'wplus-addons' ),
	);
	echo '<div class="wrap wpa-thumb"><h1>' . esc_html__( 'Thumbnail generator', 'wplus-addons' ) . '</h1>';
	wplus_addons_thumbnail_tabs( 'bulk' );
	echo '<p class="description">' . esc_html__( 'Posts that have no featured image. Tick the ones you want; each gets its own picture made from its title, excerpt and tags, with the design you choose below. Posts that already have a featured image are never changed.', 'wplus-addons' ) . '</p>';
	if ( ! $found['posts'] ) {
		echo '<div class="notice notice-success inline"><p>' . esc_html__( 'Every post you can edit already has a featured image.', 'wplus-addons' ) . '</p></div></div>';
		return;
	}
	if ( $found['total'] > count( $found['posts'] ) ) {
		/* translators: 1: posts shown, 2: all posts without a featured image */
		echo '<div class="notice notice-info inline"><p>' . esc_html( sprintf( __( 'Showing %1$d of %2$d posts. Run it again for the rest.', 'wplus-addons' ), count( $found['posts'] ), $found['total'] ) ) . '</p></div>';
	}
	echo '<div class="wpa-bulk"><div class="wpa-bulk-list">';
	echo '<p class="wpa-bulk-bar"><label for="wpb-status" class="screen-reader-text">' . esc_html__( 'Show', 'wplus-addons' ) . '</label><select id="wpb-status"><option value="">' . esc_html__( 'All statuses', 'wplus-addons' ) . '</option><option value="publish">' . esc_html__( 'Published only', 'wplus-addons' ) . '</option><option value="other">' . esc_html__( 'Drafts and others', 'wplus-addons' ) . '</option></select> <span id="wpb-count" class="description"></span></p>';
	echo '<table class="widefat striped wpa-bulk-table"><thead><tr><td class="check-column"><input type="checkbox" id="wpb-all" aria-label="' . esc_attr__( 'Tick all', 'wplus-addons' ) . '" /></td><th>' . esc_html__( 'Post', 'wplus-addons' ) . '</th><th>' . esc_html__( 'Status', 'wplus-addons' ) . '</th><th>' . esc_html__( 'Result', 'wplus-addons' ) . '</th></tr></thead><tbody>';
	foreach ( $found['posts'] as $post ) {
		$status = isset( $labels[ $post['status'] ] ) ? $labels[ $post['status'] ] : $post['status'];
		echo '<tr data-id="' . (int) $post['id'] . '" data-status="' . esc_attr( 'publish' === $post['status'] ? 'publish' : 'other' ) . '"><th scope="row" class="check-column"><input type="checkbox" class="wpb-pick" value="' . (int) $post['id'] . '"' . ( '' === trim( $post['title'] ) ? ' disabled' : '' ) . ' aria-label="' . esc_attr( $post['title'] ) . '" /></th><td><strong>' . esc_html( '' !== trim( $post['title'] ) ? $post['title'] : __( '(no title)', 'wplus-addons' ) ) . '</strong><br /><span class="description">' . esc_html( implode( ', ', $post['labels'] ) ) . '</span></td><td>' . esc_html( $status ) . '<br /><span class="description">' . esc_html( $post['date'] ) . '</span></td><td class="wpb-result" aria-live="polite"></td></tr>';
	}
	echo '</tbody></table></div><div class="wpa-bulk-side">';
	echo '<p><label for="wpb-preset"><strong>' . esc_html__( 'Design', 'wplus-addons' ) . '</strong></label><br /><select id="wpb-preset" class="widefat"></select></p>';
	echo '<p class="description">' . esc_html__( 'Choose a preset, or keep your last settings from the Generator tab.', 'wplus-addons' ) . '</p>';
	echo '<div class="wpa-canvas-wrap"><canvas id="wpb-canvas" aria-label="' . esc_attr__( 'Preview of the first ticked post', 'wplus-addons' ) . '"></canvas></div>';
	echo '<p class="wpa-actions"><button type="button" class="button button-primary" id="wpb-start">' . esc_html__( 'Make the pictures', 'wplus-addons' ) . '</button> <button type="button" class="button" id="wpb-stop" hidden>' . esc_html__( 'Stop', 'wplus-addons' ) . '</button></p>';
	echo '<progress id="wpb-progress" max="1" value="0" hidden style="width:100%"></progress>';
	echo '<p class="description" id="wpb-message" role="status"></p>';
	echo '</div></div></div>';
}
