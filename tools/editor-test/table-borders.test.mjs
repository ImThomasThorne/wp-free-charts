// Test for the outer border (table + mobile cards) and line breaks in mobile card labels,
// including the 2.0.x → 2.1 deprecation. Same setup as table-editor.test.mjs (see its header).
// Usage: node table-borders.test.mjs <outDir> <legacyPostId> [otherOldPostIds…]
//   legacyPostId: a stack-mode table with <br> in header cells, saved by 2.0.x.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [ , , OUT, legacyId, ...oldPosts ] = process.argv;
const BASE = 'http://127.0.0.1:9400';
fs.mkdirSync( OUT, { recursive: true } );
const log = ( ...a ) => console.log( '[test]', ...a );
let failures = 0;
const check = ( label, ok, detail = '' ) => {
	if ( ! ok ) failures++;
	log( ok ? 'PASS' : 'FAIL', label, detail );
};

const browser = await chromium.launch( { channel: 'msedge', headless: true } );
const context = await browser.newContext( { viewport: { width: 1400, height: 1100 } } );
const page    = await context.newPage();
page.setDefaultTimeout( 20000 );
const errors = [];
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) errors.push( m.text() ); } );
page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );

const openEditor = async ( url ) => {
	await page.goto( url, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' ), null, { timeout: 120000 } );
	await page.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
};
const tableBlocks = () => page.evaluate( () => {
	const be = wp.data.select( 'core/block-editor' );
	return be.getClientIdsWithDescendants().map( ( id ) => be.getBlock( id ) ).filter( ( b ) => b.name.startsWith( 'wp-free-charts' ) )
		.map( ( b ) => ( { name: b.name, valid: b.isValid } ) );
} );
const save = async () => {
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost(), null, { timeout: 60000 } );
};
const phoneShot = async ( url, file ) => {
	const fp = await context.newPage();
	await fp.setViewportSize( { width: 390, height: 1400 } );
	await fp.goto( url, { waitUntil: 'load', timeout: 120000 } );
	await fp.locator( '.wp-block-wp-free-charts-table' ).first().screenshot( { path: file } );
	const labels = await fp.evaluate( () => [ ...document.querySelectorAll( '.wfc-table__table tbody tr:first-child td' ) ].map( ( td ) => td.dataset.label ) );
	await fp.close();
	return labels;
};

