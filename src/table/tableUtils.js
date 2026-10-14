/**
 * Pure grid helpers for the table block (no WordPress imports, so they can be
 * unit-tested in Node: see tools/tests/tableUtils.test.mjs).
 *
 * Data model: `cells` is a full rectangular grid, cells[row][col]. Every grid
 * position has an entry:
 *  - an "origin" cell: { content, colspan?, rowspan?, ...style }
 *  - a cell covered by a merge: { hidden: true }
 * colspan/rowspan are omitted when 1. Style keys are listed in STYLE_KEYS.
 *
 * All functions return new arrays and never mutate their input.
 */

/** Per-cell formatting keys (copied to new rows/columns, cleared by "clear formatting"). */
export const STYLE_KEYS = [
	'bg', 'bgSlug', 'color', 'colorSlug', 'align', 'valign', 'fontSize', 'fontSizeSlug',
	'fontFamily', 'fontFamilySlug', 'bold',
];

export const key = ( r, c ) => `${ r }-${ c }`;
export const parseKey = ( k ) => k.split( '-' ).map( Number );

const clone = ( cells ) => cells.map( ( row ) => row.map( ( cell ) => ( { ...cell } ) ) );

export function spanOf( cell ) {
	return { rs: cell?.rowspan || 1, cs: cell?.colspan || 1 };
}

export function dims( cells ) {
	return { rows: cells.length, cols: cells[ 0 ]?.length || 0 };
}

/** Copy only the formatting of a cell (used for new rows/columns and split cells). */
export function pickStyle( cell ) {
	const out = {};
	if ( ! cell ) return out;
	for ( const k of STYLE_KEYS ) {
		if ( cell[ k ] !== undefined ) out[ k ] = cell[ k ];
	}
	return out;
}

export function createGrid( rows, cols ) {
	return Array.from( { length: rows }, () => Array.from( { length: cols }, () => ( { content: '' } ) ) );
}

/** Position [r, c] of the origin cell covering grid position (r, c). */
export function findOrigin( cells, r, c ) {
	if ( ! cells[ r ]?.[ c ]?.hidden ) return [ r, c ];
	for ( let or = r; or >= 0; or-- ) {
		for ( let oc = c; oc >= 0; oc-- ) {
			const cell = cells[ or ][ oc ];
			if ( cell.hidden ) continue;
			const { rs, cs } = spanOf( cell );
			if ( or + rs > r && oc + cs > c ) return [ or, oc ];
		}
	}
	return [ r, c ];
}

export function normalizeRect( { r1, c1, r2, c2 } ) {
	return {
		r1: Math.min( r1, r2 ), r2: Math.max( r1, r2 ),
		c1: Math.min( c1, c2 ), c2: Math.max( c1, c2 ),
	};
}

/** Grow a rectangle until no merged cell crosses its edge (needed for merging). */
export function expandRect( cells, rect ) {
	let { r1, c1, r2, c2 } = normalizeRect( rect );
	let changed = true;
	while ( changed ) {
		changed = false;
		for ( let r = r1; r <= r2; r++ ) {
			for ( let c = c1; c <= c2; c++ ) {
				const [ or, oc ] = findOrigin( cells, r, c );
				const { rs, cs } = spanOf( cells[ or ][ oc ] );
				const nr1 = Math.min( r1, or ), nc1 = Math.min( c1, oc );
				const nr2 = Math.max( r2, or + rs - 1 ), nc2 = Math.max( c2, oc + cs - 1 );
				if ( nr1 !== r1 || nc1 !== c1 || nr2 !== r2 || nc2 !== c2 ) {
					( { r1, c1, r2, c2 } = { r1: nr1, c1: nc1, r2: nr2, c2: nc2 } );
					changed = true;
				}
			}
		}
	}
	return { r1, c1, r2, c2 };
}

/** Unique origin keys of every grid position inside the rectangle (reading order). */
export function originsInRect( cells, rect ) {
	const { r1, c1, r2, c2 } = normalizeRect( rect );
	const seen = new Set();
	const out  = [];
	for ( let r = r1; r <= r2; r++ ) {
		for ( let c = c1; c <= c2; c++ ) {
			const k = key( ...findOrigin( cells, r, c ) );
			if ( ! seen.has( k ) ) {
				seen.add( k );
				out.push( k );
			}
		}
	}
	return out;
}

/** Bounding rectangle (including spans) of a list of origin keys. */
export function boundsOfKeys( cells, keys ) {
	let r1 = Infinity, c1 = Infinity, r2 = -1, c2 = -1;
	for ( const k of keys ) {
		const [ r, c ] = parseKey( k );
		if ( ! cells[ r ]?.[ c ] ) continue;
		const { rs, cs } = spanOf( cells[ r ][ c ] );
		r1 = Math.min( r1, r ); c1 = Math.min( c1, c );
		r2 = Math.max( r2, r + rs - 1 ); c2 = Math.max( c2, c + cs - 1 );
	}
	return r2 < 0 ? null : { r1, c1, r2, c2 };
}

