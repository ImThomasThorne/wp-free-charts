// End-to-end test of the table block in a real block editor (WordPress Playground + Edge).
//
// 1. Start WordPress with this plugin mounted (leave it running):
//      npx @wp-playground/cli@latest server --port=9400 --mount-dir "C:\Git Repos\wp-free-charts" /wordpress/wp-content/plugins/wp-free-charts --blueprint=tools/editor-test/blueprint.json --login
// 2. In another terminal, from a folder OUTSIDE the repo with playwright-core installed
//    (npm i playwright-core), run:
//      node "C:\Git Repos\wp-free-charts\tools\editor-test\table-editor.test.mjs" <outDir>
//
// It creates a table, types, formats, Shift/Ctrl-selects, merges/splits, colours cells from
// the theme palette, resizes a column, inserts/deletes rows, publishes, checks the blocks
// are still valid after reload, and screenshots the front end at desktop/phone widths in
// both mobile layouts (plus a copy inside a 450px Group). Read the "[test]" lines and PNGs.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT  = process.argv[ 2 ];
const BASE = 'http://127.0.0.1:9400';
fs.mkdirSync( OUT, { recursive: true } );

const log  = ( ...a ) => console.log( '[test]', ...a );
const shot = async ( page, name, opts = {} ) => {
	await page.screenshot( { path: `${ OUT }/${ name }.png`, ...opts } );
	log( 'screenshot', name );
};

const browser = await chromium.launch( { channel: 'msedge', headless: true } );
const context = await browser.newContext( { viewport: { width: 1400, height: 1000 } } );
const page    = await context.newPage();
page.setDefaultTimeout( 15000 );
const errors  = [];

/** Close any editor modal (welcome guide, pattern picker). */
async function closeModals() {
	for ( let i = 0; i < 3; i++ ) {
		const close = page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' );
		if ( ! await close.count() ) return;
		await close.first().click().catch( () => {} );
		await page.waitForTimeout( 300 );
	}
}
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) errors.push( m.text() ); } );
page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );

