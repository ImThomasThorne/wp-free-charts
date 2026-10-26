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
	check( 'Group sub-fields (contact.email / contact.phone)', !! find( 'mailto:group@example.com' ) && !! find( 'tel:01111222333' ) );
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
	// The editor shows the value each field gives (fetched from the server).
	// Wait until the Query Loop items have loaded (Playground answers slowly).
	await page.frameLocator( 'iframe[name="editor-canvas"]' ).locator( 'text=bob@example.com' ).first().waitFor( { timeout: 90000 } ).catch( () => {} );
	const shown = await canvas.locator( '.wp-block-wp-free-charts-contact-item .wfc-contact-item__text' ).allTextContents();
	log( 'editor texts:', JSON.stringify( shown ) );
	check( 'editor shows the real field values', shown[ 0 ] === 'me@example.com' && shown[ 5 ] === 'group@example.com', `${ shown[ 0 ] } / ${ shown[ 5 ] }` );
	check( 'Query Loop items in the editor show their own value', shown.includes( 'ann@example.com' ) && shown.includes( 'bob@example.com' ) );

	// Select item n (in document order) and return the sidebar notice.
	const noticeFor = async ( n ) => {
		await page.evaluate( ( i ) => {
			const be  = wp.data.select( 'core/block-editor' );
			const ids = be.getClientIdsWithDescendants().filter( ( c ) => be.getBlockName( c ) === 'wp-free-charts/contact-item' );
			wp.data.dispatch( 'core/block-editor' ).selectBlock( ids[ i ] );
		}, n );
		await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
		const notice = page.locator( '.block-editor-block-inspector .components-notice__content' );
		await notice.first().waitFor( { timeout: 30000 } ).catch( () => {} );
		return ( await notice.count() ) ? ( await notice.first().textContent() ) : '';
	};
	const missing = await noticeFor( 11 );
	check( 'missing field explains why', missing.includes( 'No field called "missing_field"' ), missing );
	const group = await noticeFor( 13 );
	check( 'Group field suggests its sub-fields', group.includes( 'contact.email' ) && group.includes( 'contact.phone' ), group );
	await page.screenshot( { path: `${ OUT }/03-editor-group-hint.png` } );
	const priv = await noticeFor( 7 );
	check( 'protected name is refused in the editor too', priv.includes( "can't start with" ), priv );

	// The preview route is closed to visitors.
	const anon = await browser.newContext();
	// Playground's --login redirects visitors (turning the POST into a GET), so the
	// status varies (401/404); what matters is that no field value comes back.
	const res  = await anon.request.post( `${ BASE }/?rest_route=/wp-free-charts/v1/contact-fields`, { data: { lookups: [ { field: 'staff_email', from: 'post', post_id: Number( id ) } ] } } );
	const body = await res.text();
	check( 'preview route gives visitors nothing', res.status() >= 400 && ! body.includes( 'me@example.com' ), `${ res.status() } ${ body.slice( 0, 120 ) }` );
	await anon.close();

	await noticeFor( 0 );
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