/**
 * Insert an empty row before `index` (0..rows). New cells copy the formatting
 * of row `refRow`. Merged cells crossing the insertion line grow by one row.
 */
export function insertRow( cells, index, refRow = Math.min( index, cells.length - 1 ) ) {
	const next     = clone( cells );
	const { cols } = dims( cells );
	const grown    = new Set();
	const row      = [];
	for ( let c = 0; c < cols; c++ ) {
		if ( index > 0 && index < cells.length ) {
			const [ or, oc ] = findOrigin( cells, index, c );
			if ( or < index ) {
				// A merged cell spans across the new row: extend it instead.
				if ( ! grown.has( key( or, oc ) ) ) {
					grown.add( key( or, oc ) );
					next[ or ][ oc ].rowspan = spanOf( cells[ or ][ oc ] ).rs + 1;
				}
				row.push( { hidden: true } );
				continue;
			}
		}
		let src = null;
		if ( refRow >= 0 && cells[ refRow ] ) {
			const [ rr, rc ] = findOrigin( cells, refRow, c );
			src = cells[ rr ][ rc ];
		}
		row.push( { content: '', ...pickStyle( src ) } );
	}
	next.splice( index, 0, row );
	return next;
}

/** Delete row `index`. Merged cells starting there move down; ones crossing it shrink. */
export function deleteRow( cells, index ) {
	if ( cells.length <= 1 ) return cells;
	const next     = clone( cells );
	const { cols } = dims( cells );
	const shrunk   = new Set();
	for ( let c = 0; c < cols; c++ ) {
		const cell = cells[ index ][ c ];
		if ( ! cell.hidden ) {
			const { rs } = spanOf( cell );
			if ( rs > 1 ) {
				// Keep the merged cell (and its content) by moving it to the next row.
				const moved = { ...cell, rowspan: rs - 1 };
				if ( moved.rowspan === 1 ) delete moved.rowspan;
				next[ index + 1 ][ c ] = moved;
			}
		} else {
			const [ or, oc ] = findOrigin( cells, index, c );
			if ( or < index && ! shrunk.has( key( or, oc ) ) ) {
				shrunk.add( key( or, oc ) );
				const rs = spanOf( cells[ or ][ oc ] ).rs - 1;
				if ( rs > 1 ) next[ or ][ oc ].rowspan = rs;
				else delete next[ or ][ oc ].rowspan;
			}
		}
	}
	next.splice( index, 1 );
	return next;
}

/** Swap rows/columns (and colspan/rowspan) so column ops can reuse the row ops. */
export function transpose( cells ) {
	const { rows, cols } = dims( cells );
	return Array.from( { length: cols }, ( _, c ) => Array.from( { length: rows }, ( __, r ) => {
		const cell = { ...cells[ r ][ c ] };
		const { rs, cs } = spanOf( cell );
		delete cell.rowspan;
		delete cell.colspan;
		if ( cs > 1 ) cell.rowspan = cs;
		if ( rs > 1 ) cell.colspan = rs;
		return cell;
	} ) );
}

export const insertColumn = ( cells, index, refCol ) =>
	transpose( insertRow( transpose( cells ), index, refCol ?? Math.min( index, dims( cells ).cols - 1 ) ) );

export const deleteColumn = ( cells, index ) =>
	dims( cells ).cols <= 1 ? cells : transpose( deleteRow( transpose( cells ), index ) );

const isEmptyHtml = ( html ) => ! String( html ?? '' ).replace( /<br\s*\/?>|&nbsp;|\s/gi, '' );

/**
 * Merge every cell in the rectangle (expanded so no merge crosses its edge)
 * into the top-left cell. Non-empty contents are kept, joined by line breaks.
 */
export function mergeCells( cells, rect ) {
	const { r1, c1, r2, c2 } = expandRect( cells, rect );
	if ( r1 === r2 && c1 === c2 ) return cells;
	const next     = clone( cells );
	const contents = originsInRect( cells, { r1, c1, r2, c2 } )
		.map( ( k ) => cells[ parseKey( k )[ 0 ] ][ parseKey( k )[ 1 ] ].content )
		.filter( ( html ) => ! isEmptyHtml( html ) );
	for ( let r = r1; r <= r2; r++ ) {
		for ( let c = c1; c <= c2; c++ ) next[ r ][ c ] = { hidden: true };
	}
	const origin = { ...cells[ r1 ][ c1 ], content: contents.join( '<br>' ) };
	delete origin.rowspan;
	delete origin.colspan;
	if ( r2 > r1 ) origin.rowspan = r2 - r1 + 1;
	if ( c2 > c1 ) origin.colspan = c2 - c1 + 1;
	next[ r1 ][ c1 ] = origin;
	return next;
}

