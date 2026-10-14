/**
 * Saved markup for the table block: a plain HTML table (no front-end JS).
 *
 * <figure class="wp-block-wp-free-charts-table is-mobile-{scroll|stack}">
 *   <div class="wfc-table__scroll"><table>…</table></div>
 *   <figcaption>…</figcaption>
 * </figure>
 *
 * IMPORTANT: as with the chart block, WordPress validates every saved table
 * against this function's output. Changing the markup (elements, classes,
 * attributes, inline styles) breaks existing tables unless you add a
 * `deprecated` entry in index.js holding the previous version of save().
 */
import { useBlockProps, RichText } from '@wordpress/block-editor';
import { getHeaderRowCount, getColumnLabels } from './tableUtils';
import { cellStyle, tableStyle, tableClassName } from './styles';

export default function save( { attributes } ) {
	const { cells, colWidths, hasHeaderRow, hasHeaderColumn, mobileLayout, hasCaption, caption } = attributes;
	if ( ! cells?.length ) return null;

	const headerRows = hasHeaderRow ? getHeaderRowCount( cells ) : 0;
	// Column headings repeated on each cell in the mobile "stack" layout.
	const labels     = hasHeaderRow ? getColumnLabels( cells ) : [];

	const blockProps = useBlockProps.save( {
		className: `is-mobile-${ mobileLayout || 'scroll' }`,
	} );

	const renderRow = ( row, r ) => {
		const inHead = r < headerRows;
		return (
			<tr key={ r }>
				{ row.map( ( cell, c ) => {
					if ( cell.hidden ) return null;
					const isRowHeader = ! inHead && hasHeaderColumn && c === 0;
					const tag         = inHead || isRowHeader ? 'th' : 'td';
					return (
						<RichText.Content
							key={ c }
							tagName={ tag }
							value={ cell.content }
							colSpan={ cell.colspan > 1 ? cell.colspan : undefined }
							rowSpan={ cell.rowspan > 1 ? cell.rowspan : undefined }
							scope={ inHead ? 'col' : ( isRowHeader ? 'row' : undefined ) }
							data-label={ ! inHead && ! isRowHeader && labels[ c ] ? labels[ c ] : undefined }
							style={ cellStyle( cell ) }
						/>
					);
				} ) }
			</tr>
		);
	};

	return (
		<figure { ...blockProps }>
			{ /* tabIndex lets keyboard users scroll a wide table sideways. */ }
			<div className="wfc-table__scroll" tabIndex="0">
				<table className={ tableClassName( attributes ) } style={ tableStyle( attributes ) }>
					{ colWidths?.length > 0 && (
						<colgroup>
							{ colWidths.map( ( w, i ) => <col key={ i } style={ { width: `${ w }%` } } /> ) }
						</colgroup>
					) }
					{ headerRows > 0 && (
						<thead>{ cells.slice( 0, headerRows ).map( ( row, r ) => renderRow( row, r ) ) }</thead>
					) }
					<tbody>{ cells.slice( headerRows ).map( ( row, i ) => renderRow( row, i + headerRows ) ) }</tbody>
				</table>
			</div>
			{ hasCaption && ! RichText.isEmpty( caption ) && (
				<RichText.Content tagName="figcaption" className="wfc-table__caption" value={ caption } />
			) }
		</figure>
	);
}
