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

	/* WebP is the default (lighter, better for page speed and SEO); a browser that cannot make it gets a PNG instead. */
	function exportPicture() {
		draw();
		var wantWebp = 'webp' === state.format;
		canvas.toBlob( function ( blob ) {
			if ( blob && wantWebp && 'image/webp' === blob.type ) {
				download( blob, 'webp' );
				return;
			}
			if ( blob && ! wantWebp && 'image/png' === blob.type ) {
				download( blob, 'png' );
				return;
			}
			if ( wantWebp ) {
				canvas.toBlob( function ( png ) {
					if ( png ) {
						say( cfg.i18n.webpFallback );
						download( png, 'png' );
					} else {
						say( cfg.i18n.exportFail );
					}
				}, 'image/png' );
				return;
			}
			say( cfg.i18n.exportFail );
		}, wantWebp ? 'image/webp' : 'image/png', 0.9 );
	}

	fields.forEach( function ( k ) {
		var el = $( 'wpa-' + k );
		el.addEventListener( 'input', change );
		el.addEventListener( 'change', change );
	} );

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
	} );
	$( 'wpa-export' ).addEventListener( 'click', exportPicture );

	var start = Object.assign( {}, cfg.defaults, read() );
	apply( start );
	collect();
	loadFont( state.font ).then( schedule );
	schedule();
}() );