/** Undo a merge: the origin keeps its content; uncovered cells get its formatting. */
export function splitCell( cells, r, c ) {
	const [ or, oc ] = findOrigin( cells, r, c );
	const origin     = cells[ or ][ oc ];
	const { rs, cs } = spanOf( origin );
	if ( rs === 1 && cs === 1 ) return cells;
	const next = clone( cells );
	for ( let rr = or; rr < or + rs; rr++ ) {
		for ( let cc = oc; cc < oc + cs; cc++ ) {
			next[ rr ][ cc ] = { content: '', ...pickStyle( origin ) };
		}
	}
	const kept = { ...origin };
	delete kept.rowspan;
	delete kept.colspan;
	next[ or ][ oc ] = kept;
	return next;
}

/** Apply a style/content patch to the given origin cells. `undefined` values remove keys. */
export function updateCells( cells, keys, patch ) {
	const next = clone( cells );
	for ( const k of keys ) {
		const [ r, c ] = parseKey( k );
		if ( ! next[ r ]?.[ c ] || next[ r ][ c ].hidden ) continue;
		const cell = { ...next[ r ][ c ], ...patch };
		for ( const [ p, v ] of Object.entries( patch ) ) {
			if ( v === undefined || v === '' || v === false ) delete cell[ p ];
		}
		if ( cell.content === undefined ) cell.content = '';
		next[ r ][ c ] = cell;
	}
	return next;
}

/** Remove all STYLE_KEYS from the given cells. */
export function clearFormatting( cells, keys ) {
	return updateCells( cells, keys, Object.fromEntries( STYLE_KEYS.map( ( k ) => [ k, undefined ] ) ) );
}

/**
 * Number of rows that make up the header section. Usually 1, but if a header
 * cell is merged downwards the header grows to include those rows, so <thead>
 * never splits a merged cell.
 */
export function getHeaderRowCount( cells ) {
	if ( ! cells.length ) return 0;
	let n = 1;
	let changed = true;
	while ( changed && n < cells.length ) {
		changed = false;
		for ( let r = 0; r < n; r++ ) {
			for ( const cell of cells[ r ] ) {
				if ( cell.hidden ) continue;
				const end = r + spanOf( cell ).rs;
				if ( end > n ) {
					n = Math.min( end, cells.length );
					changed = true;
				}
			}
		}
	}
	return n;
}

export function stripTags( html ) {
	return String( html ?? '' )
		.replace( /<br\s*\/?>/gi, ' ' )
		.replace( /<[^>]*>/g, '' )
		.replace( /&nbsp;/g, ' ' )
		.replace( /&amp;/g, '&' )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#0?39;/g, "'" )
		.replace( /\s+/g, ' ' )
		.trim();
}

/** Plain-text label for each column, from the first row (used by the mobile "stack" layout). */
export function getColumnLabels( cells ) {
	const { cols } = dims( cells );
	return Array.from( { length: cols }, ( _, c ) => {
		const [ or, oc ] = findOrigin( cells, 0, c );
		return stripTags( cells[ or ][ oc ].content );
	} );
}

// ── Keyboard navigation ──────────────────────────────────────────────────────

/**
 * Origin cell reached by moving one step from origin (r, c) in a direction
 * ('up' | 'down' | 'left' | 'right'), skipping over merged areas.
 * Returns null at the table edge.
 */
export function neighbourCell( cells, r, c, direction ) {
	const { rows, cols } = dims( cells );
	const { rs, cs }     = spanOf( cells[ r ]?.[ c ] );
	let nr = r, nc = c;
	if ( direction === 'up' ) nr = r - 1;
	if ( direction === 'down' ) nr = r + rs;
	if ( direction === 'left' ) nc = c - 1;
	if ( direction === 'right' ) nc = c + cs;
	if ( nr < 0 || nc < 0 || nr >= rows || nc >= cols ) return null;
	return findOrigin( cells, nr, nc );
}

// ── Pasting from spreadsheets ────────────────────────────────────────────────

export function escapeHtml( text ) {
	return String( text )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );
}

/**
 * Parse clipboard text copied from Excel / Google Sheets (tab-separated,
 * one row per line, quoted cells may contain tabs/newlines/"" escapes).
 * Returns null when it isn't a multi-cell grid, so a normal paste happens.
 */
