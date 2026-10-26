<?php
/**
 * Thumbnail generator: Tools > Thumbnail. The picture is drawn in the browser (canvas), so nothing leaves the site.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/presets.php';
require_once __DIR__ . '/bulk.php';

/**
 * Add the page under Tools.
 */
function wplus_addons_thumbnail_menu() {
	add_management_page( __( 'Thumbnail generator', 'wplus-addons' ), __( 'Thumbnail', 'wplus-addons' ), 'upload_files', 'wplus-thumbnail', 'wplus_addons_thumbnail_render_page' );
}
add_action( 'admin_menu', 'wplus_addons_thumbnail_menu' );

/**
 * Fonts that ship with the plugin (SIL Open Font License, see modules/thumbnail/fonts) and the system font.
 *
 * @return array<string,array{label:string,stack:string,files:array<int,array{weight:string,file:string}>}>
 */
function wplus_addons_thumbnail_fonts() {
	$sans = ', system-ui, -apple-system, "Segoe UI", sans-serif';
	return array(
		'dm-sans' => array(
			'label' => 'DM Sans',
			'stack' => '"WPlus DM Sans"' . $sans,
			'files' => array(
				array(
					'weight' => '400',
					'file'   => 'dm-sans-400.woff2',
				),
				array(
					'weight' => '700',
					'file'   => 'dm-sans-700.woff2',
				),
			),
		),
		'inter'   => array(
			'label' => 'Inter',
			'stack' => '"WPlus Inter"' . $sans,
			'files' => array(
				array(
					'weight' => '400',
					'file'   => 'inter-400.woff2',
				),
				array(
					'weight' => '700',
					'file'   => 'inter-700.woff2',
				),
			),
		),
		'lora'    => array(
			'label' => 'Lora (serif)',
			'stack' => '"WPlus Lora", Georgia, "Times New Roman", serif',
			'files' => array(
				array(
					'weight' => '400',
					'file'   => 'lora-400.woff2',
				),
				array(
					'weight' => '700',
					'file'   => 'lora-700.woff2',
				),
			),
		),
		'system'  => array(
			'label' => __( 'System font', 'wplus-addons' ),
			'stack' => 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
			'files' => array(),
		),
	);
}

/**
 * Picture sizes (width x height) of the Ratio list.
 *
 * @return array<string,string>
 */
function wplus_addons_thumbnail_ratios() {
	return array(
		'1200x630'  => __( 'Social share (1200 x 630)', 'wplus-addons' ),
		'1280x720'  => __( '16:9 (1280 x 720)', 'wplus-addons' ),
		'1200x900'  => __( '4:3 (1200 x 900)', 'wplus-addons' ),
		'1080x1080' => __( '1:1 (1080 x 1080)', 'wplus-addons' ),
	);
}

/**
 * The logo the site already has (custom logo, else the site icon), used as the starting value. It can be changed or cleared.
 *
 * @return string Address of the picture, or an empty string.
 */
function wplus_addons_thumbnail_default_logo() {
	$id = (int) get_theme_mod( 'custom_logo' );
	if ( $id ) {
		$url = wp_get_attachment_image_url( $id, 'full' );
		if ( $url ) {
			return $url;
		}
	}
	return (string) get_site_icon_url( 256 );
}

/**
 * Font list for the scripts: CSS stack and the files to load.
 *
 * @return array<string,array{stack:string,files:array<int,array{weight:string,url:string}>}>
 */
function wplus_addons_thumbnail_font_config() {
	$base  = WPLUS_ADDONS_URL . 'modules/thumbnail/';
	$fonts = array();
	foreach ( wplus_addons_thumbnail_fonts() as $key => $font ) {
		$fonts[ $key ] = array(
			'stack' => $font['stack'],
			'files' => array_map(
				static function ( $f ) use ( $base ) {
					return array(
						'weight' => $f['weight'],
						'url'    => $base . 'fonts/' . $f['file'],
					);
				},
				$font['files']
			),
		);
	}
	return $fonts;
}

