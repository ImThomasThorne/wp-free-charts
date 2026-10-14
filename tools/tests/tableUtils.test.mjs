// Unit tests for src/table/tableUtils.js. Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	createGrid, insertRow, deleteRow, insertColumn, deleteColumn, mergeCells, splitCell,
	expandRect, originsInRect, getHeaderRowCount, getColumnLabels, updateCells,
	clearFormatting, boundsOfKeys, insertColumnWidth, deleteColumnWidth, findOrigin,
	neighbourCell, parseClipboardGrid, pasteGrid, gridFromRows, rowsFromGrid,
} from '../../src/table/tableUtils.js';

/** Every grid position must be covered by exactly one origin cell. */
function assertValid( cells ) {
	const rows = cells.length;
	const cols = cells[ 0 ].length;
	const cover = cells.map( ( row ) => row.map( () => 0 ) );
	cells.forEach( ( row, r ) => {
		assert.equal( row.length, cols, `row ${ r } has ${ row.length } cells, expected ${ cols }` );
		row.forEach( ( cell, c ) => {
			if ( cell.hidden ) return;
			const rs = cell.rowspan || 1;
			const cs = cell.colspan || 1;
			assert.ok( r + rs <= rows && c + cs <= cols, `cell ${ r },${ c } spans outside the grid` );
			for ( let rr = r; rr < r + rs; rr++ ) {
				for ( let cc = c; cc < c + cs; cc++ ) {
					cover[ rr ][ cc ]++;
					if ( rr !== r || cc !== c ) assert.ok( cells[ rr ][ cc ].hidden, `${ rr },${ cc } should be hidden` );
				}
			}
		} );
	} );
	cover.forEach( ( row, r ) => row.forEach( ( n, c ) => assert.equal( n, 1, `position ${ r },${ c } covered ${ n } times` ) ) );
}

/** Grid with contents "r,c" so we can track where cells end up. */
function labelled( rows, cols ) {
	return createGrid( rows, cols ).map( ( row, r ) => row.map( ( cell, c ) => ( { content: `${ r },${ c }` } ) ) );
}

test( 'createGrid makes an empty rows x cols grid', () => {
	const g = createGrid( 2, 3 );
	assert.equal( g.length, 2 );
	assert.equal( g[ 0 ].length, 3 );
	assertValid( g );
} );

test( 'insert/delete rows and columns on a plain grid', () => {
	let g = labelled( 3, 3 );
	g = insertRow( g, 1 );
	assert.equal( g.length, 4 );
	assert.equal( g[ 1 ][ 0 ].content, '' );
	assert.equal( g[ 2 ][ 0 ].content, '1,0' );
	g = insertColumn( g, 3 );
	assert.equal( g[ 0 ].length, 4 );
	assert.equal( g[ 0 ][ 3 ].content, '' );
	g = deleteRow( g, 1 );
	g = deleteColumn( g, 3 );
	assert.deepEqual( g, labelled( 3, 3 ) );
	assertValid( g );
} );

test( 'cannot delete the last row or column', () => {
	const g = labelled( 1, 1 );
	assert.equal( deleteRow( g, 0 ), g );
	assert.equal( deleteColumn( g, 0 ), g );
} );

test( 'new rows copy formatting (not content) from the reference row', () => {
	let g = labelled( 2, 2 );
	g = updateCells( g, [ '1-0', '1-1' ], { bg: '#ff0000', bold: true } );
	g = insertRow( g, 2, 1 );
	assert.deepEqual( g[ 2 ][ 0 ], { content: '', bg: '#ff0000', bold: true } );
} );

test( 'merge keeps non-empty contents and hides covered cells', () => {
	let g = labelled( 3, 3 );
	g = updateCells( g, [ '0-1' ], { content: '' } );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, 2 );
	assert.equal( g[ 0 ][ 0 ].colspan, 2 );
	assert.equal( g[ 0 ][ 0 ].content, '0,0<br>1,0<br>1,1' );
	assert.ok( g[ 1 ][ 1 ].hidden );
	assert.deepEqual( findOrigin( g, 1, 1 ), [ 0, 0 ] );
} );

test( 'merge expands a selection that cuts through an existing merge', () => {
	let g = labelled( 3, 3 );
	g = mergeCells( g, { r1: 1, c1: 1, r2: 2, c2: 1 } ); // vertical merge in column 1
	assert.deepEqual( expandRect( g, { r1: 0, c1: 0, r2: 1, c2: 1 } ), { r1: 0, c1: 0, r2: 2, c2: 1 } );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, 3 );
	assert.equal( g[ 0 ][ 0 ].colspan, 2 );
} );

