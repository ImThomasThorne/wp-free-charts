// End-to-end test for table keyboard navigation, spreadsheet paste, per-cell fonts
// and core/table transforms. Same setup as table-editor.test.mjs (see its header).
// Usage: node table-stage4.test.mjs <outDir>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT  = process.argv[ 2 ];
const BASE = 'http://127.0.0.1:9400';
fs.mkdirSync( OUT, { recursive: true } );
const log = ( ...a ) => console.log( '[test]', ...a );
let failures = 0;
const check = ( label, actual, expected ) => {
	const ok = JSON.stringify( actual ) === JSON.stringify( expected );
	if ( ! ok ) failures++;
	log( ok ? 'PASS' : 'FAIL', label, ok ? '' : `→ got ${ JSON.stringify( actual ) }, expected ${ JSON.stringify( expected ) }` );
};

const browser = await chromium.launch( { channel: 'msedge', headless: true } );
const page    = await browser.newPage( { viewport: { width: 1400, height: 1000 } } );
page.setDefaultTimeout( 15000 );
const errors = [];
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) errors.push( m.text() ); } );
page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );

try {
	await page.goto( `${ BASE }/wp-admin/post-new.php`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' ), null, { timeout: 120000 } );
	await page.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
	await page.waitForTimeout( 1000 );
	for ( const btn of await page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' ).all() ) await btn.click().catch( () => {} );

	// A 3x3 table with text, one cell holding two lines.
	await page.evaluate( () => {
		const c = ( content ) => ( { content } );
		const block = wp.blocks.createBlock( 'wp-free-charts/table', { cells: [
			[ c( 'A1' ), c( 'B1' ), c( 'C1' ) ],
			[ c( 'A2' ), c( 'line one<br>line two' ), c( 'C2' ) ],
			[ c( 'A3' ), c( 'B3' ), c( 'C3' ) ],
		] } );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( block.clientId );
	} );
	const frame  = page.frames().find( ( f ) => f.name() === 'editor-canvas' );
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( '[data-cell="0-0"]' ).waitFor();
	const active = () => frame.evaluate( () => document.activeElement?.dataset?.cell ?? document.activeElement?.tagName );
	const blockAttrs = () => page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks().find( ( b ) => b.name === 'wp-free-charts/table' ).attributes );

	// ── Arrow keys ──
	await canvas.locator( '[data-cell="0-0"]' ).click();
	await page.keyboard.press( 'End' );
	await page.keyboard.press( 'ArrowRight' );
	check( 'ArrowRight at end of A1 → B1', await active(), '0-1' );
	await page.keyboard.press( 'ArrowDown' );
	check( 'ArrowDown from B1 → B2', await active(), '1-1' );
	// In B2 (two lines) the caret starts at the beginning: ArrowDown should stay in the cell first.
	await page.keyboard.press( 'ArrowDown' );
	check( 'ArrowDown on first of two lines stays in B2', await active(), '1-1' );
	await page.keyboard.press( 'ArrowDown' );
	check( 'ArrowDown on last line → B3', await active(), '2-1' );
	await page.keyboard.press( 'ArrowRight' ); // caret at start of B3 → moves within text, not cell
	check( 'ArrowRight mid-text stays in B3', await active(), '2-1' );
	await page.keyboard.press( 'Home' );
	await page.keyboard.press( 'ArrowLeft' );
	check( 'ArrowLeft at start of B3 → A3', await active(), '2-0' );
	await page.keyboard.press( 'ArrowUp' );
	check( 'ArrowUp from A3 → A2', await active(), '1-0' );
	await page.keyboard.type( '!' );
	check( 'typing after navigation edits the new cell', ( await blockAttrs() ).cells[ 1 ][ 0 ].content, 'A2!' );

	// ── Paste a 3x3 block from a spreadsheet into B2 (grows the table by 1 row + 1 col) ──
	await canvas.locator( '[data-cell="1-1"]' ).click();
	await frame.evaluate( () => {
		const dt = new DataTransfer();
		dt.setData( 'text/plain', 'x\ty\tz\r\n1\t2\t3\r\n4\t<b>5</b>\t6\r\n' );
		dt.setData( 'text/html', '<table><tr><td>x</td></tr></table>' );
		document.activeElement.dispatchEvent( new ClipboardEvent( 'paste', { clipboardData: dt, bubbles: true, cancelable: true } ) );
	} );
	await page.waitForTimeout( 300 );
	let attrs = await blockAttrs();
	check( 'paste grows table to 4x4', [ attrs.cells.length, attrs.cells[ 0 ].length ], [ 4, 4 ] );
	check( 'pasted values', [ attrs.cells[ 1 ][ 1 ].content, attrs.cells[ 1 ][ 3 ].content, attrs.cells[ 3 ][ 2 ].content ], [ 'x', 'z', '&lt;b&gt;5&lt;/b&gt;' ] );
	check( 'cells outside the paste untouched', [ attrs.cells[ 0 ][ 0 ].content, attrs.cells[ 1 ][ 0 ].content ], [ 'A1', 'A2!' ] );
	check( 'pasted range is selected', await canvas.locator( '.is-cell-selected' ).count(), 9 );

	// Plain text with no tabs pastes normally inside one cell.
	await canvas.locator( '[data-cell="0-1"]' ).click();
	await page.keyboard.press( 'End' );
	await frame.evaluate( () => {
		const dt = new DataTransfer();
		dt.setData( 'text/plain', ' plain' );
		document.activeElement.dispatchEvent( new ClipboardEvent( 'paste', { clipboardData: dt, bubbles: true, cancelable: true } ) );
	} );
	await page.waitForTimeout( 300 );
	attrs = await blockAttrs();
	// (WordPress trims pasted plain text, so the leading space goes.)
	check( 'normal paste stays in one cell', [ attrs.cells.length, attrs.cells[ 0 ][ 1 ].content ], [ 4, 'B1plain' ] );

	// ── Per-cell font family from the theme ──
	await canvas.locator( '[data-cell="0-0"]' ).click();
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	const fontSelect = page.getByLabel( 'Font', { exact: true } );
	const fontOptions = await fontSelect.locator( 'option' ).allTextContents();
	log( 'theme fonts offered:', fontOptions.join( ', ' ) );
	await fontSelect.selectOption( { index: Math.min( 2, fontOptions.length - 1 ) } );
	attrs = await blockAttrs();
	check( 'font family stored with slug', !! attrs.cells[ 0 ][ 0 ].fontFamilySlug, true );
	const savedHtml = await page.evaluate( () => wp.data.select( 'core/editor' ).getEditedPostContent() );
	check( 'saved as theme font variable', /font-family:var\(--wp--preset--font-family--/.test( savedHtml ), true );
	await page.screenshot( { path: `${ OUT }/01-after-paste-and-font.png` } );

	// ── Transforms: core/table (with merges + header) → ours → core/table ──
	const roundTrip = await page.evaluate( () => {
		const { createBlock, switchToBlockType } = wp.blocks;
		const core = createBlock( 'core/table', {
			head: [ { cells: [ { content: 'Name', tag: 'th' }, { content: 'Score', tag: 'th', colspan: '2' } ] } ],
			body: [
				{ cells: [ { content: '<strong>Alex</strong>', tag: 'td', rowspan: '2' }, { content: '1', tag: 'td' }, { content: '2', tag: 'td', align: 'right' } ] },
				{ cells: [ { content: '3', tag: 'td' }, { content: '4', tag: 'td' } ] },
			],
			caption: 'Scores',
		} );
		const [ ours ] = switchToBlockType( core, 'wp-free-charts/table' );
		const [ back ] = switchToBlockType( ours, 'core/table' );
		const html = ( v ) => ( typeof v === 'string' ? v : v?.toHTMLString?.() ?? String( v ) );
		return {
			oursCells: ours.attributes.cells,
			oursHeader: ours.attributes.hasHeaderRow,
			oursCaption: ours.attributes.caption,
			backHead: back.attributes.head.map( ( r ) => r.cells.map( ( c ) => [ html( c.content ), c.tag, c.colspan ?? null ] ) ),
			backBody: back.attributes.body.map( ( r ) => r.cells.map( ( c ) => [ html( c.content ), c.rowspan ?? null, c.align ?? null ] ) ),
			backCaption: html( back.attributes.caption ),
		};
	} );
	check( 'core → ours: grid size', [ roundTrip.oursCells.length, roundTrip.oursCells[ 0 ].length ], [ 3, 3 ] );
	check( 'core → ours: merges', [ roundTrip.oursCells[ 0 ][ 1 ].colspan, roundTrip.oursCells[ 1 ][ 0 ].rowspan, !! roundTrip.oursCells[ 2 ][ 0 ].hidden ], [ 2, 2, true ] );
	check( 'core → ours: formatting/align/header/caption', [ roundTrip.oursCells[ 1 ][ 0 ].content, roundTrip.oursCells[ 1 ][ 2 ].align, roundTrip.oursHeader, roundTrip.oursCaption ], [ '<strong>Alex</strong>', 'right', true, 'Scores' ] );
	check( 'ours → core: head', roundTrip.backHead, [ [ [ 'Name', 'th', null ], [ 'Score', 'th', 2 ] ] ] );
	check( 'ours → core: body', roundTrip.backBody, [ [ [ '<strong>Alex</strong>', 2, null ], [ '1', null, null ], [ '2', null, 'right' ] ], [ [ '3', null, null ], [ '4', null, null ] ] ] );
	check( 'ours → core: caption', roundTrip.backCaption, 'Scores' );

	// The transform also shows up in the UI: insert a core table and check "Transform to".
	const transformAvailable = await page.evaluate( () => {
		const core = wp.blocks.createBlock( 'core/table', { body: [ { cells: [ { content: 'x', tag: 'td' } ] } ] } );
		return wp.blocks.getPossibleBlockTransformations( [ core ] ).some( ( t ) => t.name === 'wp-free-charts/table' );
	} );
	check( 'core Table offers "Transform to WP Free Table"', transformAvailable, true );

	// ── Save, reload, validity ──
	await page.evaluate( () => {
		wp.data.dispatch( 'core/editor' ).editPost( { title: 'Stage 4 test', status: 'publish' } );
		wp.data.dispatch( 'core/editor' ).savePost();
	} );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost() && wp.data.select( 'core/editor' ).getCurrentPost().status === 'publish', null, { timeout: 60000 } );
	const postId = await page.evaluate( () => wp.data.select( 'core/editor' ).getCurrentPostId() );
	await page.goto( `${ BASE }/wp-admin/post.php?post=${ postId }&action=edit`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	check( 'valid after reload', await page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks().every( ( b ) => b.isValid ) ), true );
} catch ( e ) {
	failures++;
	log( 'FAILED:', e.message.split( '\n' ).slice( 0, 4 ).join( '\n' ) );
	await page.screenshot( { path: `${ OUT }/zz-failure.png` } ).catch( () => {} );
} finally {
	log( 'console errors:', errors.length ? '\n  ' + errors.join( '\n  ' ) : 'none' );
	log( failures ? `${ failures } FAILURE(S)` : 'ALL PASSED' );
	await browser.close();
}
