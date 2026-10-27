/**
 * Contact Details styling (editor): the parent's item/icon settings as classes
 * + CSS custom properties on the wrapper, which style.css applies to every
 * item. Mirrors wp_free_charts_contact_style() in includes/contact-styles.php
 * (the front end); keep the two in step.
 */

const oneOf = ( value, allowed, fallback ) => ( allowed.includes( value ) ? value : fallback );

// Same checks as the PHP, so the editor never shows a value the site drops.
const LENGTH = /^(0|\d*\.?\d+(px|em|rem|%|vw|vh|ch|pt))$/;
const COLOR  = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/deg]+\)|[a-z]{3,20})$/i;
const SLUG   = /^[a-z0-9-]+$/;

/** A CSS length ("12px", "1.5em", "0") or ''. */
export const lengthCss = ( value ) => ( LENGTH.test( String( value ?? '' ).trim() ) ? String( value ).trim() : '' );

/** Theme colour slug -> preset var, else a valid custom colour, else ''. */
export function colorCss( value, slug ) {
	if ( slug && SLUG.test( slug ) ) return `var(--wp--preset--color--${ slug })`;
	const v = String( value ?? '' ).trim();
	return COLOR.test( v ) ? v : '';
}

/** Theme spacing preset ("var:preset|spacing|40") -> CSS var, else a length. */
export function spacingCss( value ) {
	const m = typeof value === 'string' && value.match( /^var:preset\|spacing\|([a-z0-9-]+)$/ );
	return m ? `var(--wp--preset--spacing--${ m[ 1 ] })` : lengthCss( value );
}

/** Any side set -> all four (unset sides are 0), as in the PHP. */
function paddingCss( p ) {
	const sides = [ p?.top, p?.right, p?.bottom, p?.left ].map( spacingCss );
	return sides.some( Boolean ) ? sides.map( ( v ) => v || '0' ).join( ' ' ) : '';
}

/** @return {{ className: string, style: Object }} */
export function contactStyle( a ) {
	const classes = [
		`is-item-style-${ oneOf( a.itemStyle, [ 'plain', 'button', 'outline' ], 'plain' ) }`,
		`is-icon-${ oneOf( a.iconPosition, [ 'before', 'after', 'top' ], 'before' ) }`,
	];
	const shape = oneOf( a.iconShape, [ 'none', 'circle', 'rounded', 'square' ], 'none' );
	if ( shape !== 'none' ) classes.push( `has-icon-shape-${ shape }` );
	if ( a.showText === false ) classes.push( 'is-icon-only' );

	// CSS var => [ value, class added when set ] (same order as the PHP).
	const vars = [
		[ '--wfc-item-color', colorCss( a.itemColor, a.itemColorSlug ), 'has-item-color' ],
		[ '--wfc-item-bg', colorCss( a.itemBackground, a.itemBackgroundSlug ), 'has-item-bg' ],
		[ '--wfc-item-hover-color', colorCss( a.itemHoverColor, a.itemHoverColorSlug ), 'has-item-hover-color' ],
		[ '--wfc-item-hover-bg', colorCss( a.itemHoverBackground, a.itemHoverBackgroundSlug ), 'has-item-hover-bg' ],
		[ '--wfc-item-border-color', colorCss( a.itemBorderColor, a.itemBorderColorSlug ), 'has-item-border' ],
		[ '--wfc-item-border-width', lengthCss( a.itemBorderWidth ), 'has-item-border' ],
		[ '--wfc-item-border-style', oneOf( a.itemBorderStyle, [ 'solid', 'dashed', 'dotted', 'double', 'none' ], '' ), 'has-item-border' ],
		[ '--wfc-item-radius', lengthCss( a.itemRadius ), 'has-item-radius' ],
		[ '--wfc-item-padding', paddingCss( a.itemPadding ), 'has-item-padding' ],
		[ '--wfc-item-gap', lengthCss( a.itemGap ), '' ],
		[ '--wfc-item-decoration', oneOf( a.itemDecoration, [ 'none', 'underline' ], '' ), 'has-item-decoration' ],
		[ '--wfc-icon-color', colorCss( a.iconColor, a.iconColorSlug ), 'has-icon-color' ],
		[ '--wfc-icon-bg', colorCss( a.iconBackground, a.iconBackgroundSlug ), 'has-icon-bg' ],
		[ '--wfc-icon-size', lengthCss( a.iconSize ), '' ],
		[ '--wfc-icon-padding', lengthCss( a.iconPadding ), '' ],
	];

	const style = {};
	for ( const [ name, value, cls ] of vars ) {
		if ( ! value ) continue;
		style[ name ] = value;
		if ( cls && ! classes.includes( cls ) ) classes.push( cls );
	}
	return { className: classes.join( ' ' ), style };
}