export function parseClipboardGrid( text ) {
	if ( ! text || ( ! text.includes( '\t' ) && ! /\r?\n./.test( text.trim() ) ) ) return null;
	const rows = [];
	let row = [], cell = '', i = 0, quoted = false;
	const src = text.replace( /\r\n?/g, '\n' ).replace( /\n$/, '' );
	while ( i < src.length ) {
		const ch = src[ i ];
		if ( quoted ) {
			if ( ch === '"' && src[ i + 1 ] === '"' ) { cell += '"'; i += 2; continue; }
			if ( ch === '"' ) { quoted = false; i++; continue; }
			cell += ch; i++; continue;
		}
		if ( ch === '"' && cell === '' ) { quoted = true; i++; continue; }
		if ( ch === '\t' ) { row.push( cell ); cell = ''; i++; continue; }
		if ( ch === '\n' ) { row.push( cell ); rows.push( row ); row = []; cell = ''; i++; continue; }
		cell += ch; i++;
	}
	row.push( cell );
	rows.push( row );
	// Plain multi-line text with no tabs is one column: only treat it as a grid
	// if there's more than one row.
	return rows.length > 1 || rows[ 0 ].length > 1 ? rows : null;
}

/**
 * Write a grid of plain-text values into the table starting at (r, c),
 * adding rows/columns at the end if it doesn't fit. Positions covered by a
 * merge are skipped (the merged cell keeps its content). Line breaks inside a
 * value become <br>. Returns { cells, addedCols }.
 */
export function pasteGrid( cells, r, c, grid ) {
	let next     = cells;
	const width  = Math.max( ...grid.map( ( row ) => row.length ) );
	const needR  = r + grid.length - dims( next ).rows;
	const needC  = c + width - dims( next ).cols;
	for ( let i = 0; i < needR; i++ ) next = insertRow( next, dims( next ).rows );
	for ( let i = 0; i < needC; i++ ) next = insertColumn( next, dims( next ).cols );
	next = clone( next );
	grid.forEach( ( row, dr ) => row.forEach( ( value, dc ) => {
		const cell = next[ r + dr ][ c + dc ];
		if ( cell.hidden ) return;
		cell.content = escapeHtml( value.trim() ).replace( /\n/g, '<br>' );
	} ) );
	return { cells: next, addedCols: Math.max( 0, needC ) };
}

// ── Conversion to/from the core Table block ──────────────────────────────────

/**
 * Build a grid from HTML-table-like rows ([[{ content, colspan, rowspan, align }]]),
 * placing cells the way browsers do: each cell takes the next free column,
 * skipping positions already covered by a rowspan from above.
 */
export function gridFromRows( rows ) {
	const grid = [];
	rows.forEach( ( row, r ) => {
		grid[ r ] = grid[ r ] || [];
		let c = 0;
		for ( const src of row ) {
			while ( grid[ r ][ c ] ) c++;
			const rs = Math.max( 1, Math.min( parseInt( src.rowspan, 10 ) || 1, rows.length - r ) );
			const cs = Math.max( 1, parseInt( src.colspan, 10 ) || 1 );
			for ( let rr = r; rr < r + rs; rr++ ) {
				grid[ rr ] = grid[ rr ] || [];
				for ( let cc = c; cc < c + cs; cc++ ) grid[ rr ][ cc ] = { hidden: true };
			}
			const cell = { content: src.content ?? '' };
			if ( rs > 1 ) cell.rowspan = rs;
			if ( cs > 1 ) cell.colspan = cs;
			if ( src.align ) cell.align = src.align;
			grid[ r ][ c ] = cell;
			c += cs;
		}
	} );
	// Pad ragged rows so the grid is rectangular.
	const width = Math.max( 1, ...grid.map( ( row ) => row.length ) );
	return grid.map( ( row ) => Array.from( { length: width }, ( _, c ) => row[ c ] || { content: '' } ) );
}

/** The reverse: rows of visible cells (with spans) for building a core Table block. */
export function rowsFromGrid( cells ) {
	return cells.map( ( row ) => row
		.filter( ( cell ) => ! cell.hidden )
		.map( ( cell ) => ( {
			content: cell.content ?? '',
			...( cell.colspan > 1 ? { colspan: cell.colspan } : {} ),
			...( cell.rowspan > 1 ? { rowspan: cell.rowspan } : {} ),
			...( cell.align ? { align: cell.align } : {} ),
		} ) ) );
}

/** Column widths (percent) after inserting a column; the new one copies its neighbour. */
export function insertColumnWidth( widths, index, refCol ) {
	if ( ! widths?.length ) return widths;
	const next = [ ...widths ];
	next.splice( index, 0, widths[ refCol ] ?? widths[ widths.length - 1 ] );
	return normalizeWidths( next );
}

export function deleteColumnWidth( widths, index ) {
	if ( ! widths?.length ) return widths;
	const next = [ ...widths ];
	next.splice( index, 1 );
	return normalizeWidths( next );
}

/** Scale widths to add up to 100, rounded to 2 decimals. */
export function normalizeWidths( widths ) {
	const total = widths.reduce( ( a, b ) => a + b, 0 ) || 1;
	return widths.map( ( w ) => Math.round( ( w / total ) * 10000 ) / 100 );
}
