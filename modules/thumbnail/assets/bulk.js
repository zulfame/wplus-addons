/*
 * WPlus Addons: Bulk tab. Makes the featured image of every ticked post, one after the other, in this browser:
 * draw the picture, save it to the Media Library (attached to the post), then set it as the featured image.
 */
( function () {
	'use strict';

	var cfg = window.wplusBulk;
	var C = window.WPlusThumbCommon;
	var $ = function ( id ) {
		return document.getElementById( id );
	};
	var canvas = $( 'wpb-canvas' );
	if ( ! cfg || ! C || ! canvas || ! window.WPlusThumb || ! window.wp || ! window.wp.apiFetch ) {
		return;
	}
	var posts = {};
	cfg.posts.forEach( function ( p ) {
		posts[ p.id ] = p;
	} );
	var presets = cfg.presets || { items: [] };
	var design = Object.assign( {}, cfg.defaults, C.readSaved() );
	var logoImg = null;
	var running = false;
	var stopRequested = false;

	function rows() {
		return Array.prototype.slice.call( document.querySelectorAll( '.wpa-bulk-table tbody tr' ) );
	}

	function ticked() {
		return rows().filter( function ( tr ) {
			var box = tr.querySelector( '.wpb-pick' );
			return ! tr.hidden && box && box.checked && ! box.disabled;
		} ).map( function ( tr ) {
			return parseInt( tr.getAttribute( 'data-id' ), 10 );
		} );
	}

	function say( text ) {
		$( 'wpb-message' ).textContent = text || '';
	}

	function result( id, text, link ) {
		var cell = document.querySelector( 'tr[data-id="' + id + '"] .wpb-result' );
		if ( ! cell ) {
			return;
		}
		cell.textContent = text + ' ';
		if ( link ) {
			var a = document.createElement( 'a' );
			a.href = cfg.editUrl + '?post=' + id + '&action=edit';
			a.textContent = link;
			cell.appendChild( a );
		}
	}

	function optionsFor( post ) {
		var size = String( design.ratio ).split( 'x' );
		return {
			layout: design.layout,
			align: design.align,
			mode: design.mode,
			accent: design.accent,
			width: size[ 0 ],
			height: size[ 1 ],
			title: post.title,
			description: post.description,
			org: design.org,
			logo: logoImg,
			tag1: post.labels[ 0 ] || '',
			tag2: post.labels[ 1 ] || '',
			font: ( cfg.fonts[ design.font ] || cfg.fonts[ 'dm-sans' ] ).stack,
		};
	}

	function prepare() {
		return Promise.all( [ C.loadFont( cfg.fonts, design.font ), C.loadImage( design.logo ) ] ).then( function ( out ) {
			logoImg = out[ 1 ];
		} );
	}

	function preview() {
		var ids = ticked();
		var id = ids.length ? ids[ 0 ] : parseInt( ( rows().filter( function ( tr ) {
			return ! tr.hidden;
		} )[ 0 ] || { getAttribute: function () {
			return '0';
		} } ).getAttribute( 'data-id' ), 10 );
		if ( posts[ id ] ) {
			window.WPlusThumb.render( canvas, optionsFor( posts[ id ] ) );
		}
		var count = ids.length;
		$( 'wpb-count' ).textContent = count + ' / ' + rows().filter( function ( tr ) {
			return ! tr.hidden;
		} ).length;
		$( 'wpb-start' ).disabled = running || ! count;
	}

	function renderPresets() {
		var sel = $( 'wpb-preset' );
		sel.innerHTML = '';
		var none = document.createElement( 'option' );
		none.value = '';
		none.textContent = cfg.i18n.custom;
		sel.appendChild( none );
		presets.items.forEach( function ( p ) {
			var opt = document.createElement( 'option' );
			opt.value = p.id;
			opt.textContent = p.name + ( p.id === presets[ 'default' ] ? ' ' + cfg.i18n.defaultTag : '' );
			sel.appendChild( opt );
		} );
	}

	$( 'wpb-preset' ).addEventListener( 'change', function () {
		var p = presets.items.filter( function ( x ) {
			return x.id === $( 'wpb-preset' ).value;
		} )[ 0 ];
		design = p ? Object.assign( {}, cfg.defaults, p.settings ) : Object.assign( {}, cfg.defaults, C.readSaved() );
		prepare().then( preview );
	} );

	$( 'wpb-status' ).addEventListener( 'change', function () {
		var want = $( 'wpb-status' ).value;
		rows().forEach( function ( tr ) {
			tr.hidden = !! want && tr.getAttribute( 'data-status' ) !== want;
			if ( tr.hidden ) {
				tr.querySelector( '.wpb-pick' ).checked = false;
			}
		} );
		$( 'wpb-all' ).checked = false;
		preview();
	} );

	$( 'wpb-all' ).addEventListener( 'change', function () {
		var on = $( 'wpb-all' ).checked;
		rows().forEach( function ( tr ) {
			var box = tr.querySelector( '.wpb-pick' );
			if ( ! tr.hidden && box && ! box.disabled ) {
				box.checked = on;
			}
		} );
		preview();
	} );

	document.querySelector( '.wpa-bulk-table tbody' ).addEventListener( 'change', preview );

	/* One post: skip it if it got a featured image meanwhile, else make, save and set the picture. */
	function processPost( id ) {
		var post = posts[ id ];
		if ( ! post.title.trim() ) {
			result( id, cfg.i18n.noTitle );
			return Promise.resolve();
		}
		result( id, cfg.i18n.working );
		return window.wp.apiFetch( { path: '/wp/v2/posts/' + id + '?context=edit&_fields=id,featured_media' } ).then( function ( current ) {
			if ( current.featured_media ) {
				result( id, cfg.i18n.skipped );
				return null;
			}
			var off = document.createElement( 'canvas' );
			window.WPlusThumb.render( off, optionsFor( post ) );
			return C.toBlob( off, 'png' === design.format ).then( function ( pic ) {
				if ( ! pic ) {
					throw new Error( 'picture' );
				}
				var form = new window.FormData();
				form.append( 'file', pic.blob, C.slug( post.title ) + '-thumbnail.' + pic.ext );
				form.append( 'title', post.title );
				form.append( 'alt_text', post.title );
				form.append( 'description', post.description );
				form.append( 'post', String( id ) );
				return window.wp.apiFetch( { path: '/wp/v2/media', method: 'POST', body: form } ).then( function ( media ) {
					return window.wp.apiFetch( { path: '/wp/v2/posts/' + id, method: 'POST', data: { featured_media: media.id } } ).then( function () {
						result( id, cfg.i18n.done + ( pic.fallback ? ' (PNG)' : '' ), '#' + media.id );
						var box = document.querySelector( 'tr[data-id="' + id + '"] .wpb-pick' );
						if ( box ) {
							box.checked = false;
							box.disabled = true;
						}
					}, function ( err ) {
						window.wp.apiFetch( { path: '/wp/v2/media/' + media.id + '?force=true', method: 'DELETE' } ).catch( function () {} );
						throw err;
					} );
				} );
			} );
		} ).catch( function ( err ) {
			result( id, cfg.i18n.failed + ' ' + ( err && err.message ? err.message : '' ) );
		} );
	}

	function run() {
		var ids = ticked();
		if ( ! ids.length ) {
			say( cfg.i18n.none );
			return;
		}
		if ( ! window.confirm( cfg.i18n.confirm ) ) {
			return;
		}
		running = true;
		stopRequested = false;
		$( 'wpb-start' ).disabled = true;
		$( 'wpb-stop' ).hidden = false;
		$( 'wpb-preset' ).disabled = true;
		$( 'wpb-progress' ).hidden = false;
		$( 'wpb-progress' ).max = ids.length;
		$( 'wpb-progress' ).value = 0;
		var done = 0;
		var chain = prepare();
		ids.forEach( function ( id ) {
			chain = chain.then( function () {
				if ( stopRequested ) {
					return null;
				}
				return processPost( id ).then( function () {
					done++;
					$( 'wpb-progress' ).value = done;
					say( done + ' / ' + ids.length + ' ' + cfg.i18n.progress );
				} );
			} );
		} );
		chain.then( function () {
			running = false;
			$( 'wpb-stop' ).hidden = true;
			$( 'wpb-preset' ).disabled = false;
			say( stopRequested ? cfg.i18n.stopped : cfg.i18n.finished );
			preview();
		} );
	}

	$( 'wpb-start' ).addEventListener( 'click', run );
	$( 'wpb-stop' ).addEventListener( 'click', function () {
		stopRequested = true;
		$( 'wpb-stop' ).disabled = true;
	} );

	renderPresets();
	prepare().then( preview );
}() );
