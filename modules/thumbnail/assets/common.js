/*
 * WPlus Addons: helpers shared by the thumbnail screens (saved settings, fonts, logo, file name, picture file).
 */
( function ( global ) {
	'use strict';

	var STORE = 'wplusThumb.v1';
	var loadedFonts = {};

	/* The design choices this browser remembers from the last time (the same ones the Generator tab keeps). */
	function readSaved() {
		try {
			return JSON.parse( global.localStorage.getItem( STORE ) ) || {};
		} catch ( e ) {
			return {};
		}
	}

	/* Load the files of a font once; resolves when it can be drawn (or when it cannot be loaded). */
	function loadFont( fonts, key ) {
		var font = fonts[ key ];
		if ( ! font || ! font.files.length || loadedFonts[ key ] || ! global.FontFace ) {
			return Promise.resolve();
		}
		loadedFonts[ key ] = true;
		var family = font.stack.split( ',' )[ 0 ].replace( /"/g, '' );
		return Promise.all( font.files.map( function ( f ) {
			var face = new global.FontFace( family, 'url(' + f.url + ')', { weight: f.weight } );
			return face.load().then( function ( loaded ) {
				global.document.fonts.add( loaded );
			} );
		} ) ).catch( function () {
			loadedFonts[ key ] = false;
		} );
	}

	/* Load a picture; resolves with the image, or null when it cannot be loaded. */
	function loadImage( url ) {
		if ( ! url ) {
			return Promise.resolve( null );
		}
		return new Promise( function ( resolve ) {
			var img = new global.Image();
			img.onload = function () {
				resolve( img );
			};
			img.onerror = function () {
				resolve( null );
			};
			img.src = url;
		} );
	}

	function slug( text ) {
		return String( text || 'thumbnail' ).toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' ).slice( 0, 60 ) || 'thumbnail';
	}

	/*
	 * The canvas as a file: WebP unless PNG is wanted, and PNG when the browser cannot make WebP.
	 * Resolves with { blob, ext, fallback }, or null when nothing could be made.
	 */
	function toBlob( canvas, wantPng ) {
		return new Promise( function ( resolve ) {
			canvas.toBlob( function ( blob ) {
				if ( blob && ( wantPng ? 'image/png' : 'image/webp' ) === blob.type ) {
					resolve( { blob: blob, ext: wantPng ? 'png' : 'webp', fallback: false } );
					return;
				}
				canvas.toBlob( function ( png ) {
					resolve( png ? { blob: png, ext: 'png', fallback: ! wantPng } : null );
				}, 'image/png' );
			}, wantPng ? 'image/png' : 'image/webp', 0.9 );
		} );
	}

	global.WPlusThumbCommon = { readSaved: readSaved, loadFont: loadFont, loadImage: loadImage, slug: slug, toBlob: toBlob };
}( window ) );
