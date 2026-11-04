// Test of the Image Swap block (front end + editor).
// 1. Start WordPress with test content (leave it running). With ACF:
//      npx @wp-playground/cli@latest server --port=9400 --mount-dir "C:\Git Repos\wp-free-charts" /wordpress/wp-content/plugins/wp-free-charts --blueprint=tools/editor-test/blueprint-image-swap.json --login
//    or without ACF (post meta only): --blueprint=tools/editor-test/blueprint-image-swap-noacf.json
// 2. From the playwright-core scratch folder: node image-swap.test.mjs <outDir>
// Checks: each Query Loop post shows its own two images, aspect ratio, mouse hover,
// tap (swap, swap back after the delay, second tap follows the link), keyboard focus,
// sources (featured, post meta, picked image, ACF URL), protected meta stays hidden,
// and the editor preview.
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
const wait = ( ms ) => new Promise( ( r ) => setTimeout( r, ms ) );

const browser = await chromium.launch( { channel: 'msedge', headless: true } );
const errors  = [];
const SEL     = '.wp-block-wp-free-charts-image-swap';
const hoverOpacity = ( page, i ) => page.locator( SEL ).nth( i ).evaluate( ( el ) => {
	const img = el.querySelector( '.wfc-image-swap__img--hover' );
	return img ? getComputedStyle( img ).opacity : 'none';
} );