test( 'split restores a plain grid and copies formatting', () => {
	let g = labelled( 2, 2 );
	g = updateCells( g, [ '0-0' ], { bg: '#00ff00' } );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } );
	g = splitCell( g, 1, 1 ); // any covered position splits its merge
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, undefined );
	assert.deepEqual( g[ 1 ][ 1 ], { content: '', bg: '#00ff00' } );
} );

test( 'inserting a row through a vertical merge grows the merge', () => {
	let g = labelled( 3, 2 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 2, c2: 0 } );
	g = insertRow( g, 1 );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, 4 );
	assert.ok( g[ 1 ][ 0 ].hidden );
	assert.equal( g[ 1 ][ 1 ].content, '' );
} );

test( 'inserting a row above or below a merge does not grow it', () => {
	let g = labelled( 3, 2 );
	g = mergeCells( g, { r1: 1, c1: 0, r2: 2, c2: 0 } );
	const above = insertRow( g, 1 );
	assertValid( above );
	assert.equal( above[ 2 ][ 0 ].rowspan, 2 );
	const below = insertRow( g, 3 );
	assertValid( below );
	assert.equal( below[ 1 ][ 0 ].rowspan, 2 );
} );

test( 'deleting the first row of a merge moves the merge down with its content', () => {
	let g = labelled( 3, 2 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 2, c2: 0 } );
	g = deleteRow( g, 0 );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, 2 );
	assert.match( g[ 0 ][ 0 ].content, /^0,0/ );
} );

test( 'deleting a middle row of a merge shrinks it', () => {
	let g = labelled( 4, 2 );
	g = mergeCells( g, { r1: 0, c1: 1, r2: 3, c2: 1 } );
	g = deleteRow( g, 2 );
	assertValid( g );
	assert.equal( g[ 0 ][ 1 ].rowspan, 3 );
} );

test( 'column operations handle horizontal merges', () => {
	let g = labelled( 2, 4 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 0, c2: 2 } );
	g = insertColumn( g, 1 );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].colspan, 4 );
	g = deleteColumn( g, 0 );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].colspan, 3 );
	assert.match( g[ 0 ][ 0 ].content, /^0,0/ );
} );

test( 'a 2x2 merge survives deleting its row and column', () => {
	let g = labelled( 3, 3 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } );
	g = deleteRow( g, 0 );
	assertValid( g );
	g = deleteColumn( g, 0 );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, undefined );
	assert.equal( g[ 0 ][ 0 ].colspan, undefined );
} );

test( 'originsInRect lists each merged cell once', () => {
	let g = labelled( 3, 3 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } );
	assert.deepEqual( originsInRect( g, { r1: 0, c1: 0, r2: 2, c2: 0 } ), [ '0-0', '2-0' ] );
	assert.deepEqual( boundsOfKeys( g, [ '0-0', '2-0' ] ), { r1: 0, c1: 0, r2: 2, c2: 1 } );
} );

test( 'header rows grow to include cells merged down from the first row', () => {
	let g = labelled( 4, 2 );
	assert.equal( getHeaderRowCount( g ), 1 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 0 } );
	assert.equal( getHeaderRowCount( g ), 2 );
} );

test( 'column labels come from the first row as plain text', () => {
	let g = labelled( 2, 3 );
	g = updateCells( g, [ '0-0' ], { content: '<strong>Name</strong> &amp; age' } );
	g = mergeCells( g, { r1: 0, c1: 1, r2: 0, c2: 2 } );
	assert.deepEqual( getColumnLabels( g ), [ 'Name & age', '0,1 0,2', '0,1 0,2' ] );
} );

test( 'updateCells removes keys set to empty values; clearFormatting keeps content', () => {
	let g = labelled( 1, 1 );
	g = updateCells( g, [ '0-0' ], { bg: '#000', align: 'center' } );
	g = updateCells( g, [ '0-0' ], { bg: undefined } );
	assert.deepEqual( g[ 0 ][ 0 ], { content: '0,0', align: 'center' } );
	g = clearFormatting( g, [ '0-0' ] );
	assert.deepEqual( g[ 0 ][ 0 ], { content: '0,0' } );
} );

test( 'column widths follow inserted/deleted columns and stay at 100%', () => {
	assert.deepEqual( insertColumnWidth( [ 50, 50 ], 1, 0 ), [ 33.33, 33.33, 33.33 ] );
	assert.deepEqual( deleteColumnWidth( [ 25, 25, 50 ], 2 ), [ 50, 50 ] );
	assert.deepEqual( insertColumnWidth( [], 0, 0 ), [] );
} );

