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
	const groupsTxt  = await typeSelect.locator( 'optgroup' ).evaluateAll( ( g ) => g.map( ( x ) => x.label ) );
	check( 'Type dropdown lists contact + social types in groups',
		optionsTxt.length === 16 && [ 'Email', 'Phone', 'WhatsApp', 'Website', 'Instagram', 'LinkedIn' ].every( ( t ) => optionsTxt.includes( t ) ) && JSON.stringify( groupsTxt ) === '["Contact","Social"]',
		JSON.stringify( { optionsTxt, groupsTxt } ) );
	check( 'items have no styling options of their own', await page.evaluate( () => {
		const s = wp.blocks.getBlockType( 'wp-free-charts/contact-item' ).supports;
		return ! s.color && ! s.typography && ! s.spacing && ! s.__experimentalBorder && ! ( wp.data.select( 'core/blocks' ).getBlockStyles( 'wp-free-charts/contact-item' ) || [] ).length;
	} ) );
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

	// 3. More rows: button style (set on the parent) with display text, icon-only,
	// hostile input, social links, full parent styling, an old per-item button, hostile CSS.
	await page.evaluate( () => {
		const { createBlock } = wp.blocks;
		const item = ( a ) => createBlock( 'wp-free-charts/contact-item', a );
		wp.data.dispatch( 'core/block-editor' ).insertBlocks( [
			createBlock( 'wp-free-charts/contact-details', { itemStyle: 'button' }, [
				item( { type: 'email', value: 'sales@example.com', label: 'Email sales' } ),
				item( { type: 'phone', value: '01234 567890', label: 'Call us' } ),
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
			createBlock( 'wp-free-charts/contact-details', { openInNewTab: true }, [
				item( { type: 'instagram', value: 'instagram.com/example' } ),
				item( { type: 'website', value: 'https://www.example.com/' } ),
				item( { type: 'whatsapp', value: '+44 7700 900123' } ),
				item( { type: 'x', value: 'https://x.com/example' } ),
				item( { type: 'linkedin', value: 'https://www.linkedin.com/in/example', label: 'Connect' } ),
				item( { type: 'youtube', value: 'not a url' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', {
				itemStyle: 'outline', iconPosition: 'top', itemColor: '#0000ff',
				itemBackground: '#ffffff', itemBackgroundSlug: 'base',
				itemPadding: { top: '10px', right: '20px', bottom: '10px', left: '20px' }, itemRadius: '4px',
				iconSize: '32px', iconShape: 'circle', iconBackground: '#00ff00', iconColor: '#ff0000',
			}, [
				item( { type: 'email', value: 'style@example.com' } ),
				item( { type: 'facebook', value: 'https://facebook.com/example' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', {}, [
				item( { type: 'email', value: 'legacy@example.com', className: 'is-style-button' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', { iconShape: 'circle', iconSize: '48px', iconPadding: '1px', showText: false }, [
				item( { type: 'instagram', value: 'https://instagram.com/example' } ),
				item( { type: 'linkedin', value: 'https://linkedin.com/in/example' } ),
				item( { type: 'facebook', value: 'https://facebook.com/example' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', { iconShape: 'rounded', iconSize: '48px', iconPadding: '1px', showText: false }, [
				item( { type: 'instagram', value: 'https://instagram.com/example' } ),
				item( { type: 'linkedin', value: 'https://linkedin.com/in/example' } ),
			] ),
			createBlock( 'wp-free-charts/contact-details', {
				iconSize: 'red;background:url(x)', itemColor: 'expression(alert(1))', itemRadius: '4px;color:red',
				iconColorSlug: 'x);background:url(evil', itemBorderStyle: 'solid;color:red',
			}, [
				item( { type: 'email', value: 'css@example.com' } ),
			] ),
		] );
	} );
	await page.waitForTimeout( 800 );
	await page.screenshot( { path: `${ OUT }/01-editor.png`, fullPage: true } );

	// Icon-only in the editor hides the text.
	const iconOnlyText = await canvas().locator( '.wp-block-wp-free-charts-contact-details' ).nth( 2 ).locator( '.wfc-contact-item__text' ).count();
	check( 'icon-only row has no text in the editor', iconOnlyText === 0 );
	const btnClass = await canvas().locator( '.wp-block-wp-free-charts-contact-details' ).nth( 1 ).locator( '.wp-block-wp-free-charts-contact-item' ).first().getAttribute( 'class' );
	check( 'parent Button style gives items wp-element-button in the editor', btnClass.includes( 'wp-element-button' ), btnClass );

	// The parent's Styles tab has the item/icon controls.
	await page.evaluate( () => {
		const be = wp.data.select( 'core/block-editor' );
		wp.data.dispatch( 'core/block-editor' ).selectBlock( be.getBlocks()[ 5 ].clientId );
	} );
	await page.waitForTimeout( 500 );
	await page.locator( '.block-editor-block-inspector [role="tab"][aria-label="Styles"]' ).first().click().catch( () => {} );
	await page.waitForTimeout( 700 );
	// innerText follows CSS text-transform (control labels are upper case), so compare lower case.
	const stylesText = ( await page.locator( '.block-editor-block-inspector' ).innerText() ).toLowerCase();
	const missing    = [ 'Items', 'Icons', 'Icon size', 'Background shape', 'Corner radius', 'Icon background', 'Item text on hover' ].filter( ( t ) => ! stylesText.includes( t.toLowerCase() ) );
	check( 'parent Styles tab has item + icon controls', missing.length === 0, `missing: ${ missing.join( ', ' ) } | ${ stylesText.replace( /\s+/g, ' ' ).slice( -600 ) }` );
	await page.screenshot( { path: `${ OUT }/01b-parent-styles.png` } );

	// Same look in the editor and on the site: measure the styled row in both.
	const measure = () => {
		const row = document.querySelectorAll( '.wp-block-wp-free-charts-contact-details' )[ 5 ];
		const a   = row.querySelector( '.wp-block-wp-free-charts-contact-item' );
		const s   = getComputedStyle( a );
		const i   = getComputedStyle( a.querySelector( 'svg' ) );
		const w   = getComputedStyle( a.querySelector( '.wfc-contact-item__icon-wrap' ) );
		return {
			color: s.color, padding: s.padding, border: `${ s.borderTopWidth } ${ s.borderTopStyle }`, radius: s.borderTopLeftRadius,
			dir: s.flexDirection, iconW: i.width, iconBg: w.backgroundColor, iconFill: i.fill, iconRadius: w.borderTopLeftRadius,
		};
	};
	const editorLook = await page.frame( { name: 'editor-canvas' } ).evaluate( measure );

	// Icons inside a circle / rounded background keep their corners: the <svg>
	// isn't clipped, and each corner of the (square) icon sits inside the shape,
	// even with a tiny "Space around icon" (1px on a 48px icon).
	const iconsFit = () => [ 7, 8 ].flatMap( ( n ) => {
		const row = document.querySelectorAll( '.wp-block-wp-free-charts-contact-details' )[ n ];
		return [ ...row.querySelectorAll( '.wfc-contact-item__icon-wrap' ) ].map( ( wrap ) => {
			const svg = wrap.querySelector( 'svg' );
			const W   = wrap.getBoundingClientRect();
			const S   = svg.getBoundingClientRect();
			const r   = n === 7 ? W.width / 2 : W.width * 0.25; // circle / 25% rounded
			const corners = [ [ S.left, S.top ], [ S.right, S.top ], [ S.left, S.bottom ], [ S.right, S.bottom ] ];
			const inside  = corners.every( ( [ x, y ] ) => {
				// Nearest rounded-corner centre; a point outside the corner zones is inside the box.
				const cx = Math.min( Math.max( x, W.left + r ), W.right - r );
				const cy = Math.min( Math.max( y, W.top + r ), W.bottom - r );
				return Math.hypot( x - cx, y - cy ) <= r + 0.5;
			} );
			return { row: n, svgRadius: getComputedStyle( svg ).borderTopLeftRadius, svgW: Math.round( S.width ), wrapW: Math.round( W.width ), inside };
		} );
	} );
	const fitEditor = await page.frame( { name: 'editor-canvas' } ).evaluate( iconsFit );
	check( 'editor: icons in circle/rounded backgrounds are not cut off',
		fitEditor.length === 5 && fitEditor.every( ( f ) => f.inside && f.svgRadius === '0px' && f.svgW === 48 ), JSON.stringify( fitEditor ) );
	// A social item's default text ("Instagram") is a placeholder in the editor; it shouldn't look faded.
	const phOpacity = await page.frame( { name: 'editor-canvas' } ).evaluate( () => {
		const ph = document.querySelector( '.is-default-text [data-rich-text-placeholder]' );
		return ph ? getComputedStyle( ph, '::after' ).opacity : 'none';
	} );
	check( 'social default text is not faded in the editor', phOpacity === '1', phOpacity );
	const editorHostile = await page.frame( { name: 'editor-canvas' } ).evaluate( () =>
		document.querySelectorAll( '.wp-block-wp-free-charts-contact-details' )[ 9 ].getAttribute( 'style' ) || '' );
	check( 'editor drops hostile CSS values too', ! /url\(|expression|color:\s*red|red;/.test( editorHostile ), editorHostile );

	// 4. Publish, reload, still valid.
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).editPost( { status: 'publish' } ) );
	await page.evaluate( () => wp.data.dispatch( 'core/editor' ).savePost() );
	await page.waitForFunction( () => ! wp.data.select( 'core/editor' ).isSavingPost(), null, { timeout: 60000 } );
	const id   = await page.evaluate( () => wp.data.select( 'core/editor' ).getCurrentPostId() );
	const link = await page.evaluate( () => wp.data.select( 'core/editor' ).getPermalink() );
	await openEditor( `${ BASE }/wp-admin/post.php?post=${ id }&action=edit` );
	await page.waitForFunction( () => wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 120000 } );
	const blocks = await ours();
	check( 'all contact blocks valid after reload', blocks.length === 34 && blocks.every( ( b ) => b.valid ), `${ blocks.length } blocks` );

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
			svg: a.querySelectorAll( 'svg path' ).length,
			target: a.getAttribute( 'target' ),
			rel: a.getAttribute( 'rel' ),
			sr: a.querySelector( '.wfc-sr-only' )?.textContent || '',
			visibleText: a.querySelector( '.wfc-contact-item__text' )?.textContent || '',
			top: Math.round( a.getBoundingClientRect().top ),
		} ) ),
		style: row.getAttribute( 'style' ) || '',
		html: row.innerHTML,
	} ) ) );
	fs.writeFileSync( `${ OUT }/front.json`, JSON.stringify( rows, null, 2 ) );
	const [ r1, r2, r3, r4, r5, r6, r7 ] = rows;
	const r8 = rows[ 9 ];

	// Social / web links (new tab on).
	const by = ( r, href ) => r.items.find( ( i ) => i.href === href );
	const insta = by( r5, 'https://instagram.com/example' );
	check( 'social link: https added, network name shown, icon drawn', insta?.visibleText === 'Instagram' && insta.svg > 0, JSON.stringify( insta ) );
	check( 'new tab: target, rel and screen-reader note', insta?.target === '_blank' && /noopener/.test( insta.rel ) && insta.sr === '(opens in a new tab)' );
	check( 'website shows the address without https://', by( r5, 'https://www.example.com/' )?.visibleText === 'www.example.com' );
	check( 'WhatsApp links to wa.me with digits only', by( r5, 'https://wa.me/447700900123' )?.visibleText === '+44 7700 900123' );
	check( 'X and LinkedIn (display text) links', by( r5, 'https://x.com/example' )?.visibleText === 'X' && by( r5, 'https://www.linkedin.com/in/example' )?.visibleText === 'Connect' );
	check( 'invalid social URL outputs nothing', r5.items.length === 5, `${ r5.items.length } links` );
	check( 'email/phone never open in a new tab', [ ...r1.items, ...r2.items ].every( ( i ) => ! i.target ) );

	// Parent styling: same look as the editor, theme colour kept as a preset var.
	const frontLook = await fp.evaluate( measure );
	log( 'styled row editor:', JSON.stringify( editorLook ) );
	log( 'styled row front: ', JSON.stringify( frontLook ) );
	check( 'parent styling applies to items', frontLook.color === 'rgb(0, 0, 255)' && frontLook.padding === '10px 20px' && frontLook.border === '2px solid' &&
		frontLook.radius === '4px' && frontLook.dir === 'column' && frontLook.iconW === '32px' && frontLook.iconBg === 'rgb(0, 255, 0)' &&
		frontLook.iconFill === 'rgb(255, 0, 0)' && frontLook.iconRadius === '50%', JSON.stringify( frontLook ) );
	check( 'editor and site look the same', JSON.stringify( editorLook ) === JSON.stringify( frontLook ) );
	const fitFront = await fp.evaluate( iconsFit );
	check( 'site: icons in circle/rounded backgrounds are not cut off',
		fitFront.length === 5 && fitFront.every( ( f ) => f.inside && f.svgRadius === '0px' && f.svgW === 48 ), JSON.stringify( fitFront ) );
	await fp.locator( '.wp-block-wp-free-charts-contact-details' ).nth( 7 ).screenshot( { path: `${ OUT }/05-circle-icons.png` } );
	await fp.locator( '.wp-block-wp-free-charts-contact-details' ).nth( 8 ).screenshot( { path: `${ OUT }/06-rounded-icons.png` } );
	check( 'theme colour stays linked (preset var)', r6.style.includes( '--wfc-item-bg:var(--wp--preset--color--base)' ), r6.style );
	check( 'old per-item Button style still works', r7.items[ 0 ].cls.includes( 'wp-element-button' ) );
	check( 'hostile CSS values are dropped', ! /url\(|expression|color:red|red;/.test( r8.style ), r8.style );
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
