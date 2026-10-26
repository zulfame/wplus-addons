/*
 * WPlus Addons: thumbnail renderer.
 * Draws a cover picture on a canvas from plain options. No network, no libraries: the same function is used by the
 * admin page now and by the editor panel later.
 *
 * WPlusThumb.render( canvas, options ) options:
 *   layout 'minimal' | 'dots' | 'panel', align 'left' | 'center' | 'right', mode 'light' | 'dark', accent '#rrggbb',
 *   width, height, title, description, org, logo (loaded Image or null), tag1, tag2, font (CSS font stack).
 */
( function ( global ) {
	'use strict';

	var TAG_ICON = 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z';

	function hexToRgb( hex ) {
		var h = String( hex || '' ).replace( '#', '' );
		if ( 3 === h.length ) {
			h = h.charAt( 0 ) + h.charAt( 0 ) + h.charAt( 1 ) + h.charAt( 1 ) + h.charAt( 2 ) + h.charAt( 2 );
		}
		if ( ! /^[0-9a-f]{6}$/i.test( h ) ) {
			h = '2563eb';
		}
		return [ parseInt( h.slice( 0, 2 ), 16 ), parseInt( h.slice( 2, 4 ), 16 ), parseInt( h.slice( 4, 6 ), 16 ) ];
	}

	function rgba( c, a ) {
		return 'rgba(' + c[ 0 ] + ',' + c[ 1 ] + ',' + c[ 2 ] + ',' + a + ')';
	}

	function mix( a, b, t ) {
		return [ Math.round( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t ), Math.round( a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t ), Math.round( a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t ) ];
	}

	function rgb( c ) {
		return 'rgb(' + c[ 0 ] + ',' + c[ 1 ] + ',' + c[ 2 ] + ')';
	}

	/* Split text into lines that fit maxW; a word wider than the line is broken. */
	function wrap( ctx, text, maxW ) {
		var words = String( text || '' ).replace( /\s+/g, ' ' ).trim().split( ' ' );
		var lines = [];
		var line = '';
		words.forEach( function ( word ) {
			if ( '' === word ) {
				return;
			}
			var test = line ? line + ' ' + word : word;
			if ( ctx.measureText( test ).width <= maxW ) {
				line = test;
				return;
			}
			if ( line ) {
				lines.push( line );
				line = '';
			}
			while ( ctx.measureText( word ).width > maxW && word.length > 1 ) {
				var cut = word.length - 1;
				while ( cut > 1 && ctx.measureText( word.slice( 0, cut ) ).width > maxW ) {
					cut--;
				}
				lines.push( word.slice( 0, cut ) );
				word = word.slice( cut );
			}
			line = word;
		} );
		if ( line ) {
			lines.push( line );
		}
		return lines;
	}

	/* Largest font size (from max down to min) that fits maxLines; at the smallest size the text is cut with an ellipsis. */
	function fit( ctx, text, fontOf, maxW, maxLines, max, min, step ) {
		var size, lines;
		for ( size = max; size >= min; size -= step ) {
			ctx.font = fontOf( size );
			lines = wrap( ctx, text, maxW );
			if ( lines.length <= maxLines ) {
				return { size: size, lines: lines };
			}
		}
		size = min;
		ctx.font = fontOf( size );
		lines = wrap( ctx, text, maxW );
		if ( lines.length > maxLines ) {
			var last = lines.slice( maxLines - 1 ).join( ' ' );
			while ( last.length > 1 && ctx.measureText( last + '…' ).width > maxW ) {
				last = last.slice( 0, -1 );
			}
			lines = lines.slice( 0, maxLines - 1 );
			lines.push( last.replace( /\s+$/, '' ) + '…' );
		}
		return { size: size, lines: lines };
	}

	/*
	 * Choose the title size (and description) so the whole text block fits in availH: the title shrinks first,
	 * down to its smallest size, then it is cut with an ellipsis.
	 * cfg: tMax, tMin, tLines, lh (title line height), dMax, dMin, dLines, head (height above the title), dGap.
	 */
	function compose( ctx, o, u, maxW, availH, cfg ) {
		var titleFont = function ( s ) {
			return '700 ' + s * u + 'px ' + o.font;
		};
		var desc = o.description ? fit( ctx, o.description, function ( s ) {
			return '400 ' + s * u + 'px ' + o.font;
		}, maxW, cfg.dLines, cfg.dMax, cfg.dMin, 2 ) : { size: 0, lines: [] };
		var descLH = desc.size * u * 1.45;
		var descH = desc.lines.length ? cfg.dGap * u + desc.lines.length * descLH : 0;
		var title = null;
		for ( var ts = cfg.tMax; ts >= cfg.tMin; ts -= 2 ) {
			ctx.font = titleFont( ts );
			var lines = wrap( ctx, o.title, maxW );
			if ( lines.length <= cfg.tLines && cfg.head * u + lines.length * ts * u * cfg.lh + descH <= availH ) {
				title = { size: ts, lines: lines };
				break;
			}
		}
		if ( ! title ) {
			title = fit( ctx, o.title, titleFont, maxW, cfg.tLines, cfg.tMin, cfg.tMin, 2 );
		}
		var titleLH = title.size * u * cfg.lh;
		return {
			title: title,
			desc: desc,
			titleLH: titleLH,
			descLH: descLH,
			height: cfg.head * u + title.lines.length * titleLH + descH,
		};
	}

	/* Cut text with an ellipsis so it is not wider than maxW. */
	function ellipsize( ctx, text, maxW ) {
		var t = String( text || '' );
		if ( ctx.measureText( t ).width <= maxW ) {
			return t;
		}
		while ( t.length > 1 && ctx.measureText( t + '\u2026' ).width > maxW ) {
			t = t.slice( 0, -1 );
		}
		return t.replace( /\s+$/, '' ) + '\u2026';
	}

	function roundRect( ctx, x, y, w, h, r ) {
		r = Math.min( r, w / 2, h / 2 );
		ctx.beginPath();
		ctx.moveTo( x + r, y );
		ctx.arcTo( x + w, y, x + w, y + h, r );
		ctx.arcTo( x + w, y + h, x, y + h, r );
		ctx.arcTo( x, y + h, x, y, r );
		ctx.arcTo( x, y, x + w, y, r );
		ctx.closePath();
	}

	function anchorX( align, left, right, width ) {
		if ( 'center' === align ) {
			return ( left + right ) / 2 - width / 2;
		}
		return 'right' === align ? right - width : left;
	}

	function tagText( o ) {
		return [ o.tag1, o.tag2 ].map( function ( t ) {
			return String( t || '' ).trim();
		} ).filter( Boolean ).join( '  /  ' );
	}

	function drawTagIcon( ctx, x, y, size, color, lw ) {
		ctx.save();
		ctx.translate( x, y );
		ctx.scale( size / 24, size / 24 );
		ctx.strokeStyle = color;
		ctx.lineWidth = lw * 24 / size;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke( new Path2D( TAG_ICON ) );
		ctx.beginPath();
		ctx.arc( 7, 7, 1.2, 0, Math.PI * 2 );
		ctx.fillStyle = color;
		ctx.fill();
		ctx.restore();
	}

	/* Logo and organisation name in one row; returns its width and height. Drawn only when asked. */
	function brandRow( ctx, o, u, x, cy, draw, limit ) {
		var box = 52 * u;
		var gap = 16 * u;
		var name = String( o.org || '' ).trim();
		ctx.font = '700 ' + 28 * u + 'px ' + o.font;
		var logoW = o.logo ? box : 0;
		if ( name && limit ) {
			name = ellipsize( ctx, name, Math.max( 40 * u, limit - logoW - ( logoW ? gap : 0 ) ) );
		}
		var textW = name ? ctx.measureText( name ).width : 0;
		var width = logoW + ( logoW && textW ? gap : 0 ) + textW;
		if ( draw ) {
			var px = x;
			if ( o.logo ) {
				var iw = o.logo.naturalWidth || box;
				var ih = o.logo.naturalHeight || box;
				var s = Math.min( box / iw, box / ih );
				ctx.save();
				roundRect( ctx, px, cy - box / 2, box, box, 12 * u );
				ctx.clip();
				ctx.drawImage( o.logo, px + ( box - iw * s ) / 2, cy - ih * s / 2, iw * s, ih * s );
				ctx.restore();
				px += box + gap;
			}
			if ( name ) {
				ctx.fillStyle = o.ink;
				ctx.textBaseline = 'middle';
				ctx.textAlign = 'left';
				ctx.font = '700 ' + 28 * u + 'px ' + o.font;
				ctx.fillText( name, px, cy + 1 * u );
			}
		}
		return { width: width, height: o.logo ? box : 28 * u, empty: ! logoW && ! name };
	}

	function palette( o ) {
		var accent = hexToRgb( o.accent );
		var dark = 'dark' === o.mode;
		return {
			accent: accent,
			bg: dark ? [ 15, 18, 28 ] : [ 255, 255, 255 ],
			ink: dark ? '#f4f6fb' : '#10142a',
			muted: dark ? '#a8b0c6' : '#4b5563',
			line: dark ? 'rgba(255,255,255,0.12)' : 'rgba(16,20,42,0.12)',
		};
	}

	/*
	 * Dots made from a ring in 3D, tilted and partly outside the corner: the "Dots" layout background.
	 * Far dots are small and faint, near dots larger and darker.
	 */
	function drawMesh( ctx, o, p, u, flip ) {
		var W = o.width;
		var dark = 'dark' === o.mode;
		var cx = flip ? 70 * u : W - 70 * u, cy = 50 * u, R = 200 * u, r = 86 * u;
		var ax = 1.05, ay = 0.55;
		var cax = Math.cos( ax ), sax = Math.sin( ax ), cay = Math.cos( ay ), say = Math.sin( ay );
		var pts = [];
		var NU = 170, NV = 56, i, j;
		for ( i = 0; i < NU; i++ ) {
			var th = i / NU * Math.PI * 2;
			for ( j = 0; j < NV; j++ ) {
				var ph = j / NV * Math.PI * 2;
				var x = ( R + r * Math.cos( ph ) ) * Math.cos( th );
				var y = ( R + r * Math.cos( ph ) ) * Math.sin( th );
				var z = r * Math.sin( ph );
				var y1 = y * cax - z * sax, z1 = y * sax + z * cax;
				var x2 = x * cay + z1 * say, z2 = -x * say + z1 * cay;
				var persp = 900 * u / ( 900 * u - z2 );
				pts.push( [ flip ? 2 * cx - ( cx + x2 * persp ) : cx + x2 * persp, cy + y1 * persp, z2 / ( R + r ) ] );
			}
		}
		pts.sort( function ( m, n ) {
			return m[ 2 ] - n[ 2 ];
		} );
		var ink = dark ? [ 205, 214, 235 ] : [ 38, 48, 68 ];
		pts.forEach( function ( q ) {
			if ( q[ 0 ] < -10 || q[ 0 ] > W + 10 || q[ 1 ] < -10 || q[ 1 ] > o.height + 10 ) {
				return;
			}
			var depth = ( q[ 2 ] + 1 ) / 2;
			ctx.fillStyle = rgba( ink, 0.18 + 0.7 * depth );
			ctx.beginPath();
			ctx.arc( q[ 0 ], q[ 1 ], ( 0.9 + 1.5 * depth ) * u, 0, Math.PI * 2 );
			ctx.fill();
		} );
	}

	/*
	 * Layouts "minimal" (a thin frame; text sits on the frame lines) and "dots" (a 3D dotted ring in the corner):
	 * a soft tint of the accent colour, brand on top, tags, title and description below.
	 */
	function layoutMinimal( ctx, o, p, u, variant ) {
		var W = o.width, H = o.height;
		var dark = 'dark' === o.mode;
		var framed = 'dots' !== variant;
		var left = framed ? W * 0.075 : 72 * u;
		var right = W - left;
		var topY = framed ? H * 0.134 + 14 * u : 72 * u;
		var bottomY = framed ? H - H * 0.134 - 14 * u : H - 72 * u;
		ctx.fillStyle = rgb( mix( p.bg, p.accent, dark ? 0.1 : 0.07 ) );
		ctx.fillRect( 0, 0, W, H );
		var flip = ! framed && 'right' === o.align; // the ring moves to the left when the text is right-aligned
		var gx = flip ? right - 52 * u : left + 52 * u, gy = topY + 26 * u;
		var glow = ctx.createRadialGradient( gx, gy, 0, gx, gy, 280 * u );
		glow.addColorStop( 0, rgba( p.accent, dark ? 0.3 : 0.2 ) );
		glow.addColorStop( 1, rgba( p.accent, 0 ) );
		ctx.fillStyle = glow;
		ctx.fillRect( 0, 0, W, H );
		if ( framed ) {
			ctx.strokeStyle = rgba( p.accent, dark ? 0.22 : 0.13 );
			ctx.lineWidth = 1.5 * u;
			[ left, right ].forEach( function ( x ) {
				ctx.beginPath();
				ctx.moveTo( x, 0 );
				ctx.lineTo( x, H );
				ctx.stroke();
			} );
			[ H * 0.134, H - H * 0.134 ].forEach( function ( y ) {
				ctx.beginPath();
				ctx.moveTo( 0, y );
				ctx.lineTo( W, y );
				ctx.stroke();
			} );
		} else {
			drawMesh( ctx, o, p, u, flip );
		}

		var maxW = framed ? right - left : Math.min( right - left, Math.round( W * 0.68 ) ); // text stays clear of the ring
		var brandH = brandRow( ctx, o, u, 0, 0, false, maxW );
		var brandX = anchorX( o.align, left, right, brandH.width );
		if ( ! brandH.empty ) {
			brandRow( ctx, o, u, brandX, topY + brandH.height / 2, true, maxW );
		}

		var tags = tagText( o );
		var tagH = tags ? 26 * u : 0;
		var top = topY + ( brandH.empty ? 0 : brandH.height + 28 * u );
		var avail = bottomY - top;
		var c = compose( ctx, o, u, maxW, avail, { tMax: 76, tMin: 40, tLines: 3, lh: 1.14, dMax: 28, dMin: 22, dLines: 2, head: tags ? 50 : 0, dGap: 18 } );
		var title = c.title, desc = c.desc, titleLH = c.titleLH, descLH = c.descLH;
		var y = top + Math.max( 0, avail - c.height ) * 0.62;

		ctx.textBaseline = 'top';
		if ( tags ) {
			ctx.font = '400 ' + 24 * u + 'px ' + o.font;
			tags = ellipsize( ctx, tags, maxW - 36 * u );
			var tw = ctx.measureText( tags ).width + 36 * u;
			var tx = anchorX( o.align, left, right, tw );
			drawTagIcon( ctx, tx, y + 1 * u, 24 * u, o.muted, 2 * u );
			ctx.fillStyle = o.muted;
			ctx.textAlign = 'left';
			ctx.fillText( tags, tx + 36 * u, y );
			y += tagH + 24 * u;
		}
		ctx.fillStyle = o.ink;
		ctx.font = '700 ' + title.size * u + 'px ' + o.font;
		title.lines.forEach( function ( line ) {
			ctx.textAlign = o.align;
			ctx.fillText( line, 'center' === o.align ? W / 2 : ( 'right' === o.align ? right : left ), y );
			y += titleLH;
		} );
		if ( desc.lines.length ) {
			y += 18 * u;
			ctx.fillStyle = o.muted;
			ctx.font = '400 ' + desc.size * u + 'px ' + o.font;
			desc.lines.forEach( function ( line ) {
				ctx.textAlign = o.align;
				ctx.fillText( line, 'center' === o.align ? W / 2 : ( 'right' === o.align ? right : left ), y );
				y += descLH;
			} );
		}
	}

	/* Layout "panel": plain background, a dot pattern in the corner, an accent bar, brand and tags in a footer. */
	function layoutPanel( ctx, o, p, u ) {
		var W = o.width, H = o.height, pad = 72 * u;
		ctx.fillStyle = rgb( p.bg );
		ctx.fillRect( 0, 0, W, H );
		var gap = 26 * u, reach = 470 * u;
		for ( var gx = W - gap / 2; gx > W - reach; gx -= gap ) {
			for ( var gy = gap / 2; gy < reach; gy += gap ) {
				var d = Math.hypot( W - gx, gy );
				var a = 1 - d / reach;
				if ( a > 0 ) {
					ctx.fillStyle = rgba( p.accent, Math.min( 0.55, a * 0.7 ) );
					ctx.beginPath();
					ctx.arc( gx, gy, 3.2 * u, 0, Math.PI * 2 );
					ctx.fill();
				}
			}
		}
		var left = pad, right = W - pad, maxW = right - left;
		var footerH = 52 * u, footerY = H - pad - footerH;
		var hasFooter = !! ( String( o.org || '' ).trim() || o.logo || tagText( o ) );
		if ( hasFooter ) {
			ctx.fillStyle = p.line;
			ctx.fillRect( left, footerY - 28 * u, maxW, 2 * u );
		}

		var barH = 10 * u;
		var avail = hasFooter ? footerY - 56 * u - pad : H - pad * 2;
		var c = compose( ctx, o, u, maxW * 0.92, avail, { tMax: 84, tMin: 40, tLines: 3, lh: 1.12, dMax: 30, dMin: 22, dLines: 2, head: 40, dGap: 20 } );
		var title = c.title, desc = c.desc, titleLH = c.titleLH, descLH = c.descLH;
		var y = pad + Math.max( 0, avail - c.height ) * 0.5;
		var bx = anchorX( o.align, left, right, 84 * u );
		ctx.fillStyle = rgb( p.accent );
		roundRect( ctx, bx, y, 84 * u, barH, barH / 2 );
		ctx.fill();
		y += barH + 30 * u;
		var tx = 'center' === o.align ? W / 2 : ( 'right' === o.align ? right : left );
		ctx.textBaseline = 'top';
		ctx.textAlign = o.align;
		ctx.fillStyle = o.ink;
		ctx.font = '700 ' + title.size * u + 'px ' + o.font;
		title.lines.forEach( function ( line ) {
			ctx.fillText( line, tx, y );
			y += titleLH;
		} );
		if ( desc.lines.length ) {
			y += 20 * u;
			ctx.fillStyle = o.muted;
			ctx.font = '400 ' + desc.size * u + 'px ' + o.font;
			desc.lines.forEach( function ( line ) {
				ctx.fillText( line, tx, y );
				y += descLH;
			} );
		}

		/* footer: brand on the left, tags as outlined pills on the right (nothing is drawn when both are empty) */
		var cy = footerY + footerH / 2;
		var tagList = [ o.tag1, o.tag2 ].map( function ( t ) {
			return String( t || '' ).trim();
		} ).filter( Boolean );
		var brand = brandRow( ctx, o, u, left, cy, false, tagList.length ? maxW * 0.45 : maxW );
		brandRow( ctx, o, u, left, cy, true, tagList.length ? maxW * 0.45 : maxW );
		var px = right;
		var room = maxW - ( brand.empty ? 0 : brand.width + 32 * u );
		var each = ( room - 12 * u * ( tagList.length - 1 ) ) / Math.max( 1, tagList.length );
		ctx.font = '400 ' + 22 * u + 'px ' + o.font;
		tagList.slice().reverse().forEach( function ( t ) {
			t = ellipsize( ctx, t, Math.max( 30 * u, each - 32 * u ) );
			var w = ctx.measureText( t ).width + 32 * u, h = 42 * u;
			px -= w;
			ctx.strokeStyle = rgba( p.accent, 0.7 );
			ctx.lineWidth = 2 * u;
			roundRect( ctx, px, cy - h / 2, w, h, h / 2 );
			ctx.stroke();
			ctx.fillStyle = o.ink;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillText( t, px + 16 * u, cy + 1 * u );
			px -= 12 * u;
		} );
	}

	function render( canvas, options ) {
		var o = options || {};
		o.width = Math.max( 200, Math.min( 4000, parseInt( o.width, 10 ) || 1200 ) );
		o.height = Math.max( 200, Math.min( 4000, parseInt( o.height, 10 ) || 630 ) );
		o.align = [ 'left', 'center', 'right' ].indexOf( o.align ) >= 0 ? o.align : 'left';
		o.font = o.font || 'system-ui, -apple-system, "Segoe UI", sans-serif';
		o.title = String( o.title || '' ).trim() || ' ';
		canvas.width = o.width;
		canvas.height = o.height;
		var ctx = canvas.getContext( '2d' );
		var p = palette( o );
		o.ink = p.ink;
		o.muted = p.muted;
		var u = Math.min( o.width / 1200, o.height / 630 );
		ctx.clearRect( 0, 0, o.width, o.height );
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		if ( 'panel' === o.layout ) {
			layoutPanel( ctx, o, p, u );
		} else {
			layoutMinimal( ctx, o, p, u, o.layout );
		}
	}

	global.WPlusThumb = { render: render };
}( window ) );
