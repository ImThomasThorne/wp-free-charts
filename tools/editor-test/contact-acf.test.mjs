// Test of contact items that read a custom field (ACF / post meta).
// 1. Start WordPress with ACF and test content (leave it running):
//      npx @wp-playground/cli@latest server --port=9400 --mount-dir "C:\Git Repos\wp-free-charts" /wordpress/wp-content/plugins/wp-free-charts --blueprint=tools/editor-test/blueprint-acf.json --login
//    (acf/fields.php + acf/setup.php create the fields, values and the "ACF contact test" post.)
// 2. From the playwright-core scratch folder: node contact-acf.test.mjs <outDir>
// Checks the front end (post, options page, author, plain meta, Query Loop, and that protected
// meta / raw options / raw user meta stay hidden) and the editor (placeholders, sidebar, validity).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT  = process.argv[ 2 ];
const BASE = 'http://127.0.0.1:9400';
fs.mkdirSync( OUT, { recursive: true } );
const log = ( ...a ) => console.log( '[test]', ...a );
let failures = 0;
const check = ( label, ok, detail = '' ) => {
	if ( ! ok ) failures++;
	log( ok ? 'PASS' : 'FAIL', label, detail );
};

const browser = await chromium.launch( { channel: 'msedge', headless: true } );
const context = await browser.newContext( { viewport: { width: 1400, height: 1000 } } );
const page    = await context.newPage();
page.setDefaultTimeout( 20000 );
const errors = [];
page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );

try {
	// Front end.
	await page.goto( `${ BASE }/?name=acf-contact-test`, { waitUntil: 'load', timeout: 120000 } );
	const rows = await page.evaluate( () => [ ...document.querySelectorAll( '.wp-block-wp-free-charts-contact-details' ) ].map( ( row ) =>
		[ ...row.querySelectorAll( 'a' ) ].map( ( a ) => ( { href: a.getAttribute( 'href' ), text: a.textContent.trim() } ) ) ) );
	const html = await page.content();
	fs.writeFileSync( `${ OUT }/front.json`, JSON.stringify( rows, null, 2 ) );
	const [ main, blocked, ...loop ] = rows;
	const find = ( href ) => main.find( ( i ) => i.href === href );
	check( 'ACF field on this post (email)', find( 'mailto:me@example.com' )?.text === 'me@example.com' );
	check( 'ACF field on this post (phone)', find( 'tel:+442079460000' )?.text === '+44 20 7946 0000' );
	check( 'ACF Options page field', !! find( 'tel:08001234567' ) );
	check( 'ACF field on the author, with display text', find( 'tel:07700900123' )?.text === 'Call the author' );
	check( 'plain post meta (no ACF field)', !! find( 'mailto:plain@example.com' ) );
	check( 'protected meta, raw options and raw user meta stay hidden',
		blocked.length === 0 && ! /leak@|raw-option@|raw-user@|admin@/.test( html ), JSON.stringify( blocked ) );
	const loopEmails = loop.map( ( r ) => r[ 0 ]?.href );
	// The loop's search ("Staff member") also matches this test post, whose content contains it.
	check( 'Query Loop: each post shows its own field',
		JSON.stringify( loopEmails ) === '["mailto:me@example.com","mailto:ann@example.com","mailto:bob@example.com"]', JSON.stringify( loopEmails ) );
	await page.screenshot( { path: `${ OUT }/01-front.png`, fullPage: true } );

	// Editor.
	const id = await page.evaluate( () => document.body.className.match( /postid-(\d+)/ )?.[ 1 ] );
	await page.goto( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' )?.getBlocks().length > 0, null, { timeout: 120000 } );
	await page.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
	const close = page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' );
	await close.first().waitFor( { timeout: 3000 } ).then( () => close.first().click() ).catch( () => {} );
	const valid = await page.evaluate( () => {
		const be = wp.data.select( 'core/block-editor' );
		return be.getClientIdsWithDescendants().map( ( c ) => be.getBlock( c ) ).filter( ( b ) => b.name.startsWith( 'wp-free-charts' ) ).every( ( b ) => b.isValid );
	} );
	check( 'blocks valid in the editor', valid );
	const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
	const placeholder = await canvas.locator( '.wfc-contact-item__field' ).first().textContent();
	check( 'editor shows the field name', placeholder === 'Field: staff_email', placeholder );
	await canvas.locator( '.wp-block-wp-free-charts-contact-item' ).first().click();
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	await page.waitForTimeout( 500 );
	const selects = await page.locator( '.block-editor-block-inspector select' ).evaluateAll( ( s ) => s.map( ( x ) => x.value ) );
	check( 'sidebar shows Type, Source and Field belongs to', JSON.stringify( selects ) === '["email","field","post"]', JSON.stringify( selects ) );
	await page.screenshot( { path: `${ OUT }/02-editor.png` } );

	// Switching back to "Typed in" shows the typed-value field again.
	await page.locator( '.block-editor-block-inspector select' ).nth( 1 ).selectOption( 'manual' );
	const hasEmailField = await page.locator( '.block-editor-block-inspector input[type="email"]' ).count();
	check( 'Typed in shows the email field', hasEmailField === 1 );

	check( 'no page errors', errors.length === 0, errors.join( ' | ' ) );
} catch ( e ) {
	failures++;
	log( 'ERROR', e.stack );
	await page.screenshot( { path: `${ OUT }/error.png` } ).catch( () => {} );
}
await browser.close();
log( failures ? `${ failures } FAILED` : 'ALL PASSED' );
process.exit( failures ? 1 : 0 );
