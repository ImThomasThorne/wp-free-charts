// Saving posts that contain contact blocks must return clean JSON ("Updating failed.
// The response is not a valid JSON response" otherwise). Run against blueprint-acf-debug.json,
// which turns on WP_DEBUG_DISPLAY so any PHP warning lands in the response:
//   npx @wp-playground/cli@latest server --port=9400 --php=7.4 --mount-dir "C:\Git Repos\wp-free-charts" /wordpress/wp-content/plugins/wp-free-charts --blueprint=tools/editor-test/blueprint-acf-debug.json --login
//   node contact-save.test.mjs <outDir>
// Saves: the ACF test post (fields, Query Loop), a new post with typed-in items, and a new post
// with field items that point at nothing. Prints any non-JSON save response.
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
const page    = await ( await browser.newContext( { viewport: { width: 1400, height: 1000 } } ) ).newPage();
page.setDefaultTimeout( 30000 );

// Record every REST response the editor gets that isn't valid JSON, and count
// contact preview requests (they should be batched into one).
const bad = [];
let previewRequests = 0;
page.on( 'response', async ( res ) => {
	const url = res.url();
	if ( ! /wp-json|rest_route/.test( url ) ) return;
	if ( url.includes( 'wp-free-charts/v1/contact-field' ) ) previewRequests++;
	const body = await res.text().catch( () => '' );
	try {
		JSON.parse( body );
	} catch ( e ) {
		bad.push( { url, status: res.status(), body: body.slice( 0, 1500 ) } );
	}
} );

const openEditor = async ( url ) => {
	await page.goto( url, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' ), null, { timeout: 120000 } );
	await page.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
};
const save = async ( label ) => {
	const before = bad.length;
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost(), null, { timeout: 90000 } );
	await page.waitForTimeout( 1500 );
	const failed = await page.evaluate( () => wp.data.select( 'core/editor' ).didPostSaveRequestFail() );
	const notices = await page.evaluate( () => wp.data.select( 'core/notices' ).getNotices().map( ( n ) => n.content ).join( ' | ' ) );
	check( `save: ${ label }`, ! failed && bad.length === before, notices );
};

try {
	// Changing wp-config (debug consts) breaks Playground's auto-login, so log in by hand.
	await page.goto( `${ BASE }/wp-login.php`, { waitUntil: 'load', timeout: 120000 } );
	if ( await page.locator( '#user_login' ).count() ) {
		await page.fill( '#user_login', 'admin' );
		await page.fill( '#user_pass', 'password' );
		await Promise.all( [ page.waitForNavigation( { timeout: 120000 } ), page.click( '#wp-submit' ) ] );
	}

	// 1. The ACF test post (every kind of field item + Query Loop).
	await page.goto( `${ BASE }/?name=acf-contact-test`, { waitUntil: 'load', timeout: 120000 } );
	fs.writeFileSync( `${ OUT }/front.html`, await page.content() );
	const id = await page.evaluate( () => document.body.className.match( /postid-(\d+)/ )?.[ 1 ] );
	await openEditor( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit` );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	await page.frameLocator( 'iframe[name="editor-canvas"]' ).locator( 'text=bob@example.com' ).first().waitFor( { timeout: 90000 } ).catch( () => {} );
	// 18 field items on this post. Batched: one request, plus one for the Query
	// Loop's previews, which mount a little later (not one request per item).
	check( 'editor previews are batched', previewRequests >= 1 && previewRequests <= 3, `${ previewRequests } requests` );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { title: 'ACF contact test (saved)' } ) );
	await save( 'ACF test post' );

	// 2. New post, typed-in items.
	await openEditor( `${ BASE }/wp-admin/post-new.php` );
	await page.evaluate( () => {
		const { createBlock } = wp.blocks;
		wp.data.dispatch( 'core/editor' ).editPost( { title: 'Typed contact', status: 'publish' } );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( createBlock( 'wp-free-charts/contact-details', {}, [
			createBlock( 'wp-free-charts/contact-item', { type: 'email', value: 'a@example.com' } ),
			createBlock( 'wp-free-charts/contact-item', { type: 'phone', value: '01234 567890' } ),
		] ) );
	} );
	await save( 'new post, typed-in items' );

	// 3. New post, field items that point at nothing / at another source.
	await openEditor( `${ BASE }/wp-admin/post-new.php` );
	await page.evaluate( () => {
		const { createBlock } = wp.blocks;
		const f = ( a ) => createBlock( 'wp-free-charts/contact-item', { source: 'field', ...a } );
		wp.data.dispatch( 'core/editor' ).editPost( { title: 'Field contact', status: 'draft' } );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( createBlock( 'wp-free-charts/contact-details', {}, [
			f( { field: 'staff_email' } ), f( { field: 'nothing_here' } ), f( { field: 'contact.email' } ),
			f( { field: 'office_phone', fieldFrom: 'option', type: 'phone' } ), f( { field: 'user_phone', fieldFrom: 'author', type: 'phone' } ),
			f( { field: '' } ),
		] ) );
	} );
	await page.waitForTimeout( 3000 );
	await save( 'new draft, field items' );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { status: 'publish' } ) );
	await save( 'publish it' );

	const php = /(Warning|Notice|Deprecated|Fatal error|Parse error)<\/b>:|(Warning|Notice|Deprecated|Fatal error): /;
	const front = fs.readFileSync( `${ OUT }/front.html`, 'utf8' );
	check( 'front end has no PHP messages', ! php.test( front ), ( front.match( /.{0,200}(Warning|Notice|Deprecated|Fatal error).{0,300}/ ) || [ '' ] )[ 0 ] );
} catch ( e ) {
	failures++;
	log( 'ERROR', e.stack );
}
for ( const b of bad ) log( 'NON-JSON RESPONSE', b.status, b.url, '\n' + b.body );
await browser.close();
log( failures ? `${ failures } FAILED` : 'ALL PASSED' );
process.exit( failures ? 1 : 0 );
