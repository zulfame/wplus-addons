/*
 * WPlus Addons: the Thumbnail panel in the block editor (Post tab). It shows a preview made from the post, and one
 * button that draws the picture, saves it to the Media Library (attached to the post) and sets it as the featured image.
 * The design choices are shared with Tools > Thumbnail (same saved settings).
 */
( function () {
	'use strict';

	var cfg = window.wplusThumbEditor;
	var wp = window.wp;
	if ( ! cfg || ! wp || ! wp.plugins || ! wp.element || ! wp.data || ! wp.components || ! window.WPlusThumb ) {
		return;
	}
	var Panel = ( wp.editor && wp.editor.PluginDocumentSettingPanel ) || ( wp.editPost && wp.editPost.PluginDocumentSettingPanel );
	if ( ! Panel ) {
		return;
	}
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useSelect = wp.data.useSelect;
	var SelectControl = wp.components.SelectControl;
	var Button = wp.components.Button;
	var STORE = 'wplusThumb.v1';
	var KEEP = [ 'layout', 'align', 'org', 'logo', 'accent', 'mode', 'font', 'ratio', 'format' ];
	var loadedFonts = {};

	function readSaved() {
		var saved = {};
		try {
			saved = JSON.parse( window.localStorage.getItem( STORE ) ) || {};
		} catch ( e ) {}
		return Object.assign( {}, cfg.defaults, saved );
	}

	function writeSaved( settings ) {
		try {
			var keep = {};
			KEEP.forEach( function ( k ) {
				keep[ k ] = settings[ k ];
			} );
			window.localStorage.setItem( STORE, JSON.stringify( keep ) );
		} catch ( e ) {}
	}

	function slug( text ) {
		return String( text || 'thumbnail' ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' ).slice( 0, 60 ) || 'thumbnail';
	}

	function loadFont( key ) {
		var font = cfg.fonts[ key ];
		if ( ! font || ! font.files.length || loadedFonts[ key ] || ! window.FontFace ) {
			return Promise.resolve();
		}
		loadedFonts[ key ] = true;
		var family = font.stack.split( ',' )[ 0 ].replace( /"/g, '' );
		return Promise.all( font.files.map( function ( f ) {
			var face = new window.FontFace( family, 'url(' + f.url + ')', { weight: f.weight } );
			return face.load().then( function ( loaded ) {
				document.fonts.add( loaded );
			} );
		} ) ).catch( function () {
			loadedFonts[ key ] = false;
		} );
	}

	/* Text of the first blocks, as a short description when the post has no excerpt. */
	function descriptionFromContent() {
		var html = wp.data.select( 'core/editor' ).getEditedPostContent() || '';
		var box = document.createElement( 'div' );
		box.innerHTML = html.replace( /<!--[\s\S]*?-->/g, ' ' ).replace( /<(h[1-6]|figure|pre|table|ul|ol|blockquote)[\s\S]*?<\/\1>/gi, ' ' );
		var text = ( box.textContent || '' ).replace( /\s+/g, ' ' ).trim();
		return text.length > 160 ? text.slice( 0, 157 ).replace( /\s+\S*$/, '' ) + '…' : text;
	}

	function ThumbnailPanel() {
		var data = useSelect( function ( select ) {
			var ed = select( 'core/editor' );
			var core = select( 'core' );
			var tagIds = ed.getEditedPostAttribute( 'tags' ) || [];
			var catIds = ( ed.getEditedPostAttribute( 'categories' ) || [] ).filter( function ( id ) {
				return id !== cfg.defaultCategory; // the default category ("Uncategorized") says nothing on a picture
			} );
			var names = function ( taxonomy, ids ) {
				if ( ! ids.length ) {
					return '';
				}
				var rows = core.getEntityRecords( 'taxonomy', taxonomy, { include: ids, per_page: 10 } ) || [];
				return rows.map( function ( r ) {
					return r.name;
				} ).join( '\u0001' );
			};
			return {
				id: ed.getCurrentPostId(),
				title: ed.getEditedPostAttribute( 'title' ) || '',
				excerpt: ed.getEditedPostAttribute( 'excerpt' ) || '',
				featured: ed.getEditedPostAttribute( 'featured_media' ) || 0,
				tags: names( 'post_tag', tagIds ),
				cats: names( 'category', catIds ),
			};
		}, [] );

		var settingsState = useState( readSaved );
		var settings = settingsState[ 0 ];
		var setSettings = settingsState[ 1 ];
		var busyState = useState( false );
		var messageState = useState( '' );
		var autoState = useState( '' );
		var logoState = useState( null );
		var fontState = useState( 0 );
		var canvasState = useState( null ); // the canvas exists only while the panel is open, so it reports itself

		var title = String( data.title ).replace( /<[^>]*>/g, '' ).trim();
		var plainExcerpt = String( data.excerpt ).replace( /<[^>]*>/g, '' ).replace( /\s+/g, ' ' ).trim();
		var description = plainExcerpt || autoState[ 0 ];
		var tagList = data.tags ? data.tags.split( '\u0001' ) : [];
		if ( tagList.length < 2 && data.cats ) {
			tagList = tagList.concat( data.cats.split( '\u0001' ) );
		}

		function options() {
			var size = String( settings.ratio ).split( 'x' );
			return {
				layout: settings.layout,
				align: settings.align,
				mode: settings.mode,
				accent: settings.accent,
				width: size[ 0 ],
				height: size[ 1 ],
				title: title,
				description: description,
				org: settings.org,
				logo: logoState[ 0 ],
				tag1: tagList[ 0 ] || '',
				tag2: tagList[ 1 ] || '',
				font: ( cfg.fonts[ settings.font ] || cfg.fonts[ 'dm-sans' ] ).stack,
			};
		}

		/* a short description from the content, a moment after the title or excerpt changes */
		useEffect( function () {
			if ( plainExcerpt ) {
				return undefined;
			}
			var t = setTimeout( function () {
				autoState[ 1 ]( descriptionFromContent() );
			}, 400 );
			return function () {
				clearTimeout( t );
			};
		}, [ plainExcerpt, title ] );

		useEffect( function () {
			if ( ! settings.logo ) {
				logoState[ 1 ]( null );
				return undefined;
			}
			var alive = true;
			var img = new window.Image();
			img.onload = function () {
				if ( alive ) {
					logoState[ 1 ]( img );
				}
			};
			img.onerror = function () {
				if ( alive ) {
					logoState[ 1 ]( null );
				}
			};
			img.src = settings.logo;
			return function () {
				alive = false;
			};
		}, [ settings.logo ] );

		useEffect( function () {
			loadFont( settings.font ).then( function () {
				fontState[ 1 ]( function ( n ) {
					return n + 1;
				} );
			} );
		}, [ settings.font ] );

		useEffect( function () {
			if ( canvasState[ 0 ] ) {
				window.WPlusThumb.render( canvasState[ 0 ], options() );
			}
		} );

		function change( key, value ) {
			var next = Object.assign( {}, settings );
			next[ key ] = value;
			setSettings( next );
			writeSaved( next );
		}

		function fail( err ) {
			messageState[ 1 ]( cfg.i18n.failed + ' ' + ( err && err.message ? err.message : '' ) );
			busyState[ 1 ]( false );
		}

		function upload( blob, ext, fallback ) {
			var form = new window.FormData();
			form.append( 'file', blob, slug( title ) + '-thumbnail.' + ext );
			form.append( 'title', title );
			form.append( 'alt_text', title );
			form.append( 'description', description );
			form.append( 'post', String( data.id ) );
			wp.apiFetch( { path: '/wp/v2/media', method: 'POST', body: form } ).then( function ( media ) {
				wp.data.dispatch( 'core/editor' ).editPost( { featured_media: media.id } );
				messageState[ 1 ]( ( fallback ? cfg.i18n.webpFallback + ' ' : '' ) + cfg.i18n.done );
				busyState[ 1 ]( false );
				if ( wp.data.dispatch( 'core/notices' ) ) {
					wp.data.dispatch( 'core/notices' ).createSuccessNotice( cfg.i18n.done, { type: 'snackbar' } );
				}
			} ).catch( fail );
		}

		function generate() {
			if ( ! title ) {
				messageState[ 1 ]( cfg.i18n.needTitle );
				return;
			}
			busyState[ 1 ]( true );
			messageState[ 1 ]( '' );
			var opts = options();
			var off = document.createElement( 'canvas' );
			window.WPlusThumb.render( off, opts );
			var wantPng = 'png' === settings.format;
			off.toBlob( function ( blob ) {
				if ( blob && ( wantPng ? 'image/png' : 'image/webp' ) === blob.type ) {
					upload( blob, wantPng ? 'png' : 'webp', false );
					return;
				}
				off.toBlob( function ( png ) {
					if ( png ) {
						upload( png, 'png', ! wantPng );
					} else {
						fail( null );
					}
				}, 'image/png' );
			}, wantPng ? 'image/png' : 'image/webp', 0.9 );
		}

		var busy = busyState[ 0 ];
		return el(
			Panel,
			{ name: 'wplus-thumbnail', title: cfg.i18n.panel, className: 'wplus-thumbnail-panel', initialOpen: false },
			el( 'canvas', { ref: canvasState[ 1 ], 'aria-hidden': 'true', style: { width: '100%', height: 'auto', display: 'block', borderRadius: '4px', border: '1px solid #dcdcde', marginBottom: '12px' } } ),
			cfg.presets && cfg.presets.items.length ? el( SelectControl, {
				label: cfg.i18n.preset,
				value: '',
				options: [ { value: '', label: cfg.i18n.custom } ].concat( cfg.presets.items.map( function ( p ) {
					return { value: p.id, label: p.name + ( p.id === cfg.presets[ 'default' ] ? ' ' + cfg.i18n.defaultTag : '' ) };
				} ) ),
				onChange: function ( id ) {
					var p = cfg.presets.items.filter( function ( x ) {
						return x.id === id;
					} )[ 0 ];
					if ( p ) {
						var next = Object.assign( {}, settings, p.settings );
						setSettings( next );
						writeSaved( next );
					}
				},
				__nextHasNoMarginBottom: true,
			} ) : null,
			cfg.presets && cfg.presets.items.length ? el( 'div', { style: { height: '8px' } } ) : null,
			el( SelectControl, { label: cfg.i18n.layout, value: settings.layout, options: cfg.layouts, onChange: function ( v ) {
				change( 'layout', v );
			}, __nextHasNoMarginBottom: true } ),
			el( 'div', { style: { height: '8px' } } ),
			el( SelectControl, { label: cfg.i18n.mode, value: settings.mode, options: cfg.modes, onChange: function ( v ) {
				change( 'mode', v );
			}, __nextHasNoMarginBottom: true } ),
			el( 'div', { style: { height: '8px' } } ),
			el( SelectControl, {
				label: cfg.i18n.ratio,
				value: settings.ratio,
				options: Object.keys( cfg.ratios ).map( function ( k ) {
					return { value: k, label: cfg.ratios[ k ] };
				} ),
				onChange: function ( v ) {
					change( 'ratio', v );
				},
				__nextHasNoMarginBottom: true,
			} ),
			el( 'p', { style: { margin: '12px 0 4px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' } }, cfg.i18n.color ),
			el( 'input', { type: 'color', value: settings.accent, 'aria-label': cfg.i18n.color, style: { width: '100%', height: '32px', padding: '2px' }, onChange: function ( e ) {
				change( 'accent', e.target.value );
			} } ),
			el( 'div', { style: { marginTop: '14px' } },
				el( Button, { variant: 'primary', isBusy: busy, disabled: busy || ! title, onClick: generate, style: { width: '100%', justifyContent: 'center' } }, busy ? cfg.i18n.working : ( data.featured ? cfg.i18n.replace : cfg.i18n.make ) )
			),
			! title && ! messageState[ 0 ] ? el( 'p', { className: 'description', style: { marginBottom: 0 } }, cfg.i18n.needTitle ) : null,
			messageState[ 0 ] ? el( 'p', { role: 'status', style: { marginBottom: 0 } }, messageState[ 0 ] ) : null,
			el( 'p', { style: { marginBottom: 0 } }, el( 'a', { href: cfg.toolsUrl, target: '_blank', rel: 'noopener' }, cfg.i18n.more ) )
		);
	}

	wp.plugins.registerPlugin( 'wplus-addons-thumbnail', { render: ThumbnailPanel } );
}() );