try {
	// Playground's --login logs in on the first request.
	await page.goto( `${ BASE }/wp-admin/post-new.php`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' ), null, { timeout: 120000 } );
	await page.evaluate( () => {
		wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false );
		wp.data.dispatch( 'core/preferences' ).set( 'core', 'fixedToolbar', false );
	} );
	log( 'WP version', await page.evaluate( () => document.querySelector( '#wpfooter, body' ) && window.wp?.data && ( window.wp.data.select( 'core' ).getSite?.()?.version ?? 'n/a' ) ) );
	log( 'table registered:', await page.evaluate( () => !! wp.blocks.getBlockType( 'wp-free-charts/table' ) ) );

	// Insert the block → placeholder.
	await page.evaluate( () => {
		const block = wp.blocks.createBlock( 'wp-free-charts/table' );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( block.clientId );
	} );
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( '.wfc-table-setup' ).waitFor( { timeout: 30000 } );
	await page.waitForTimeout( 1000 );
	await closeModals();
	await shot( page, '01-placeholder' );

	// Create a 4x5 table (4 cols, 5 rows).
	const inputs = canvas.locator( '.wfc-table-setup input' );
	await inputs.nth( 0 ).fill( '4' );
	await inputs.nth( 1 ).fill( '5' );
	await canvas.getByRole( 'button', { name: 'Create table' } ).click();
	await canvas.locator( '.wfc-table__table' ).waitFor();

	// Type into cells via clicking + keyboard.
	const cell = ( label ) => canvas.locator( `[aria-label="Cell ${ label }"]` );
	const data = [
		[ 'Name', 'Role', 'Location', 'Hours' ],
		[ 'Alex', 'Youth worker', 'Carlisle', '30' ],
		[ 'Sam', 'Coordinator', 'Kendal', '37.5' ],
		[ 'Jo', 'Volunteer', 'Penrith', '8' ],
		[ 'Total', '', '', '75.5' ],
	];
	const letters = 'ABCD';
	for ( let r = 0; r < data.length; r++ ) {
		for ( let c = 0; c < 4; c++ ) {
			if ( ! data[ r ][ c ] ) continue;
			await cell( `${ letters[ c ] }${ r + 1 }` ).click();
			await page.keyboard.type( data[ r ][ c ] );
		}
	}
	await shot( page, '02-typed' );

	// Bold + underline via toolbar on part of a cell: select text in B2 and press Ctrl+B.
	await cell( 'B2' ).click();
	await page.keyboard.press( 'Home' );
	await page.keyboard.press( 'Shift+End' );
	await page.keyboard.press( 'Control+b' );
	// Underline lives in the rich-text "More" dropdown, like WordPress's other extra formats.
	await page.locator( '.block-editor-block-toolbar button[aria-label="More"]' ).first().click();
	const underline = page.getByRole( 'menuitem', { name: 'Underline' } );
	log( 'underline in More menu:', await underline.count() );
	if ( await underline.count() ) await underline.first().click();
	else await page.keyboard.press( 'Escape' );

	// Shift+click range A5:C5 then Merge.
	await cell( 'A5' ).click();
	await cell( 'C5' ).click( { modifiers: [ 'Shift' ] } );
	log( 'selected after shift-click:', await canvas.locator( '.is-cell-selected' ).count() );
	await page.getByRole( 'button', { name: 'Merge', exact: true } ).click();
	log( 'A5 colspan:', await cell( 'A5' ).getAttribute( 'colspan' ) );

	// Ctrl+click B2 and D3, then give them a palette background colour.
	await cell( 'B2' ).click();
	await cell( 'D3' ).click( { modifiers: [ 'Control' ] } );
	log( 'selected after ctrl-click:', await canvas.locator( '.is-cell-selected' ).count() );
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	await page.getByRole( 'button', { name: 'Background', exact: true } ).first().click().catch( () => {} );
	const swatches = page.locator( '.components-circular-option-picker__option' );
	log( 'palette swatches:', await swatches.count() );
	if ( await swatches.count() ) await swatches.nth( 2 ).click();
	await page.keyboard.press( 'Escape' );

	// Select column D via its letter handle and centre-align it.
	await canvas.getByRole( 'button', { name: 'Select column D' } ).click();
	log( 'selected after column click:', await canvas.locator( '.is-cell-selected' ).count() );
	await page.getByLabel( 'Horizontal alignment' ).selectOption( 'right' );

	// Drag the A|B grip 120px right.
	const grip = canvas.locator( '.wfc-col-resizer' ).first();
	const box  = await grip.boundingBox();
	await page.mouse.move( box.x + box.width / 2, box.y + box.height / 2 );
	await page.mouse.down();
	await page.mouse.move( box.x + 60, box.y + 5, { steps: 5 } );
	await page.mouse.move( box.x + 120, box.y + 5, { steps: 5 } );
	await page.mouse.up();
	const attrs = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getSelectedBlock()?.attributes
		?? wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ].attributes );
	log( 'colWidths:', JSON.stringify( attrs.colWidths ) );

	await shot( page, '03-edited' );

	// Toolbar row operations on a selected cell, then split the merged cell.
	const rowCount = () => canvas.locator( '.wfc-table__table tr' ).count();
	const before   = await rowCount();
	await cell( 'B3' ).click();
	const rowsMenu = async ( item ) => {
		await page.getByRole( 'button', { name: 'Rows & columns' } ).click();
		await page.getByRole( 'menuitem', { name: item } ).click();
	};
	await rowsMenu( 'Insert row below' );
	log( 'rows after insert:', await rowCount() - before, '(expect +1)' );
	await cell( 'B4' ).click();
	await rowsMenu( 'Delete row' );
	log( 'rows after delete:', await rowCount() - before, '(expect 0)' );
	await cell( 'A5' ).click();
	await page.getByRole( 'button', { name: 'Split', exact: true } ).click();
	log( 'A5 colspan after split:', await cell( 'A5' ).getAttribute( 'colspan' ), '(expect null)' );
	await cell( 'A5' ).click();
	await cell( 'C5' ).click( { modifiers: [ 'Shift' ] } );
	await page.getByRole( 'button', { name: 'Merge', exact: true } ).click();

	// Publish.
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { title: 'Table test', status: 'publish' } ) );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost() && wp.data.select( 'core/editor' ).getCurrentPost().status === 'publish', null, { timeout: 60000 } );
	const postId = await page.evaluate( () => wp.data.select( 'core/editor' ).getCurrentPostId() );
	const link   = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	log( 'published', postId, link );
	fs.writeFileSync( `${ OUT }/saved-content.html`, await page.evaluate( () => wp.data.select( 'core/editor' ).getEditedPostContent() ) );

	// Reload the editor: block must still be valid.
	await page.goto( `${ BASE }/wp-admin/post.php?post=${ postId }&action=edit`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	log( 'valid after reload:', await page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks().map( ( b ) => `${ b.name }:${ b.isValid }` ).join( ', ' ) ) );

	// Front end at desktop and phone widths, scroll mode.
	for ( const [ name, width ] of [ [ 'desktop', 1200 ], [ 'phone', 390 ] ] ) {
		const fp = await context.newPage();
		await fp.setViewportSize( { width, height: 900 } );
		await fp.goto( link, { waitUntil: 'load' } );
		await fp.locator( '.wp-block-wp-free-charts-table' ).scrollIntoViewIfNeeded();
		await fp.locator( '.wp-block-wp-free-charts-table' ).screenshot( { path: `${ OUT }/04-front-${ name }-scroll.png` } );
		await fp.close();
	}

	// Switch to stack mode, and add a copy inside a narrow (450px) Group block to
	// prove the layout follows the container, not the screen. Re-save.
	await page.evaluate( () => {
		const { select, dispatch } = wp.data;
		const b = select( 'core/block-editor' ).getBlocks()[ 0 ];
		dispatch( 'core/block-editor' ).updateBlockAttributes( b.clientId, { mobileLayout: 'stack', striped: true, hasCaption: true, caption: 'Staff hours, October' } );
		const copy  = wp.blocks.createBlock( 'wp-free-charts/table', { ...b.attributes, mobileLayout: 'stack', caption: 'Same table in a 450px Group' } );
		const group = wp.blocks.createBlock( 'core/group', { layout: { type: 'constrained', contentSize: '450px' } }, [ copy ] );
		dispatch( 'core/block-editor' ).insertBlocks( group );
		dispatch( 'core/editor' ).savePost();
	} );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost() && ! wp.data.select( 'core/editor' ).isEditedPostDirty(), null, { timeout: 60000 } );
	for ( const [ name, width ] of [ [ 'desktop', 1200 ], [ 'phone', 390 ] ] ) {
		const fp = await context.newPage();
		await fp.setViewportSize( { width, height: 1200 } );
		await fp.goto( link, { waitUntil: 'load' } );
		await fp.locator( '.wp-block-wp-free-charts-table' ).first().screenshot( { path: `${ OUT }/05-front-${ name }-stack.png` } );
		if ( name === 'desktop' ) {
			await fp.locator( '.wp-block-group' ).first().screenshot( { path: `${ OUT }/06-front-desktop-in-group.png` } );
		}
		await fp.close();
	}
	log( 'valid after second save:', await page.evaluate( () => wp.data.select( 'core/block-editor' ).getClientIdsWithDescendants().map( ( id ) => wp.data.select( 'core/block-editor' ).getBlock( id ) ).map( ( b ) => `${ b.name }:${ b.isValid }` ).join( ', ' ) ) );
} catch ( e ) {
	log( 'FAILED:', e.message.split( '\n' ).slice( 0, 4 ).join( '\n' ) );
	await shot( page, 'zz-failure' ).catch( () => {} );
} finally {
	log( 'console errors:', errors.length ? '\n  ' + errors.join( '\n  ' ) : 'none' );
	await browser.close();
}