/**
 * Starting values of the generator (every one can be changed on the page).
 *
 * @return array<string,string>
 */
function wplus_addons_thumbnail_defaults() {
	$base    = array(
		'layout'      => 'minimal',
		'align'       => 'left',
		'title'       => __( '10 things I learned while doing nothing', 'wplus-addons' ),
		'description' => __( 'A fun list of lessons from doing absolutely nothing.', 'wplus-addons' ),
		'org'         => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
		'logo'        => wplus_addons_thumbnail_default_logo(),
		'tag1'        => '',
		'tag2'        => '',
		'accent'      => wplus_addons_thumbnail_theme_accent(),
		'mode'        => 'light',
		'font'        => 'dm-sans',
		'ratio'       => '1200x630',
		'format'      => 'webp',
	);
	$presets = wplus_addons_thumbnail_presets();
	foreach ( $presets['items'] as $item ) {
		if ( $presets['default'] === $item['id'] ) {
			return array_merge( $base, $item['settings'] );
		}
	}
	return $base;
}

/**
 * Load the scripts and styles on the Thumbnail page only.
 *
 * @param string $hook Admin page hook.
 */
function wplus_addons_thumbnail_assets( $hook ) {
	if ( 'tools_page_wplus-thumbnail' !== $hook ) {
		return;
	}
	if ( wplus_addons_thumbnail_is_bulk_tab() ) {
		wplus_addons_thumbnail_bulk_assets();
		return;
	}
	$base = WPLUS_ADDONS_URL . 'modules/thumbnail/';
	wp_enqueue_media();
	wp_enqueue_style( 'wplus-addons-thumbnail', $base . 'assets/admin.css', array(), WPLUS_ADDONS_VERSION );
	wp_enqueue_script( 'wplus-addons-thumbnail-renderer', $base . 'assets/renderer.js', array(), WPLUS_ADDONS_VERSION, true );
	wp_enqueue_script( 'wplus-addons-thumbnail-admin', $base . 'assets/admin.js', array( 'wplus-addons-thumbnail-renderer', 'media-editor', 'wp-api-fetch' ), WPLUS_ADDONS_VERSION, true );
	wp_localize_script(
		'wplus-addons-thumbnail-admin',
		'wplusThumb',
		array(
			'fonts'     => wplus_addons_thumbnail_font_config(),
			'editUrl'   => admin_url( 'post.php' ),
			'defaults'  => wplus_addons_thumbnail_defaults(),
			'presets'   => wplus_addons_thumbnail_presets(),
			'canManage' => current_user_can( 'manage_options' ),
			'i18n'      => array(
				'chooseLogo'   => __( 'Choose a logo', 'wplus-addons' ),
				'useLogo'      => __( 'Use this logo', 'wplus-addons' ),
				'noLogo'       => __( 'No logo', 'wplus-addons' ),
				'logoFailed'   => __( 'The logo could not be drawn. Choose a picture from the Media Library of this site.', 'wplus-addons' ),
				'exportFail'   => __( 'The picture could not be created. Try another format.', 'wplus-addons' ),
				'webpFallback' => __( 'This browser cannot make WebP, so the picture was saved as PNG.', 'wplus-addons' ),
				'saving'       => __( 'Saving…', 'wplus-addons' ),
				'saved'        => __( 'Saved to the Media Library.', 'wplus-addons' ),
				'edit'         => __( 'Edit', 'wplus-addons' ),
				'view'         => __( 'View', 'wplus-addons' ),
				'saveFailed'   => __( 'The picture could not be saved:', 'wplus-addons' ),
				'custom'       => __( '— Custom —', 'wplus-addons' ),
				'defaultTag'   => __( '(default)', 'wplus-addons' ),
				'needName'     => __( 'Give the preset a name first.', 'wplus-addons' ),
				'presetSaved'  => __( 'Preset saved.', 'wplus-addons' ),
				'presetGone'   => __( 'Preset deleted.', 'wplus-addons' ),
				'presetFailed' => __( 'The preset could not be saved:', 'wplus-addons' ),
				'tooMany'      => __( 'There are too many presets. Delete one first.', 'wplus-addons' ),
				'confirmGone'  => __( 'Delete this preset?', 'wplus-addons' ),
			),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'wplus_addons_thumbnail_assets' );

/**
 * The panel in the block editor sidebar (Post tab > Thumbnail), for post types that have a featured image.
 */
function wplus_addons_thumbnail_editor_assets() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || empty( $screen->post_type ) || ! post_type_supports( $screen->post_type, 'thumbnail' ) || ! current_user_can( 'upload_files' ) ) {
		return;
	}
	$base = WPLUS_ADDONS_URL . 'modules/thumbnail/';
	wp_enqueue_script( 'wplus-addons-thumbnail-renderer', $base . 'assets/renderer.js', array(), WPLUS_ADDONS_VERSION, true );
	wp_enqueue_script(
		'wplus-addons-thumbnail-editor',
		$base . 'assets/editor.js',
		array( 'wplus-addons-thumbnail-renderer', 'wp-plugins', 'wp-editor', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-core-data', 'wp-api-fetch' ),
		WPLUS_ADDONS_VERSION,
		true
	);
	wp_localize_script(
		'wplus-addons-thumbnail-editor',
		'wplusThumbEditor',
		array(
			'fonts'           => wplus_addons_thumbnail_font_config(),
			'defaults'        => wplus_addons_thumbnail_defaults(),
			'presets'         => wplus_addons_thumbnail_presets(),
			'defaultCategory' => (int) get_option( 'default_category' ),
			'toolsUrl'        => admin_url( 'tools.php?page=wplus-thumbnail' ),
			'layouts'         => array(
				array(
					'value' => 'minimal',
					'label' => __( 'Minimal (frame)', 'wplus-addons' ),
				),
				array(
					'value' => 'dots',
					'label' => __( 'Dots (3D ring)', 'wplus-addons' ),
				),
				array(
					'value' => 'panel',
					'label' => __( 'Panel', 'wplus-addons' ),
				),
			),
			'modes'           => array(
				array(
					'value' => 'light',
					'label' => __( 'Light', 'wplus-addons' ),
				),
				array(
					'value' => 'dark',
					'label' => __( 'Dark', 'wplus-addons' ),
				),
			),
			'ratios'          => wplus_addons_thumbnail_ratios(),
			'i18n'            => array(
				'panel'        => __( 'Thumbnail', 'wplus-addons' ),
				'preset'       => __( 'Preset', 'wplus-addons' ),
				'custom'       => __( '— Custom —', 'wplus-addons' ),
				'defaultTag'   => __( '(default)', 'wplus-addons' ),
				'layout'       => __( 'Layout', 'wplus-addons' ),
				'mode'         => __( 'Mode', 'wplus-addons' ),
				'ratio'        => __( 'Ratio', 'wplus-addons' ),
				'color'        => __( 'Theme color', 'wplus-addons' ),
				'make'         => __( 'Make the featured image', 'wplus-addons' ),
				'replace'      => __( 'Replace the featured image', 'wplus-addons' ),
				'working'      => __( 'Working…', 'wplus-addons' ),
				'needTitle'    => __( 'Write a title first.', 'wplus-addons' ),
				'done'         => __( 'The picture was saved and set as the featured image. Update the post to keep it.', 'wplus-addons' ),
				'webpFallback' => __( 'This browser cannot make WebP, so a PNG was used.', 'wplus-addons' ),
				'failed'       => __( 'The picture could not be made:', 'wplus-addons' ),
				'more'         => __( 'More options (logo, font, alignment)', 'wplus-addons' ),
			),
		)
	);
}
add_action( 'enqueue_block_editor_assets', 'wplus_addons_thumbnail_editor_assets' );

/**
 * One labelled form row.
 *
 * @param string $id    Field id.
 * @param string $label Label text.
 * @param string $field Field markup, already escaped.
 * @param string $extra_class Extra class.
 */
function wplus_addons_thumbnail_row( $id, $label, $field, $extra_class = '' ) {
	echo '<p class="wpa-field ' . esc_attr( $extra_class ) . '"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>' . $field . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $field is built from escaped parts by the caller.
}

/**
 * A select box.
 *
 * @param string               $id      Field id.
 * @param array<string,string> $options Value => label.
 * @return string
 */
function wplus_addons_thumbnail_select( $id, $options ) {
	$out = '<select id="' . esc_attr( $id ) . '">';
	foreach ( $options as $value => $label ) {
		$out .= '<option value="' . esc_attr( $value ) . '">' . esc_html( $label ) . '</option>';
	}
	return $out . '</select>';
}

/**
 * The page.
 */
function wplus_addons_thumbnail_render_page() {
	if ( ! current_user_can( 'upload_files' ) ) {
		return;
	}
	if ( wplus_addons_thumbnail_is_bulk_tab() ) {
		wplus_addons_thumbnail_render_bulk();
		return;
	}
	$fonts = array();
	foreach ( wplus_addons_thumbnail_fonts() as $key => $font ) {
		$fonts[ $key ] = $font['label'];
	}
	echo '<div class="wrap wpa-thumb"><h1>' . esc_html__( 'Thumbnail generator', 'wplus-addons' ) . '</h1>';
	wplus_addons_thumbnail_tabs( 'generator' );
	echo '<p class="description">' . esc_html__( 'Make a cover picture for a post. It is drawn in your browser; nothing is sent to another site.', 'wplus-addons' ) . '</p>';
	echo '<div class="wpa-layout"><div class="wpa-form">';
	wplus_addons_thumbnail_row( 'wpa-preset', __( 'Preset', 'wplus-addons' ), '<select id="wpa-preset"></select>' );
	if ( current_user_can( 'manage_options' ) ) {
		echo '<details class="wpa-field wpa-manage"><summary>' . esc_html__( 'Manage presets', 'wplus-addons' ) . '</summary>';
		echo '<p class="description">' . esc_html__( 'A preset keeps the design choices (layout, alignment, color, mode, font, size, logo, organization), not the texts. Everyone who makes thumbnails on this site can use it.', 'wplus-addons' ) . '</p>';
		echo '<p><input type="text" id="wpa-preset-name" class="widefat" maxlength="60" placeholder="' . esc_attr__( 'Preset name', 'wplus-addons' ) . '" /></p>';
		echo '<p class="wpa-preset-buttons"><button type="button" class="button" id="wpa-preset-new">' . esc_html__( 'Save as new', 'wplus-addons' ) . '</button> <button type="button" class="button" id="wpa-preset-update">' . esc_html__( 'Update selected', 'wplus-addons' ) . '</button> <button type="button" class="button" id="wpa-preset-default">' . esc_html__( 'Make default', 'wplus-addons' ) . '</button> <button type="button" class="button-link button-link-delete" id="wpa-preset-delete">' . esc_html__( 'Delete', 'wplus-addons' ) . '</button></p>';
		echo '</details>';
	}
	wplus_addons_thumbnail_row(
		'wpa-layout',
		__( 'Layout', 'wplus-addons' ),
		wplus_addons_thumbnail_select(
			'wpa-layout',
			array(
				'minimal' => __( 'Minimal (frame)', 'wplus-addons' ),
				'dots'    => __( 'Dots (3D ring)', 'wplus-addons' ),
				'panel'   => __( 'Panel', 'wplus-addons' ),
			)
		),
		'half'
	);
	wplus_addons_thumbnail_row(
		'wpa-align',
		__( 'Alignment', 'wplus-addons' ),
		wplus_addons_thumbnail_select(
			'wpa-align',
			array(
				'left'   => __( 'Left', 'wplus-addons' ),
				'center' => __( 'Center', 'wplus-addons' ),
				'right'  => __( 'Right', 'wplus-addons' ),
			)
		),
		'half'
	);
	wplus_addons_thumbnail_row( 'wpa-title', __( 'Title', 'wplus-addons' ), '<input type="text" id="wpa-title" class="widefat" maxlength="200" />' );
	wplus_addons_thumbnail_row( 'wpa-description', __( 'Description', 'wplus-addons' ), '<textarea id="wpa-description" class="widefat" rows="2" maxlength="300"></textarea>' );
	wplus_addons_thumbnail_row( 'wpa-org', __( 'Organization', 'wplus-addons' ), '<input type="text" id="wpa-org" class="widefat" maxlength="80" />', 'half' );
	wplus_addons_thumbnail_row(
		'wpa-logo-pick',
		__( 'Logo', 'wplus-addons' ),
		'<span class="wpa-logo"><button type="button" class="button" id="wpa-logo-pick">' . esc_html__( 'Choose', 'wplus-addons' ) . '</button> <button type="button" class="button-link" id="wpa-logo-clear">' . esc_html__( 'Clear', 'wplus-addons' ) . '</button> <span id="wpa-logo-name" class="description"></span></span>',
		'half'
	);
	wplus_addons_thumbnail_row( 'wpa-tag1', __( 'Tag 1', 'wplus-addons' ), '<input type="text" id="wpa-tag1" class="widefat" maxlength="40" />', 'half' );
	wplus_addons_thumbnail_row( 'wpa-tag2', __( 'Tag 2', 'wplus-addons' ), '<input type="text" id="wpa-tag2" class="widefat" maxlength="40" />', 'half' );
	wplus_addons_thumbnail_row( 'wpa-accent', __( 'Theme color', 'wplus-addons' ), '<input type="color" id="wpa-accent" />', 'half' );
	wplus_addons_thumbnail_row(
		'wpa-mode',
		__( 'Mode', 'wplus-addons' ),
		wplus_addons_thumbnail_select(
			'wpa-mode',
			array(
				'light' => __( 'Light', 'wplus-addons' ),
				'dark'  => __( 'Dark', 'wplus-addons' ),
			)
		),
		'half'
	);
	wplus_addons_thumbnail_row( 'wpa-font', __( 'Font family', 'wplus-addons' ), wplus_addons_thumbnail_select( 'wpa-font', $fonts ), 'half' );
	wplus_addons_thumbnail_row( 'wpa-ratio', __( 'Ratio', 'wplus-addons' ), wplus_addons_thumbnail_select( 'wpa-ratio', wplus_addons_thumbnail_ratios() ), 'half' );
	wplus_addons_thumbnail_row(
		'wpa-format',
		__( 'File type', 'wplus-addons' ),
		wplus_addons_thumbnail_select(
			'wpa-format',
			array(
				'webp' => __( 'WebP (lighter, good for SEO)', 'wplus-addons' ),
				'png'  => 'PNG',
			)
		),
		'half'
	);
	echo '</div><div class="wpa-preview"><div class="wpa-canvas-wrap"><canvas id="wpa-canvas" aria-label="' . esc_attr__( 'Preview of the thumbnail', 'wplus-addons' ) . '"></canvas></div>';
	echo '<p class="wpa-actions"><button type="button" class="button" id="wpa-reset">' . esc_html__( 'Reset', 'wplus-addons' ) . '</button> <button type="button" class="button" id="wpa-export">' . esc_html__( 'Export', 'wplus-addons' ) . '</button> <button type="button" class="button button-primary" id="wpa-save">' . esc_html__( 'Save to Media Library', 'wplus-addons' ) . '</button></p>';
	echo '<p class="description" id="wpa-message" role="status"></p></div></div></div>';
}