try {
	// --- Desktop: markup, hover, keyboard.
	const desk = await browser.newContext( { viewport: { width: 1200, height: 900 } } );
	const page = await desk.newPage();
	page.setDefaultTimeout( 20000 );
	page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + e.message ) );
	await page.goto( `${ BASE }/?name=image-swap-test`, { waitUntil: 'load', timeout: 120000 } );

	const blocks = await page.locator( SEL ).evaluateAll( ( els ) => els.map( ( el ) => ( {
		tag: el.tagName,
		cls: el.className,
		style: el.getAttribute( 'style' ) || '',
		href: el.getAttribute( 'href' ),
		tabindex: el.getAttribute( 'tabindex' ),
		revert: el.dataset.revert,
		imgs: [ ...el.querySelectorAll( 'img' ) ].map( ( i ) => ( { src: i.getAttribute( 'src' ).split( '/' ).pop(), alt: i.getAttribute( 'alt' ), hidden: i.getAttribute( 'aria-hidden' ) } ) ),
		ratio: el.getBoundingClientRect().width / el.getBoundingClientRect().height,
	} ) ) );
	fs.writeFileSync( `${ OUT }/front.json`, JSON.stringify( blocks, null, 2 ) );
	const html = await page.content();
	check( 'five blocks rendered (3 loop + 2 single; protected one hidden)', blocks.length === 5, String( blocks.length ) );
	const [ ann, bob, cat, feat, picked ] = blocks;
	const srcs = ( b ) => b?.imgs.map( ( i ) => i.src.replace( /(-\d+x\d+)?\.png$/, '' ) ).join( ',' );
	check( 'Query Loop: Ann gets her own pro + fun photos', srcs( ann ) === 'ann-pro,ann-fun', srcs( ann ) );
	check( 'Query Loop: Bob gets his own pro + fun photos', srcs( bob ) === 'bob-pro,bob-fun', srcs( bob ) );
	check( 'no fun photo: main image only, no swap class', srcs( cat ) === 'cat-pro' && ! cat.cls.includes( 'has-hover-image' ), cat?.cls );
	check( 'linked to the post', ann.tag === 'A' && /swap-staff-ann/.test( ann.href || '' ), ann.href );
	check( 'aspect ratio 4/5 applied', /aspect-ratio:4\/5/.test( ann.style ) && Math.abs( ann.ratio - 0.8 ) < 0.02, `${ ann.style } ${ ann.ratio.toFixed( 3 ) }` );
	check( 'alt from the image; hover image hidden from screen readers', ann.imgs[ 0 ].alt === 'ann-pro alt' && ann.imgs[ 1 ].alt === '' && ann.imgs[ 1 ].hidden === 'true' );
	check( 'revert delay 3000ms on the element', ann.revert === '3000' );
	check( 'featured image -> post meta ID, square, 200px, instant', srcs( feat ) === 'featured,picked' && /width:200px/.test( feat.style ) && feat.cls.includes( 'is-instant' ) && Math.abs( feat.ratio - 1 ) < 0.02, `${ srcs( feat ) } ${ feat.style }` );
	check( 'unlinked block is focusable', feat.tag === 'DIV' && feat.tabindex === '0' );
	check( 'picked image -> ACF URL field (or meta URL)', srcs( picked ) === 'picked,urlpic', srcs( picked ) );
	check( 'protected meta stays hidden', ! /secret/.test( html ) );

	check( 'hover image hidden at rest', ( await hoverOpacity( page, 0 ) ) === '0' );
	await page.locator( SEL ).nth( 0 ).hover();
	await wait( 600 );
	check( 'mouse hover shows the fun photo', ( await hoverOpacity( page, 0 ) ) === '1' );
	await page.screenshot( { path: `${ OUT }/01-hover.png`, fullPage: true } );
	await page.mouse.move( 5, 5 );
	await wait( 600 );
	check( 'mouse leave swaps back', ( await hoverOpacity( page, 0 ) ) === '0' );

	// Keyboard: Tab until Ann's image link has focus.
	await page.locator( 'body' ).click( { position: { x: 2, y: 2 } } );
	let focused = false;
	for ( let i = 0; i < 40 && ! focused; i++ ) {
		await page.keyboard.press( 'Tab' );
		focused = await page.locator( SEL ).nth( 0 ).evaluate( ( el ) => el === document.activeElement );
	}
	await wait( 500 );
	check( 'keyboard focus swaps', focused && ( await page.locator( SEL ).nth( 0 ).evaluate( ( el ) => el.classList.contains( 'is-swapped' ) ) ) );
	await wait( 3000 );
	check( 'keyboard swap reverts after 3s', ! ( await page.locator( SEL ).nth( 0 ).evaluate( ( el ) => el.classList.contains( 'is-swapped' ) ) ) );
	await desk.close();

	// --- Phone: tap.
	const phone = await browser.newContext( { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } );
	const mob   = await phone.newPage();
	mob.on( 'pageerror', ( e ) => errors.push( 'pageerror (mobile): ' + e.message ) );
	await mob.goto( `${ BASE }/?name=image-swap-test`, { waitUntil: 'load', timeout: 120000 } );
	const first = mob.locator( SEL ).nth( 0 );
	await first.scrollIntoViewIfNeeded();
	await first.tap();
	await wait( 500 );
	check( 'tap swaps and does not follow the link', ( await first.evaluate( ( el ) => el.classList.contains( 'is-swapped' ) ) ) && /image-swap-test/.test( mob.url() ), mob.url() );
	check( 'swapped image is visible after tap', ( await hoverOpacity( mob, 0 ) ) === '1' );
	await mob.screenshot( { path: `${ OUT }/02-phone-tapped.png` } );
	await wait( 3000 );
	check( 'tap swap reverts after 3s', ! ( await first.evaluate( ( el ) => el.classList.contains( 'is-swapped' ) ) ) );
	await first.tap();
	await wait( 300 );
	await Promise.all( [ mob.waitForURL( /swap-staff-ann/, { timeout: 30000 } ).catch( () => {} ), first.tap() ] );
	check( 'second tap while swapped opens the post', /swap-staff-ann/.test( mob.url() ), mob.url() );
	await phone.close();

	// --- Editor.
	const ed  = await browser.newContext( { viewport: { width: 1400, height: 1000 } } );
	const edp = await ed.newPage();
	edp.on( 'pageerror', ( e ) => errors.push( 'pageerror (editor): ' + e.message ) );
	await edp.goto( `${ BASE }/?name=image-swap-test`, { waitUntil: 'load', timeout: 120000 } );
	const id = await edp.evaluate( () => document.body.className.match( /postid-(\d+)/ )?.[ 1 ] );
	await edp.goto( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit`, { waitUntil: 'domcontentloaded', timeout: 120000 } );
	await edp.waitForFunction( () => window.wp?.data?.select( 'core/block-editor' )?.getBlocks().length > 0, null, { timeout: 120000 } );
	await edp.evaluate( () => wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false ) );
	const close = edp.locator( '.components-modal__screen-overlay button[aria-label="Close"]' );
	await close.first().waitFor( { timeout: 3000 } ).then( () => close.first().click() ).catch( () => {} );
	const canvas = edp.frameLocator( 'iframe[name="editor-canvas"]' );
	await canvas.locator( `${ SEL } img[src*="bob-fun"]` ).first().waitFor( { timeout: 90000 } ).catch( () => {} );
	const edImgs = await canvas.locator( `${ SEL } img` ).evaluateAll( ( a ) => a.map( ( i ) => i.getAttribute( 'src' ).split( '/' ).pop() ) );
	log( 'editor images:', JSON.stringify( edImgs ) );
	check( 'editor preview shows each loop post\'s images', [ 'ann-pro', 'ann-fun', 'bob-pro', 'bob-fun', 'cat-pro' ].every( ( n ) => edImgs.some( ( s ) => s.startsWith( n ) ) ) );
	const placeholder = await canvas.locator( `${ SEL } .wfc-image-swap__placeholder` ).allTextContents();
	check( 'protected-meta block shows a placeholder in the editor', placeholder.some( ( t ) => /_secret_photo/.test( t ) ), JSON.stringify( placeholder ) );
	await edp.evaluate( () => {
		const be  = wp.data.select( 'core/block-editor' );
		const ids = be.getClientIdsWithDescendants().filter( ( c ) => be.getBlockName( c ) === 'wp-free-charts/image-swap' );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( ids[ ids.length - 1 ] );
		wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' );
	} );
	const notice = edp.locator( '.block-editor-block-inspector .components-notice__content' );
	await notice.first().waitFor( { timeout: 30000 } ).catch( () => {} );
	const n = ( await notice.count() ) ? await notice.first().textContent() : '';
	check( 'protected name is refused in the editor', n.includes( "can't start with" ), n );
	await edp.screenshot( { path: `${ OUT }/03-editor.png` } );
	const valid = await edp.evaluate( () => {
		const be = wp.data.select( 'core/block-editor' );
		return be.getClientIdsWithDescendants().map( ( c ) => be.getBlock( c ) ).filter( ( b ) => b.name.startsWith( 'wp-free-charts' ) ).every( ( b ) => b.isValid );
	} );
	check( 'blocks valid in the editor', valid );
	await ed.close();

	check( 'no page errors', errors.length === 0, errors.join( ' | ' ) );
} catch ( e ) {
	failures++;
	log( 'ERROR', e.stack );
}
await browser.close();
log( failures ? `${ failures } FAILED` : 'ALL PASSED' );
process.exit( failures ? 1 : 0 );
