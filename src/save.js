/**
 * Static save output for the chart block.
 *
 * The chart isn't rendered here: we output a <figure> with an empty <canvas>,
 * the filter buttons, and a JSON <script class="wfc-chart-config"> holding the
 * settings. view.js reads that JSON on the front end and draws the chart.
 *
 * IMPORTANT: WordPress compares this function's output with the HTML stored in
 * each post. Any change to the markup (including the JSON) makes existing
 * blocks fail validation ("This block contains unexpected content"). So:
 *  - add new settings to chartData only when they're set (see customRange), or
 *  - add a `deprecated` entry in index.js holding the previous save().
 * Behaviour changes belong in view.js / chartDataUtils.js instead.
 */
import { useBlockProps } from '@wordpress/block-editor';
import { getDefaultColors } from './utils/chartDataUtils';

/** Coerce legacy number values (e.g. 24) to unit strings ("24px"). */
function toUnit( v, dflt = '0' ) {
	if ( v === undefined || v === null || v === '' ) return dflt;
	if ( typeof v === 'number' ) return `${ v }px`;
	return v;
}

function hasMeasure( v ) {
	return !! v && parseFloat( v ) !== 0;
}

export default function save( { attributes } ) {
	const {
		chartType, tableData, title, showTitle, titleFontSize, titleFontFamily,
		titleColor, titleAlign, titleFontWeight, titleFontStyle, titleLineHeight, titleLetterSpacing,
		showLegend, legendPosition, legendAlign,
		enableFilters, filterType, chartHeight, backgroundColor,
		paddingTop, paddingRight, paddingBottom, paddingLeft,
		marginTop, marginRight, marginBottom, marginLeft,
		borderWidth, borderColor, borderRadius, borderStyle,
		fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing, textTransform,
		datasetColors, showGridX, showGridY, gridColor, tickColor,
		showTooltips, enableAnimation, stacked, xAxisLabel, yAxisLabel,
		tension, pointRadius, fillArea, barBorderRadius, indexAxis, cutout,
		customRange, rangeMin, rangeMax, rangeStep,
		uniqueId,
	} = attributes;

	// Pad the colour list with defaults so every series/slice has a colour.
	const defaults      = getDefaultColors();
	const isPieType     = [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
	const numDatasets   = ( tableData[ 0 ]?.length ?? 2 ) - 1;
	const colorCount    = isPieType ? tableData.length - 1 : numDatasets;
	const resolvedColors = [ ...datasetColors ];
	while ( resolvedColors.length < colorCount ) {
		resolvedColors.push( defaults[ resolvedColors.length % defaults.length ] );
	}

	// Kept as-is for block validation. These buttons are a placeholder only:
	// view.js replaces them with ones built by getFilterLabels(), which also
	// fixes the labels for scatter and "label" filters.
	const filterLabels = isPieType
		? tableData.slice( 1 ).map( ( r ) => r[ 0 ] )
		: ( tableData[ 0 ]?.slice( 1 ) ?? [] );

	const pTop    = toUnit( paddingTop,    '24px' );
	const pRight  = toUnit( paddingRight,  '24px' );
	const pBottom = toUnit( paddingBottom, '24px' );
	const pLeft   = toUnit( paddingLeft,   '24px' );

	const mTop    = toUnit( marginTop,    '0' );
	const mRight  = toUnit( marginRight,  '0' );
	const mBottom = toUnit( marginBottom, '0' );
	const mLeft   = toUnit( marginLeft,   '0' );

	const bWidth  = toUnit( borderWidth, '0' );
	const bRadius = toUnit( borderRadius, '0' );
	const hasBorder = hasMeasure( bWidth );
	const hasRadius = hasMeasure( bRadius );

	const chartHeightVal = toUnit( chartHeight, '400px' );

	const blockProps = useBlockProps.save( {
		className: 'wfc-block',
		style: {
			backgroundColor: backgroundColor || undefined,
			padding:      `${ pTop } ${ pRight } ${ pBottom } ${ pLeft }`,
			margin:       `${ mTop } ${ mRight } ${ mBottom } ${ mLeft }`,
			border:       hasBorder ? `${ bWidth } ${ borderStyle } ${ borderColor }` : undefined,
			borderRadius: hasRadius ? bRadius : undefined,
			fontFamily:   fontFamily   || undefined,
			fontWeight:   fontWeight   || undefined,
			fontStyle:    fontStyle && fontStyle !== 'normal' ? fontStyle : undefined,
			lineHeight:   lineHeight   || undefined,
			letterSpacing: letterSpacing || undefined,
			textTransform: textTransform || undefined,
		},
	} );

	// Settings passed to view.js. Key order and contents are part of the saved
	// markup, so see the validation note at the top before changing this.
	const chartData = {
		chartType, tableData, showLegend, legendPosition, legendAlign,
		showTooltips, enableAnimation, stacked, tension, pointRadius, fillArea,
		barBorderRadius, indexAxis, cutout, showGridX, showGridY, fontSize,
		fontFamily, fontWeight, xAxisLabel, yAxisLabel,
		enableFilters, filterType, gridColor, tickColor,
		datasetColors: resolvedColors,
		// Only serialised when enabled so existing blocks keep validating.
		...( customRange ? { customRange, rangeMin, rangeMax, rangeStep } : {} ),
	};

	return (
		<figure { ...blockProps } data-wfc-id={ uniqueId }>
			{ showTitle && title && (
				<div
					className="wfc-chart-title"
					style={ {
						textAlign:     titleAlign,
						fontSize:      typeof titleFontSize === 'number' ? `${ titleFontSize }px` : titleFontSize,
						fontWeight:    titleFontWeight,
						fontStyle:     titleFontStyle && titleFontStyle !== 'normal' ? titleFontStyle : undefined,
						lineHeight:    titleLineHeight   || undefined,
						letterSpacing: titleLetterSpacing || undefined,
						color:         titleColor,
						fontFamily:    titleFontFamily || fontFamily || undefined,
					} }
				>
					{ title }
				</div>
			) }

			<div
				className="wfc-chart-container"
				style={ {
					position: 'relative',
					height:   chartHeightVal,
					'--wfc-height': chartHeightVal,
				} }
			>
				<canvas
					className="wfc-canvas"
					aria-label={ title || 'Chart' }
					role="img"
				/>
			</div>

			{ enableFilters && filterLabels.length > 0 && (
				<div className="wfc-filters" data-filter-type={ filterType }>
					{ filterLabels.map( ( label, i ) => (
						<button
							key={ i }
							type="button"
							className="wfc-filter-btn wfc-filter-btn--active"
							data-filter-index={ i }
						>
							{ label }
						</button>
					) ) }
				</div>
			) }

			{ /* eslint-disable-next-line react/no-danger */ }
			<script
				type="application/json"
				className="wfc-chart-config"
				dangerouslySetInnerHTML={ { __html: JSON.stringify( chartData ) } }
			/>
		</figure>
	);
}
