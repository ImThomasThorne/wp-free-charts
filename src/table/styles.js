/**
 * Inline-style helpers shared by the table's edit.js and save.js, so the
 * editor and the published page render identically. No WordPress imports.
 *
 * Colours and font sizes picked from the theme are stored with their slug and
 * output as CSS variables (var(--wp--preset--color--{slug})), so the table
 * follows the theme if its palette changes. Custom values are output as-is.
 */

export function colorCss( value, slug ) {
	if ( slug ) return `var(--wp--preset--color--${ slug })`;
	return value || undefined;
}

export function fontSizeCss( value, slug ) {
	if ( slug ) return `var(--wp--preset--font-size--${ slug })`;
	return value || undefined;
}

export function fontFamilyCss( value, slug ) {
	if ( slug ) return `var(--wp--preset--font-family--${ slug })`;
	return value || undefined;
}

/**
 * Inline style for one cell from its stored formatting. Keep the property
 * order stable: it's part of the saved markup (block validation). New
 * properties are fine as long as they're undefined for existing cells.
 */
export function cellStyle( cell ) {
	const style = {
		backgroundColor: colorCss( cell.bg, cell.bgSlug ),
		color:           colorCss( cell.color, cell.colorSlug ),
		textAlign:       cell.align || undefined,
		verticalAlign:   cell.valign || undefined,
		fontSize:        fontSizeCss( cell.fontSize, cell.fontSizeSlug ),
		fontFamily:      fontFamilyCss( cell.fontFamily, cell.fontFamilySlug ),
		// `bold` is the original on/off setting; fontWeight (any theme weight) replaces it.
		fontWeight:      cell.fontWeight || ( cell.bold ? 'bold' : undefined ),
		// Added in 2.1: keep these after the original properties (see note above).
		fontStyle:       cell.fontStyle || undefined,
		lineHeight:      cell.lineHeight || undefined,
		letterSpacing:   cell.letterSpacing || undefined,
		textTransform:   cell.textTransform || undefined,
		textDecoration:  cell.textDecoration || undefined,
	};
	return Object.values( style ).some( Boolean ) ? style : undefined;
}

/**
 * A spacing value: theme presets are stored as "var:preset|spacing|{slug}"
 * (WordPress's format) and output as the theme's CSS variable; anything else
 * (e.g. "12px") is output as-is.
 */
export function spacingCss( value ) {
	if ( typeof value === 'string' && value.startsWith( 'var:preset|spacing|' ) ) {
		return `var(--wp--preset--spacing--${ value.slice( 'var:preset|spacing|'.length ) })`;
	}
	return value;
}

function paddingCss( p ) {
	if ( ! p || ! Object.values( p ).some( Boolean ) ) return undefined;
	return [ p.top, p.right, p.bottom, p.left ].map( ( v ) => spacingCss( v ) || '0' ).join( ' ' );
}

/**
 * Table-level settings as CSS custom properties (consumed by style.css), plus
 * the optional minimum width for the "scroll" mobile layout.
 */
export function tableStyle( attributes ) {
	const {
		headerBg, headerBgSlug, headerColor, headerColorSlug, stripeBg, stripeBgSlug,
		borderColor, borderColorSlug, borderWidth, borderStyle, cellPadding, minWidth,
	} = attributes;
	const style = {
		'--wfc-header-bg':    colorCss( headerBg, headerBgSlug ),
		'--wfc-header-color': colorCss( headerColor, headerColorSlug ),
		'--wfc-stripe-bg':    colorCss( stripeBg, stripeBgSlug ),
		'--wfc-border-color': colorCss( borderColor, borderColorSlug ),
		'--wfc-border-width': borderWidth || undefined,
		'--wfc-border-style': borderStyle || undefined,
		'--wfc-cell-padding': paddingCss( cellPadding ),
		minWidth:             minWidth || undefined,
	};
	for ( const k of Object.keys( style ) ) {
		if ( style[ k ] === undefined ) delete style[ k ];
	}
	return Object.keys( style ).length ? style : undefined;
}

/** Class names for the <table> element. */
export function tableClassName( { striped, colWidths } ) {
	return [
		'wfc-table__table',
		striped ? 'is-striped' : '',
		colWidths?.length ? 'has-fixed-layout' : '',
	].filter( Boolean ).join( ' ' );
}