test( 'arrow-key neighbours skip over merged cells and stop at edges', () => {
	let g = labelled( 3, 3 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 1, c2: 1 } ); // 2x2 at top-left
	assert.deepEqual( neighbourCell( g, 0, 0, 'right' ), [ 0, 2 ] );
	assert.deepEqual( neighbourCell( g, 0, 0, 'down' ), [ 2, 0 ] );
	assert.deepEqual( neighbourCell( g, 2, 1, 'up' ), [ 0, 0 ] );   // lands on the merge's origin
	assert.deepEqual( neighbourCell( g, 1, 2, 'left' ), [ 0, 0 ] );
	assert.equal( neighbourCell( g, 0, 0, 'up' ), null );
	assert.equal( neighbourCell( g, 0, 2, 'right' ), null );
} );

test( 'clipboard parsing: Excel/Sheets grids, quoted cells, and non-grids', () => {
	assert.deepEqual( parseClipboardGrid( 'a\tb\r\nc\td\r\n' ), [ [ 'a', 'b' ], [ 'c', 'd' ] ] );
	assert.deepEqual( parseClipboardGrid( '"line 1\nline 2"\t"say ""hi"""\nx\ty' ), [ [ 'line 1\nline 2', 'say "hi"' ], [ 'x', 'y' ] ] );
	assert.deepEqual( parseClipboardGrid( 'one\ntwo' ), [ [ 'one' ], [ 'two' ] ] );
	assert.deepEqual( parseClipboardGrid( 'a\t\tc' ), [ [ 'a', '', 'c' ] ] );
	assert.equal( parseClipboardGrid( 'just some text' ), null );
	assert.equal( parseClipboardGrid( '' ), null );
} );

test( 'pasting a grid fills cells, escapes HTML and grows the table', () => {
	const g = labelled( 2, 2 );
	const { cells, addedCols } = pasteGrid( g, 1, 1, [ [ '<b>x</b>', 'y' ], [ 'a\nb', 'z' ] ] );
	assertValid( cells );
	assert.equal( cells.length, 3 );
	assert.equal( cells[ 0 ].length, 3 );
	assert.equal( addedCols, 1 );
	assert.equal( cells[ 1 ][ 1 ].content, '&lt;b&gt;x&lt;/b&gt;' );
	assert.equal( cells[ 2 ][ 1 ].content, 'a<br>b' );
	assert.equal( cells[ 0 ][ 0 ].content, '0,0' ); // untouched
} );

test( 'pasting over a merged area leaves the merged cell intact', () => {
	let g = labelled( 2, 2 );
	g = mergeCells( g, { r1: 0, c1: 0, r2: 0, c2: 1 } );
	const { cells } = pasteGrid( g, 0, 0, [ [ 'A', 'B' ], [ 'C', 'D' ] ] );
	assertValid( cells );
	assert.equal( cells[ 0 ][ 0 ].content, 'A' );
	assert.ok( cells[ 0 ][ 1 ].hidden );
	assert.equal( cells[ 1 ][ 1 ].content, 'D' );
} );

test( 'core Table rows convert to a grid, placing cells around rowspans', () => {
	// | A (2 rows) | B | C |
	// |            | D (2 cols) |
	const g = gridFromRows( [
		[ { content: 'A', rowspan: 2 }, { content: 'B' }, { content: 'C', align: 'right' } ],
		[ { content: 'D', colspan: 2 } ],
	] );
	assertValid( g );
	assert.equal( g[ 0 ][ 0 ].rowspan, 2 );
	assert.equal( g[ 1 ][ 1 ].content, 'D' );
	assert.equal( g[ 1 ][ 1 ].colspan, 2 );
	assert.equal( g[ 0 ][ 2 ].align, 'right' );
	// And back again.
	assert.deepEqual( rowsFromGrid( g ), [
		[ { content: 'A', rowspan: 2 }, { content: 'B' }, { content: 'C', align: 'right' } ],
		[ { content: 'D', colspan: 2 } ],
	] );
} );

test( 'ragged and oversized spans are tidied into a valid grid', () => {
	const g = gridFromRows( [
		[ { content: 'a' }, { content: 'b' }, { content: 'c' } ],
		[ { content: 'd', rowspan: 9 } ],
	] );
	assertValid( g );
	assert.equal( g[ 1 ][ 0 ].rowspan, undefined ); // clamped to the table height
	assert.equal( g[ 1 ][ 2 ].content, '' );        // padded
} );

test( 'inputs are never mutated', () => {
	const g      = labelled( 3, 3 );
	const before = JSON.stringify( g );
	mergeCells( g, { r1: 0, c1: 0, r2: 2, c2: 2 } );
	insertRow( g, 1 );
	deleteColumn( g, 1 );
	updateCells( g, [ '0-0' ], { bg: '#fff' } );
	assert.equal( JSON.stringify( g ), before );
} );
