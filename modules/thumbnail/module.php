<?php
/**
 * Thumbnail generator: Tools > Thumbnail. The picture is drawn in the browser (canvas), so nothing leaves the site.
 *
 * @package wplus-addons
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
 * Load the scripts and styles on the Thumbnail page only.
 *
 * @param string $hook Admin page hook.
 */
function wplus_addons_thumbnail_assets( $hook ) {
	if ( 'tools_page_wplus-thumbnail' !== $hook ) {
		return;
	}
	$base = WPLUS_ADDONS_URL . 'modules/thumbnail/';
	wp_enqueue_media();
	wp_enqueue_style( 'wplus-addons-thumbnail', $base . 'assets/admin.css', array(), WPLUS_ADDONS_VERSION );
	wp_enqueue_script( 'wplus-addons-thumbnail-renderer', $base . 'assets/renderer.js', array(), WPLUS_ADDONS_VERSION, true );
	wp_enqueue_script( 'wplus-addons-thumbnail-admin', $base . 'assets/admin.js', array( 'wplus-addons-thumbnail-renderer', 'media-editor' ), WPLUS_ADDONS_VERSION, true );
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
	wp_localize_script(
		'wplus-addons-thumbnail-admin',
		'wplusThumb',
		array(
			'fonts'    => $fonts,
			'defaults' => array(
				'layout'      => 'minimal',
				'align'       => 'left',
				'title'       => __( '10 things I learned while doing nothing', 'wplus-addons' ),
				'description' => __( 'A fun list of lessons from doing absolutely nothing.', 'wplus-addons' ),
				'org'         => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
				'logo'        => wplus_addons_thumbnail_default_logo(),
				'tag1'        => '',
				'tag2'        => '',
				'accent'      => '#2563eb',
				'mode'        => 'light',
				'font'        => 'dm-sans',
				'ratio'       => '1200x630',
				'format'      => 'png',
			),
			'i18n'     => array(
				'chooseLogo' => __( 'Choose a logo', 'wplus-addons' ),
				'useLogo'    => __( 'Use this logo', 'wplus-addons' ),
				'noLogo'     => __( 'No logo', 'wplus-addons' ),
				'logoFailed' => __( 'The logo could not be drawn. Choose a picture from the Media Library of this site.', 'wplus-addons' ),
				'exportFail' => __( 'The picture could not be created. Try another format.', 'wplus-addons' ),
			),
		)
	);
}
add_action( 'admin_enqueue_scripts', 'wplus_addons_thumbnail_assets' );

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
	$fonts = array();
	foreach ( wplus_addons_thumbnail_fonts() as $key => $font ) {
		$fonts[ $key ] = $font['label'];
	}
	echo '<div class="wrap wpa-thumb"><h1>' . esc_html__( 'Thumbnail generator', 'wplus-addons' ) . '</h1>';
	echo '<p class="description">' . esc_html__( 'Make a cover picture for a post. It is drawn in your browser; nothing is sent to another site.', 'wplus-addons' ) . '</p>';
	echo '<div class="wpa-layout"><div class="wpa-form">';
	wplus_addons_thumbnail_row(
		'wpa-layout',
		__( 'Layout', 'wplus-addons' ),
		wplus_addons_thumbnail_select(
			'wpa-layout',
			array(
				'minimal' => __( 'Minimal', 'wplus-addons' ),
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
				'png'  => 'PNG',
				'webp' => 'WebP',
			)
		),
		'half'
	);
	echo '</div><div class="wpa-preview"><div class="wpa-canvas-wrap"><canvas id="wpa-canvas" aria-label="' . esc_attr__( 'Preview of the thumbnail', 'wplus-addons' ) . '"></canvas></div>';
	echo '<p class="wpa-actions"><button type="button" class="button" id="wpa-reset">' . esc_html__( 'Reset', 'wplus-addons' ) . '</button> <button type="button" class="button button-primary" id="wpa-export">' . esc_html__( 'Export', 'wplus-addons' ) . '</button></p>';
	echo '<p class="description" id="wpa-message" role="status"></p></div></div></div>';
}