try {
	for ( const id of oldPosts ) {
		await openEditor( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit` );
		await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
		check( `post ${ id } (older build) still valid`, ( await tableBlocks() ).every( ( b ) => b.valid ) );
	}

	// ── Legacy 2.0.x table: valid via deprecation, upgraded on save ──
	await openEditor( `${ BASE }/wp-admin/post.php?post=${ legacyId }&action=edit` );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	check( 'legacy 2.0.x table opens without "unexpected content"', ( await tableBlocks() ).every( ( b ) => b.valid ) );
	const link = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	const before = await phoneShot( link, `${ OUT }/01-legacy-phone-before-resave.png` );
	log( 'labels before re-save:', JSON.stringify( before ) );
	// Any edit + save writes the new markup (WordPress only re-serialises edited content).
	await page.evaluate( () => {
		const b = wp.data.select( 'core/block-editor' ).getBlocks().find( ( x ) => x.name === 'wp-free-charts/table' );
		wp.data.dispatch( 'core/block-editor' ).updateBlockAttributes( b.clientId, { striped: ! b.attributes.striped } );
		wp.data.dispatch( 'core/block-editor' ).updateBlockAttributes( b.clientId, { striped: b.attributes.striped } );
	} );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { title: 'Legacy 2.0.1 table (re-saved)' } ) );
	await save();
	const after = await phoneShot( link, `${ OUT }/02-legacy-phone-after-resave.png` );
	log( 'labels after re-save:', JSON.stringify( after ) );
	check( 'after re-save, card labels keep header line breaks', after.some( ( l ) => l?.includes( '\n' ) ), JSON.stringify( after ) );
	await openEditor( `${ BASE }/wp-admin/post.php?post=${ legacyId }&action=edit` );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	check( 'upgraded table valid after reload', ( await tableBlocks() ).every( ( b ) => b.valid ) );

	// ── New table with a thick coloured outer border ──
	await openEditor( `${ BASE }/wp-admin/post-new.php` );
	await page.waitForTimeout( 1000 );
	for ( const btn of await page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' ).all() ) await btn.click().catch( () => {} );
	await page.evaluate( () => {
		const c = ( content, extra = {} ) => ( { content, ...extra } );
		const block = wp.blocks.createBlock( 'wp-free-charts/table', {
			cells: [
				[ c( 'Name' ), c( 'Hours<br>per week' ), c( 'Contact<br><em>email or phone</em>' ) ],
				[ c( 'Alex' ), c( '30', { align: 'right' } ), c( 'alex@example.org' ) ],
				[ c( 'Sam' ), c( '37.5', { align: 'right' } ), c( '01234 567890' ) ],
			],
			mobileLayout: 'stack',
			striped: true,
			headerBg: '#000', headerBgSlug: 'contrast', headerColor: '#fff', headerColorSlug: 'base',
			outerBorderColor: '#503AA8', outerBorderColorSlug: 'accent-3', outerBorderWidth: '3px',
			style: { border: { radius: '10px' } },
		} );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( block.clientId );
		wp.data.dispatch( 'core/editor' ).editPost( { title: 'Outer border test', status: 'publish' } );
	} );
	await save();
	const newLink = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	const html    = await page.evaluate( () => wp.data.select( 'core/editor' ).getEditedPostContent() );
	check( 'outer border saved as CSS variables', /--wfc-outer-border-color:var\(--wp--preset--color--accent-3\);--wfc-outer-border-width:3px/.test( html ) );

	// Editor view: the frame should be visible around the data cells.
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( '[data-cell="1-1"]' ).click();
	await canvas.locator( '.wp-block-wp-free-charts-table' ).screenshot( { path: `${ OUT }/03-editor.png` } );
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	const panel = page.locator( '.components-panel__body', { hasText: 'Borders & spacing' } );
	await panel.locator( 'button' ).first().click();
	await panel.screenshot( { path: `${ OUT }/04-borders-panel.png` } );

	// Front end.
	const fp = await context.newPage();
	await fp.setViewportSize( { width: 1200, height: 900 } );
	await fp.goto( newLink, { waitUntil: 'load', timeout: 120000 } );
	await fp.locator( '.wp-block-wp-free-charts-table' ).first().screenshot( { path: `${ OUT }/05-front-desktop.png` } );
	const frame = await fp.evaluate( () => {
		const s = getComputedStyle( document.querySelector( '.wfc-table__table' ), '::after' );
		const td = getComputedStyle( document.querySelector( '.wfc-table__table tbody td' ) );
		return { frame: `${ s.borderTopWidth } ${ s.borderTopColor }`, cell: `${ td.borderBottomWidth } ${ td.borderBottomColor }` };
	} );
	check( 'desktop: outer frame 3px, cells keep their own border', frame.frame.startsWith( '3px' ) && ! frame.cell.startsWith( '3px' ), JSON.stringify( frame ) );
	await fp.close();
	const labels = await phoneShot( newLink, `${ OUT }/06-front-phone.png` );
	const cards = await ( async () => {
		const p = await context.newPage();
		await p.setViewportSize( { width: 390, height: 1400 } );
		await p.goto( newLink, { waitUntil: 'load', timeout: 120000 } );
		const v = await p.evaluate( () => getComputedStyle( document.querySelector( '.wfc-table__table tbody tr' ) ).borderTopWidth );
		await p.close();
		return v;
	} )();
	check( 'phone: cards framed with the outer border', cards === '3px', cards );
	check( 'phone: new table labels keep line breaks', labels.filter( Boolean ).every( ( l, i ) => i === 0 || l.includes( '\n' ) ), JSON.stringify( labels ) );
} catch ( e ) {
	failures++;
	log( 'FAILED:', e.message.split( '\n' ).slice( 0, 4 ).join( '\n' ) );
	await page.screenshot( { path: `${ OUT }/zz-failure.png` } ).catch( () => {} );
} finally {
	log( 'console errors:', errors.length ? '\n  ' + errors.join( '\n  ' ) : 'none' );
	log( failures ? `${ failures } FAILURE(S)` : 'ALL PASSED' );
	await browser.close();
}
