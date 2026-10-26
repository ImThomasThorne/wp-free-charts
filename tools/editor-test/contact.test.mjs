// End-to-end test of the Contact Details block. Same setup as table-editor.test.mjs (see its header).
// Usage: node contact.test.mjs <outDir>
// Inserts the block (checks the email + phone template), types an address in the canvas, adds
// button-style and icon-only rows, publishes, reloads (blocks must stay valid), and checks the
// front-end links, text, accessible names, escaping and side-by-side layout. Prints PASS/FAIL
// and saves screenshots.
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
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) errors.push( m.text() ); } );
page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );

const openEditor = async ( url ) => {
	await page.goto( url, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await page.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' ), null, { timeout: 120000 } );
	await page.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
	// A fresh site may still show the welcome modal; close it if it's there.
	const close = page.locator( '.components-modal__screen-overlay button[aria-label="Close"]' );
	await close.first().waitFor( { timeout: 3000 } ).then( () => close.first().click() ).catch( () => {} );
};
const ours = () => page.evaluate( () => {
	const be = wp.data.select( 'core/block-editor' );
	return be.getClientIdsWithDescendants().map( ( id ) => be.getBlock( id ) )
		.filter( ( b ) => b.name.startsWith( 'wp-free-charts/contact' ) )
		.map( ( b ) => ( { name: b.name, valid: b.isValid, attrs: b.attributes } ) );
} );
const canvas = () => page.frameLocator( 'iframe[name="editor-canvas"]' );

try {
	await openEditor( `${ BASE }/wp-admin/post-new.php` );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { title: 'Contact details test' } ) );

	// 1. Inserting the parent creates an email + phone item from the template.
	await page.evaluate( () => wp.data.dispatch( 'core/block-editor' ).insertBlocks( wp.blocks.createBlock( 'wp-free-charts/contact-details' ) ) );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ]?.innerBlocks.length === 2 );
	const types = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ].innerBlocks.map( ( b ) => b.attributes.type ) );
	check( 'template inserts email + phone', JSON.stringify( types ) === '["email","phone"]', JSON.stringify( types ) );

	// 2. Type into the canvas: first item edits its email address.
	const first = canvas().locator( '.wp-block-wp-free-charts-contact-item .wfc-contact-item__text' ).first();
	await first.click();
	await page.keyboard.type( 'hello@example.com' );
	const second = canvas().locator( '.wp-block-wp-free-charts-contact-item .wfc-contact-item__text' ).nth( 1 );
	await second.click();
	await page.keyboard.type( '+44 (0)1234 567 890' );
	const typed = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ].innerBlocks.map( ( b ) => b.attributes.value ) );
	check( 'typing in the canvas sets the values', typed[ 0 ] === 'hello@example.com' && typed[ 1 ] === '+44 (0)1234 567 890', JSON.stringify( typed ) );

	// 2b. Sidebar: no variation buttons under the block card; the Type dropdown switches the item.
	await first.click();
	await page.evaluate( () => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ) );
	await page.waitForTimeout( 500 );
	check( 'no Email/Phone buttons under the block card', ( await page.locator( '.block-editor-block-variation-transforms' ).count() ) === 0 );
	const typeSelect = page.locator( '.block-editor-block-inspector select' ).first();
	const optionsTxt = await typeSelect.locator( 'option' ).allTextContents();
	check( 'Type dropdown lists the types', JSON.stringify( optionsTxt ) === '["Email","Phone"]', JSON.stringify( optionsTxt ) );
	await page.screenshot( { path: `${ OUT }/00-sidebar.png` } );
	await page.locator( '.block-editor-block-card' ).screenshot( { path: `${ OUT }/00-block-card.png` } );
	await typeSelect.selectOption( 'phone' );
	const switched = await page.evaluate( () => wp.data.select( 'core/block-editor' ).getBlocks()[ 0 ].innerBlocks[ 0 ].attributes.type );
	check( 'dropdown changes the type', switched === 'phone', switched );
	await typeSelect.selectOption( 'email' );
	// Block icons in the editor UI must not render as solid boxes (fill forced by core CSS).
	const cardFill = await page.evaluate( () => {
		const p = document.querySelector( '.block-editor-block-card svg path[fill-rule="evenodd"]' );
		return p ? getComputedStyle( p ).fillRule : 'missing';
	} );
	check( 'block card icon is a filled frame (evenodd)', cardFill === 'evenodd', cardFill );

	// 3. More rows: button style with display text, icon-only, and hostile input.
	await page.evaluate( () => {
		const { createBlock } = wp.blocks;
		const item = ( a ) => createBlock( 'wp-free-charts/contact-item', a );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( [
			createBlock( 'wp-free-charts/contact-details', {}, [
				item( { type: 'email', value: 'sales@example.com', label: 'Email sales', className: 'is-style-button' } ),
				item( { type: 'phone', value: '01234 567890', label: 'Call us', className: 'is-style-button' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', { showText: false }, [
				item( { type: 'email', value: 'hello@example.com' } ),
				item( { type: 'phone', value: '01234 567890' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', { className: 'xss-row' }, [
				item( { type: 'email', value: 'x@example.com', label: '&lt;img src=x onerror=alert(1)&gt;' } ),
				item( { type: 'phone', value: 'javascript:alert(1)' } ),
				item( { type: 'email', value: '' } ),
			] ),
		] );
	} );
	await page.waitForTimeout( 800 );
	await page.screenshot( { path: `${ OUT }/01-editor.png` } );

	// Icon-only in the editor hides the text.
	const iconOnlyText = await canvas().locator( '.wp-block-wp-free-charts-contact-details' ).nth( 2 ).locator( '.wfc-contact-item__text' ).count();
	check( 'icon-only row has no text in the editor', iconOnlyText === 0 );
	const btnClass = await canvas().locator( '.wp-block-wp-free-charts-contact-item.is-style-button' ).first().getAttribute( 'class' );
	check( 'button style gets wp-element-button in the editor', btnClass.includes( 'wp-element-button' ), btnClass );

	// 4. Publish, reload, still valid.
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { status: 'publish' } ) );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost(), null, { timeout: 60000 } );
	const id   = await page.evaluate( () => wp.data.select( 'core/editor' ).getCurrentPostId() );
	const link = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	await openEditor( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit` );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	const blocks = await ours();
	check( 'all contact blocks valid after reload', blocks.length === 13 && blocks.every( ( b ) => b.valid ), `${ blocks.length } blocks` );

	// 5. Front end.
	const fp = await context.newPage();
	await fp.goto( link, { waitUntil: 'load', timeout: 120000 } );
	const rows = await fp.evaluate( () => [ ...document.querySelectorAll( '.wp-block-wp-free-charts-contact-details' ) ].map( ( row ) => ( {
		cls: row.className,
		display: getComputedStyle( row ).display,
		items: [ ...row.querySelectorAll( 'a' ) ].map( ( a ) => ( {
			href: a.getAttribute( 'href' ),
			text: a.textContent.trim(),
			aria: a.getAttribute( 'aria-label' ),
			cls: a.className,
			svg: !! a.querySelector( 'svg' ),
			top: Math.round( a.getBoundingClientRect().top ),
		} ) ),
		html: row.innerHTML,
	} ) ) );
	fs.writeFileSync( `${ OUT }/front.json`, JSON.stringify( rows, null, 2 ) );
	const [ r1, r2, r3, r4 ] = rows;
	check( 'rows use flex layout', rows.every( ( r ) => r.display === 'flex' && r.cls.includes( 'is-layout-flex' ) ) );
	check( 'items sit side by side', r1.items[ 0 ].top === r1.items[ 1 ].top, JSON.stringify( r1.items.map( ( i ) => i.top ) ) );
	check( 'email link', r1.items[ 0 ].href === 'mailto:hello@example.com' && r1.items[ 0 ].text === 'hello@example.com' && r1.items[ 0 ].svg );
	check( 'phone link keeps + and drops formatting', r1.items[ 1 ].href === 'tel:+4401234567890' && r1.items[ 1 ].text === '+44 (0)1234 567 890', r1.items[ 1 ].href );
	check( 'display text replaces the address', r2.items[ 0 ].text === 'Email sales' && r2.items[ 1 ].text === 'Call us' );
	check( 'button style uses theme button class', r2.items.every( ( i ) => i.cls.includes( 'wp-element-button' ) ) );
	check( 'icon-only: no text, accessible name', r3.items[ 0 ].text === '' && r3.items[ 0 ].aria === 'Email hello@example.com' && r3.items[ 1 ].aria === 'Call 01234 567890' );
	check( 'label HTML is escaped', ! r4.html.includes( '<img' ) && r4.items[ 0 ].text === '<img src=x onerror=alert(1)>', r4.items[ 0 ].text );
	check( 'no javascript: links', r4.items.every( ( i ) => /^(mailto|tel):/.test( i.href ) ), JSON.stringify( r4.items.map( ( i ) => i.href ) ) );
	check( 'empty item outputs nothing', r4.items.length === 2, `${ r4.items.length } links` );
	// Icons still draw when a theme forces svg fill/stroke.
	await fp.addStyleTag( { content: 'svg { fill: none; stroke: red; }' } );
	const iconPaint = await fp.evaluate( () => [ ...document.querySelectorAll( '.wfc-contact-item__icon' ) ].slice( 0, 2 ).map( ( s ) => getComputedStyle( s ).fill + ' / ' + getComputedStyle( s ).stroke ) );
	check( 'front-end icons are filled with the text colour', iconPaint.every( ( p ) => p.startsWith( 'rgb' ) && p.endsWith( 'none' ) ), JSON.stringify( iconPaint ) );
	await fp.reload( { waitUntil: 'load' } );

	await fp.locator( '.wp-block-wp-free-charts-contact-details' ).first().screenshot( { path: `${ OUT }/02-front-row1.png` } );
	await fp.evaluate( () => document.querySelector( '.wp-block-wp-free-charts-contact-details' ).parentElement.scrollIntoView() );
	await fp.screenshot( { path: `${ OUT }/03-front-desktop.png`, fullPage: true } );
	await fp.setViewportSize( { width: 390, height: 1400 } );
	await fp.screenshot( { path: `${ OUT }/04-front-phone.png`, fullPage: true } );
	await fp.close();

	check( 'no console errors', errors.length === 0, errors.join( ' | ' ) );
} catch ( e ) {
	failures++;
	log( 'ERROR', e.stack );
	await page.screenshot( { path: `${ OUT }/error.png` } ).catch( () => {} );
}
await browser.close();
log( failures ? `${ failures } FAILED` : 'ALL PASSED' );
process.exit( failures ? 1 : 0 );
