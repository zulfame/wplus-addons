/*
 * WPlus Addons: thumbnail page. Connects the form to WPlusThumb.render and exports the picture.
 */
( function () {
	'use strict';

	var cfg = window.wplusThumb;
	var $ = function ( id ) {
		return document.getElementById( id );
	};
	var canvas = $( 'wpa-canvas' );
	if ( ! cfg || ! canvas || ! window.WPlusThumb ) {
		return;
	}
	var STORE = 'wplusThumb.v1';
	var KEEP = [ 'layout', 'align', 'org', 'logo', 'accent', 'mode', 'font', 'ratio', 'format' ]; // design choices are remembered, texts are not
	var fields = [ 'layout', 'align', 'title', 'description', 'org', 'tag1', 'tag2', 'accent', 'mode', 'font', 'ratio', 'format' ];
	var state = {};
	var logoImg = null;
	var logoUrl = '';
	var loadedFonts = {};
	var queued = false;

	function say( text ) {
		$( 'wpa-message' ).textContent = text || '';
	}

	function read() {
		try {
			return JSON.parse( window.localStorage.getItem( STORE ) ) || {};
		} catch ( e ) {
			return {};
		}
	}

	function save() {
		try {
			var keep = {};
			KEEP.forEach( function ( k ) {
				keep[ k ] = state[ k ];
			} );
			window.localStorage.setItem( STORE, JSON.stringify( keep ) );
		} catch ( e ) {}
	}

	function forget() {
		try {
			window.localStorage.removeItem( STORE );
		} catch ( e ) {}
	}

	function apply( values ) {
		fields.forEach( function ( k ) {
			var el = $( 'wpa-' + k );
			if ( el && values[ k ] !== undefined ) {
				el.value = values[ k ];
			}
		} );
		setLogo( values.logo || '' );
	}

	function collect() {
		fields.forEach( function ( k ) {
			state[ k ] = $( 'wpa-' + k ).value;
		} );
		state.logo = logoUrl;
	}

	function setLogo( url ) {
		logoUrl = url || '';
		logoImg = null;
		$( 'wpa-logo-name' ).textContent = logoUrl ? logoUrl.split( '/' ).pop() : cfg.i18n.noLogo;
		if ( ! logoUrl ) {
			schedule();
			return;
		}
		var img = new Image();
		img.onload = function () {
			if ( logoUrl === url ) {
				logoImg = img;
				schedule();
			}
		};
		img.onerror = function () {
			if ( logoUrl === url ) {
				logoImg = null;
				say( cfg.i18n.logoFailed );
				schedule();
			}
		};
		img.src = url;
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

	function options() {
		var size = String( state.ratio ).split( 'x' );
		return {
			layout: state.layout,
			align: state.align,
			mode: state.mode,
			accent: state.accent,
			width: size[ 0 ],
			height: size[ 1 ],
			title: state.title,
			description: state.description,
			org: state.org,
			logo: logoImg,
			tag1: state.tag1,
			tag2: state.tag2,
			font: ( cfg.fonts[ state.font ] || cfg.fonts[ 'dm-sans' ] ).stack,
		};
	}

	function draw() {
		queued = false;
		window.WPlusThumb.render( canvas, options() );
	}

	function schedule() {
		if ( queued ) {
			return;
		}
		queued = true;
		window.requestAnimationFrame( draw );
	}

	function change() {
		collect();
		save();
		say( '' );
		loadFont( state.font ).then( schedule );
		schedule();
	}

	function slug( text ) {
		return String( text || 'thumbnail' ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' ).slice( 0, 60 ) || 'thumbnail';
	}

	function download( blob, ext ) {
		var url = URL.createObjectURL( blob );
		var link = document.createElement( 'a' );
		link.href = url;
		link.download = slug( state.title ) + '-thumbnail.' + ext;
		document.body.appendChild( link );
		link.click();
		document.body.removeChild( link );
		setTimeout( function () {
			URL.revokeObjectURL( url );
		}, 1000 );
	}

	/*
	 * Make the picture as a file: WebP when asked (the default, lighter and better for SEO), PNG otherwise or when the
	 * browser cannot make WebP. Calls done( { blob, ext, fallback } ), or done( null ) when nothing could be made.
	 */
	function makePicture( done ) {
		draw();
		var wantWebp = 'webp' === state.format;
		canvas.toBlob( function ( blob ) {
			if ( blob && wantWebp && 'image/webp' === blob.type ) {
				done( { blob: blob, ext: 'webp', fallback: false } );
				return;
			}
			if ( blob && ! wantWebp && 'image/png' === blob.type ) {
				done( { blob: blob, ext: 'png', fallback: false } );
				return;
			}
			if ( wantWebp ) {
				canvas.toBlob( function ( png ) {
					done( png ? { blob: png, ext: 'png', fallback: true } : null );
				}, 'image/png' );
				return;
			}
			done( null );
		}, wantWebp ? 'image/webp' : 'image/png', 0.9 );
	}

	function exportPicture() {
		makePicture( function ( pic ) {
			if ( ! pic ) {
				say( cfg.i18n.exportFail );
				return;
			}
			say( pic.fallback ? cfg.i18n.webpFallback : '' );
			download( pic.blob, pic.ext );
		} );
	}

	/* Save the picture with the REST API of WordPress itself (/wp/v2/media): it checks who may upload and what the file is. */
	function saveToMedia() {
		var button = $( 'wpa-save' );
		makePicture( function ( pic ) {
			if ( ! pic ) {
				say( cfg.i18n.exportFail );
				return;
			}
			var title = String( state.title || '' ).trim();
			var form = new window.FormData();
			form.append( 'file', pic.blob, slug( title ) + '-thumbnail.' + pic.ext );
			form.append( 'title', title );
			form.append( 'alt_text', title );
			form.append( 'description', String( state.description || '' ).trim() );
			button.disabled = true;
			say( cfg.i18n.saving );
			window.wp.apiFetch( { path: '/wp/v2/media', method: 'POST', body: form } ).then( function ( media ) {
				var msg = $( 'wpa-message' );
				msg.textContent = ( pic.fallback ? cfg.i18n.webpFallback + ' ' : '' ) + cfg.i18n.saved + ' ';
				var edit = document.createElement( 'a' );
				edit.href = cfg.editUrl + '?post=' + encodeURIComponent( media.id ) + '&action=edit';
				edit.textContent = cfg.i18n.edit;
				msg.appendChild( edit );
				if ( media.source_url ) {
					msg.appendChild( document.createTextNode( ' | ' ) );
					var view = document.createElement( 'a' );
					view.href = media.source_url;
					view.target = '_blank';
					view.rel = 'noopener';
					view.textContent = cfg.i18n.view;
					msg.appendChild( view );
				}
			} ).catch( function ( err ) {
				say( cfg.i18n.saveFailed + ' ' + ( err && err.message ? err.message : '' ) );
			} ).then( function () {
				button.disabled = false;
			} );
		} );
	}

	fields.forEach( function ( k ) {
		var el = $( 'wpa-' + k );
		el.addEventListener( 'input', change );
		el.addEventListener( 'change', change );
	} );

	/* ---------- presets: named design choices shared by the whole site ---------- */
	var MAX_PRESETS = 20;
	var presets = cfg.presets || { 'default': '', items: [] };
	var presetSel = $( 'wpa-preset' );

	function designOf() {
		var design = {};
		KEEP.forEach( function ( k ) {
			design[ k ] = state[ k ];
		} );
		return design;
	}

	function findPreset( id ) {
		return presets.items.filter( function ( p ) {
			return p.id === id;
		} )[ 0 ] || null;
	}

	function sameDesign( a, b ) {
		return KEEP.every( function ( k ) {
			return String( a[ k ] ) === String( b[ k ] );
		} );
	}

	function renderPresets( selectedId ) {
		presetSel.innerHTML = '';
		var none = document.createElement( 'option' );
		none.value = '';
		none.textContent = cfg.i18n.custom;
		presetSel.appendChild( none );
		presets.items.forEach( function ( p ) {
			var opt = document.createElement( 'option' );
			opt.value = p.id;
			opt.textContent = p.name + ( p.id === presets[ 'default' ] ? ' ' + cfg.i18n.defaultTag : '' );
			presetSel.appendChild( opt );
		} );
		presetSel.value = findPreset( selectedId ) ? selectedId : '';
		[ 'wpa-preset-update', 'wpa-preset-default', 'wpa-preset-delete' ].forEach( function ( id ) {
			if ( $( id ) ) {
				$( id ).disabled = ! presetSel.value;
			}
		} );
	}

	function savePresets( next, selectedId, doneText ) {
		window.wp.apiFetch( { path: '/wp/v2/settings', method: 'POST', data: { wplus_addons_thumbnail_presets: next } } ).then( function ( response ) {
			presets = response.wplus_addons_thumbnail_presets || next;
			renderPresets( selectedId );
			say( doneText );
		} ).catch( function ( err ) {
			say( cfg.i18n.presetFailed + ' ' + ( err && err.message ? err.message : '' ) );
		} );
	}

	function presetCopy() {
		return JSON.parse( JSON.stringify( presets ) );
	}

	function idFromName( name, taken ) {
		var base = String( name ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' ).slice( 0, 36 ) || 'preset';
		var id = base;
		var n = 2;
		while ( taken.indexOf( id ) >= 0 ) {
			id = base + '-' + n++;
		}
		return id;
	}

	presetSel.addEventListener( 'change', function () {
		var p = findPreset( presetSel.value );
		if ( p ) {
			apply( Object.assign( {}, state, p.settings ) );
			change();
		}
		renderPresets( presetSel.value );
	} );

	if ( cfg.canManage && $( 'wpa-preset-new' ) ) {
		$( 'wpa-preset-new' ).addEventListener( 'click', function () {
			var name = $( 'wpa-preset-name' ).value.trim();
			if ( ! name ) {
				say( cfg.i18n.needName );
				return;
			}
			if ( presets.items.length >= MAX_PRESETS ) {
				say( cfg.i18n.tooMany );
				return;
			}
			var next = presetCopy();
			var id = idFromName( name, next.items.map( function ( p ) {
				return p.id;
			} ) );
			next.items.push( { id: id, name: name, settings: designOf() } );
			$( 'wpa-preset-name' ).value = '';
			savePresets( next, id, cfg.i18n.presetSaved );
		} );
		$( 'wpa-preset-update' ).addEventListener( 'click', function () {
			var next = presetCopy();
			var id = presetSel.value;
			var rename = $( 'wpa-preset-name' ).value.trim();
			next.items.forEach( function ( p ) {
				if ( p.id === id ) {
					p.settings = designOf();
					if ( rename ) {
						p.name = rename;
					}
				}
			} );
			$( 'wpa-preset-name' ).value = '';
			savePresets( next, id, cfg.i18n.presetSaved );
		} );
		$( 'wpa-preset-default' ).addEventListener( 'click', function () {
			var next = presetCopy();
			next[ 'default' ] = next[ 'default' ] === presetSel.value ? '' : presetSel.value;
			savePresets( next, presetSel.value, cfg.i18n.presetSaved );
		} );
		$( 'wpa-preset-delete' ).addEventListener( 'click', function () {
			if ( ! window.confirm( cfg.i18n.confirmGone ) ) {
				return;
			}
			var next = presetCopy();
			var id = presetSel.value;
			next.items = next.items.filter( function ( p ) {
				return p.id !== id;
			} );
			if ( next[ 'default' ] === id ) {
				next[ 'default' ] = '';
			}
			savePresets( next, '', cfg.i18n.presetGone );
		} );
	}

	function matchingPreset() {
		var design = designOf();
		var hit = presets.items.filter( function ( p ) {
			return sameDesign( design, Object.assign( {}, cfg.defaults, p.settings ) );
		} )[ 0 ];
		return hit ? hit.id : '';
	}

	$( 'wpa-logo-pick' ).addEventListener( 'click', function () {
		if ( ! window.wp || ! window.wp.media ) {
			return;
		}
		var frame = window.wp.media( { title: cfg.i18n.chooseLogo, button: { text: cfg.i18n.useLogo }, library: { type: 'image' }, multiple: false } );
		frame.on( 'select', function () {
			var item = frame.state().get( 'selection' ).first().toJSON();
			setLogo( item.url );
			collect();
			state.logo = item.url;
			save();
		} );
		frame.open();
	} );
	$( 'wpa-logo-clear' ).addEventListener( 'click', function () {
		setLogo( '' );
		state.logo = '';
		save();
	} );
	$( 'wpa-reset' ).addEventListener( 'click', function () {
		forget();
		apply( cfg.defaults );
		change();
		renderPresets( presets[ 'default' ] );
	} );
	$( 'wpa-export' ).addEventListener( 'click', exportPicture );
	$( 'wpa-save' ).addEventListener( 'click', saveToMedia );

	var start = Object.assign( {}, cfg.defaults, read() );
	apply( start );
	collect();
	renderPresets( matchingPreset() );
	loadFont( state.font ).then( schedule );
	schedule();
}() );
