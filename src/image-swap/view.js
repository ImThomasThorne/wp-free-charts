/**
 * Image Swap, front end. Mouse hover is handled by CSS. This adds .is-swapped
 * for the cases where there's no hover, and removes it after data-revert ms:
 *  - touch / pen: a tap shows the second image. On a linked image, the first
 *    tap swaps and a second tap (while swapped) follows the link;
 *  - keyboard: focusing the image with Tab (or pressing Enter/Space on an
 *    unlinked one) shows it; moving focus away swaps back straight away.
 */
const SELECTOR = '.wp-block-wp-free-charts-image-swap.has-hover-image';

function init( el ) {
	if ( el.dataset.wfcSwapReady ) return;
	el.dataset.wfcSwapReady = '1';

	const delay  = Number( el.dataset.revert ) || 3000;
	const isLink = el.tagName === 'A';
	let timer    = null;
	let touch    = false;

	const unswap = () => {
		clearTimeout( timer );
		timer = null;
		el.classList.remove( 'is-swapped' );
	};
	const swap = () => {
		el.classList.add( 'is-swapped' );
		clearTimeout( timer );
		timer = setTimeout( unswap, delay );
	};

	el.addEventListener( 'pointerdown', ( e ) => {
		touch = e.pointerType !== 'mouse';
	} );

	el.addEventListener( 'click', ( e ) => {
		if ( ! touch ) return; // Mouse: CSS hover already shows it; links work as normal.
		touch = false;
		if ( isLink && el.classList.contains( 'is-swapped' ) ) return; // Second tap opens the link.
		if ( isLink ) e.preventDefault();
		swap();
	} );

	el.addEventListener( 'focus', () => {
		// :focus-visible is true for keyboard focus, not for a mouse click or tap.
		let keyboard = true;
		try {
			keyboard = el.matches( ':focus-visible' );
		} catch ( err ) {}
		if ( keyboard ) swap();
	} );
	el.addEventListener( 'blur', unswap );

	if ( ! isLink ) {
		el.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				swap();
			}
		} );
	}
}

function initAll() {
	document.querySelectorAll( SELECTOR ).forEach( init );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initAll );
} else {
	initAll();
}
