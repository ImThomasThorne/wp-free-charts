/**
 * Block transforms between WP Free Table and the core Table block
 * (block toolbar → "Transform to"). Text, merged cells, alignment, header
 * row and caption carry over both ways. Colours, fonts and column widths
 * only exist in WP Free Table, so they're dropped when converting to core.
 */
import { createBlock } from '@wordpress/blocks';
import { gridFromRows, rowsFromGrid, getHeaderRowCount } from './tableUtils';

/** core/table cell content may be a string or (WP 6.5+) a RichTextData object. */
const toHtml = ( v ) => {
	if ( typeof v === 'string' ) return v;
	if ( v?.toHTMLString ) return v.toHTMLString();
	return String( v ?? '' );
};

function fromCoreTable( { head = [], body = [], foot = [], caption } ) {
	const rows = [ ...head, ...body, ...foot ].map( ( row ) => ( row.cells || [] ).map( ( cell ) => ( {
		content: toHtml( cell.content ),
		colspan: cell.colspan,
		rowspan: cell.rowspan,
		align:   cell.align,
	} ) ) );
	const captionHtml = toHtml( caption );
	return {
		cells:           rows.length ? gridFromRows( rows ) : [],
		hasHeaderRow:    head.length > 0,
		hasHeaderColumn: body[ 0 ]?.cells?.[ 0 ]?.tag === 'th',
		hasCaption:      !! captionHtml,
		caption:         captionHtml,
	};
}

function toCoreTable( { cells, hasHeaderRow, caption, hasCaption, colWidths } ) {
	const headerRows = hasHeaderRow ? getHeaderRowCount( cells ) : 0;
	const rows       = rowsFromGrid( cells );
	const section    = ( list, tag ) => list.map( ( row ) => ( {
		cells: row.map( ( cell ) => ( { ...cell, tag, ...( tag === 'th' ? { scope: 'col' } : {} ) } ) ),
	} ) );
	return {
		head:           section( rows.slice( 0, headerRows ), 'th' ),
		body:           section( rows.slice( headerRows ), 'td' ),
		hasFixedLayout: colWidths?.length > 0,
		caption:        hasCaption ? caption : '',
	};
}

export default {
	from: [
		{
			type:      'block',
			blocks:    [ 'core/table' ],
			transform: ( attributes ) => createBlock( 'wp-free-charts/table', fromCoreTable( attributes ) ),
		},
	],
	to: [
		{
			type:      'block',
			blocks:    [ 'core/table' ],
			isMatch:   ( { cells } ) => cells?.length > 0,
			transform: ( attributes ) => createBlock( 'core/table', toCoreTable( attributes ) ),
		},
	],
};
