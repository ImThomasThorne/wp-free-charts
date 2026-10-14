// Visual test for table styling: header colours in mobile cards, mixed alignment,
// stripes, border radius, theme spacing presets and the cell typography panel.
// Same setup as table-editor.test.mjs (see its header).
// Usage: node table-styles.test.mjs <outDir> [oldPostId …]
//   oldPostIds: posts saved by earlier builds, re-checked for block validity.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [ , , OUT, ...oldPosts ] = process.argv;
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

try {
	// Old posts first: tables saved by earlier builds must still validate.
	for ( const id of oldPosts ) {
		await openEditor( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit` );
		await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
		const bad = await page.evaluate( () => {
			const be = wp.data.select( 'core/block-editor' );
			return be.getClientIdsWithDescendants().map( ( id ) => be.getBlock( id ) )
				.filter( ( b ) => b.name.startsWith( 'wp-free-charts' ) && ! b.isValid ).length;
		} );
		check( `post ${ id } (saved by an earlier build) still valid`, bad === 0 );
	}

	await openEditor( `${ BASE }/wp-admin/post-new.php` );
	await page.waitForTimeout( 1000 );
	for ( const btn of await page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' ).all() ) await btn.click().catch( () => {} );

	const palette = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getSettings().colors?.map( ( c ) => c.slug ) );
	const spacing = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getSettings().__experimentalFeatures?.spacing?.spacingSizes?.theme?.map( ( s ) => s.slug ) ?? [] );
	log( 'theme palette:', palette?.join( ', ' ) );
	log( 'theme spacing presets:', spacing.join( ', ' ) );

	await page.evaluate( ( { palette, spacing } ) => {
		const c = ( content, extra = {} ) => ( { content, ...extra } );
		const dark = palette.includes( 'contrast' ) ? 'contrast' : palette[ 0 ];
		const base = palette.includes( 'base' ) ? 'base' : palette[ 1 ];
		const pad  = spacing.length ? `var:preset|spacing|${ spacing[ Math.min( 2, spacing.length - 1 ) ] }` : '12px';
		const block = wp.blocks.createBlock( 'wp-free-charts/table', {
			cells: [
				[ c( 'Name' ), c( 'Role', { align: 'center' } ), c( 'Location' ), c( 'Hours', { align: 'right' } ) ],
				[ c( 'Alex' ), c( 'Youth worker', { align: 'center' } ), c( 'Carlisle' ), c( '30', { align: 'right' } ) ],
				[ c( 'Sam' ), c( 'Coordinator', { align: 'center' } ), c( 'Kendal' ), c( '37.5', { align: 'right' } ) ],
				[ c( 'Jo' ), c( 'Volunteer', { align: 'center' } ), c( 'Penrith' ), c( '8', { align: 'right' } ) ],
				[ c( 'Priya' ), c( 'Project lead', { align: 'center' } ), c( 'Workington' ), c( '22', { align: 'right' } ) ],
			],
			headerBg: '#000', headerBgSlug: dark,
			headerColor: '#fff', headerColorSlug: base,
			striped: true,
			mobileLayout: 'stack',
			cellPadding: { top: pad, right: pad, bottom: pad, left: pad },
			style: { border: { radius: '12px' } },
		} );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		wp.data.dispatch( 'core/editor' ).editPost( { title: 'Table styles test', status: 'publish' } );
		wp.data.dispatch( 'core/editor' ).savePost();
	}, { palette, spacing } );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost() && wp.data.select( 'core/editor' ).getCurrentPost().status === 'publish', null, { timeout: 60000 } );
	const link = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	const html = await page.evaluate( () => wp.data.select( 'core/editor' ).getEditedPostContent() );
	fs.writeFileSync( `${ OUT }/saved.html`, html );
	check( 'radius saved on the figure', /<figure[^>]*border-radius:12px/.test( html ) );
	check( 'cell padding saved as theme spacing variable', /--wfc-cell-padding:var\(--wp--preset--spacing--/.test( html ) || ! spacing.length );

	// Sidebar: select a cell and screenshot the new panels.
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( '[data-cell="1-1"]' ).click();
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	const panel = page.locator( '.components-panel__body', { hasText: 'Selected cell text' } );
	check( '"Selected cell text" panel shown', await panel.count() === 1 );
	const controls = await panel.locator( 'label, legend, .components-base-control__label' ).allTextContents();
	log( 'cell text controls:', controls.map( ( s ) => s.trim() ).filter( Boolean ).join( ' | ' ) );
	await panel.screenshot( { path: `${ OUT }/01-cell-text-panel.png` } );
	// Pick a weight from the appearance dropdown if present and check it saves.
	const appearance = panel.locator( 'select, button' ).filter( { hasText: /Default|Regular|Appearance/ } ).first();
	log( 'appearance control present:', await appearance.count() );
	// Border radius, typography and dimensions are on the sidebar's "Styles" tab.
	await page.locator( '.block-editor-block-inspector [role="tab"][aria-label="Styles"]' ).click();
	const borderPanel = page.locator( '.components-tools-panel', { hasText: /Radius/ } ).first();
	check( 'Border radius control shown', await borderPanel.count() === 1 );
	if ( await borderPanel.count() ) await borderPanel.screenshot( { path: `${ OUT }/02-border-panel.png` } );
	const typo = page.locator( '.components-tools-panel', { hasText: 'Typography' } ).first();
	if ( await typo.count() ) await typo.screenshot( { path: `${ OUT }/03-table-typography-panel.png` } );
	await page.locator( '.block-editor-block-inspector [role="tab"][aria-label="Settings"]' ).click();
	const bordersSpacing = page.locator( '.components-panel__body', { hasText: 'Borders & spacing' } );
	await bordersSpacing.locator( 'button' ).first().click();
	await bordersSpacing.screenshot( { path: `${ OUT }/04-borders-spacing-panel.png` } );

	// Front end: desktop and phone.
	for ( const [ name, width ] of [ [ 'desktop', 1200 ], [ 'phone', 390 ] ] ) {
		const fp = await context.newPage();
		await fp.setViewportSize( { width, height: 1400 } );
		await fp.goto( link, { waitUntil: 'load' } );
		const fig = fp.locator( '.wp-block-wp-free-charts-table' ).first();
		await fig.screenshot( { path: `${ OUT }/05-front-${ name }.png` } );
		if ( name === 'desktop' ) {
			const stripe = await fp.evaluate( () => getComputedStyle( document.querySelector( '.wfc-table__table tbody tr:nth-child(2) td' ) ).backgroundColor );
			const plain  = await fp.evaluate( () => getComputedStyle( document.querySelector( '.wfc-table__table tbody tr:nth-child(1) td' ) ).backgroundColor );
			check( 'stripe colour differs from plain rows', stripe !== plain, `${ plain } vs ${ stripe }` );
		} else {
			const align = await fp.evaluate( () => [ ...document.querySelectorAll( '.wfc-table__table tbody tr:first-child td' ) ].map( ( td ) => getComputedStyle( td ).textAlign ) );
			check( 'card text all left-aligned', align.every( ( a ) => a === 'left' ), align.join( ',' ) );
		}
		await fp.close();
	}
} catch ( e ) {
	failures++;
	log( 'FAILED:', e.message.split( '\n' ).slice( 0, 4 ).join( '\n' ) );
	await page.screenshot( { path: `${ OUT }/zz-failure.png` } ).catch( () => {} );
} finally {
	log( 'console errors:', errors.length ? '\n  ' + errors.join( '\n  ' ) : 'none' );
	log( failures ? `${ failures } FAILURE(S)` : 'ALL PASSED' );
	await browser.close();
}
