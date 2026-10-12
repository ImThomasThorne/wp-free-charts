/**
 * Shared chart logic used by BOTH the editor preview (edit.js) and the
 * front end (view.js), so they always render identically.
 *
 * The main export, tableDataToChartConfig(), turns block attributes into a
 * Chart.js v4 config. It also attaches two inline Chart.js plugins:
 *  - legendSpacingPlugin: 1rem gap between the legend and the chart area
 *  - responsivePlugin:    compact layout for charts narrower than 480px
 */

/** Random id stored in the uniqueId attribute (output as data-wfc-id). */
export function generateUniqueId() {
	return 'wfc-' + Math.random().toString( 36 ).substr( 2, 9 ) + Date.now().toString( 36 );
}

/** Fallback palette for series/slices without a chosen colour (Tableau 10). */
export function getDefaultColors() {
	return [
		'#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
		'#59a14f', '#edc948', '#b07aa1', '#ff9da7',
		'#9c755f', '#bab0ac',
	];
}

/** "#rrggbb" → "rgba(r,g,b,alpha)"; other colour formats are returned unchanged. */
function hexToRgba( hex, alpha ) {
	if ( ! hex ) return `rgba(78,121,167,${ alpha })`;
	const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec( hex );
	if ( ! r ) return hex;
	return `rgba(${ parseInt( r[1], 16 ) },${ parseInt( r[2], 16 ) },${ parseInt( r[3], 16 ) },${ alpha })`;
}

/** Parse an optional numeric attribute; blank or invalid means "automatic". */
function toOptionalNumber( v ) {
	if ( v === '' || v === null || v === undefined ) return undefined;
	const n = Number( v );
	return isNaN( n ) ? undefined : n;
}

/**
 * Adds 1rem of space between the legend and the chart area.
 * The extra space is added to the legend box in fit(); for bottom/right
 * legends the box is then shifted so the gap sits on the chart side.
 */
const legendSpacingPlugin = {
	id: 'wfcLegendSpacing',
	beforeLayout( chart ) {
		const legend = chart.legend;
		if ( ! legend || legend._wfcSpaced ) return;
		legend._wfcSpaced = true;

		const originalFit = legend.fit;
		legend.fit = function () {
			originalFit.call( this );
			if ( ! this.options.display ) return;
			const root  = chart.canvas.ownerDocument.documentElement;
			const space = parseFloat( getComputedStyle( root ).fontSize ) || 16;
			this._wfcSpace = space;
			if ( this.isHorizontal() ) {
				this.height += space;
			} else {
				this.width += space;
			}
		};
	},
	afterLayout( chart ) {
		const legend = chart.legend;
		if ( ! legend || ! legend.options.display || ! legend._wfcSpace ) return;
		const space = legend._wfcSpace;
		if ( legend.options.position === 'bottom' ) {
			legend.top    += space;
			legend.height -= space;
		} else if ( legend.options.position === 'right' ) {
			legend.left  += space;
			legend.width -= space;
		}
	},
};

/** Pie-like charts have one dataset whose slices are the table rows. */
export function isPieLikeType( chartType ) {
	return [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
}

/**
 * Labels for the front-end filter buttons, in the same order as the index
 * each button toggles:
 *  - pie/doughnut/polarArea: one per slice (table row), whatever filterType says
 *  - "label" filter: one per category (table row)
 *  - "dataset" filter: one per series (header column; scatter uses X/Y pairs)
 */
export function getFilterLabels( chartType, filterType, tableData ) {
	const header = tableData?.[ 0 ] ?? [];
	const rows   = ( tableData ?? [] ).slice( 1 );

	if ( isPieLikeType( chartType ) || filterType === 'label' ) {
		return rows.map( ( r ) => String( r[ 0 ] ?? '' ) );
	}
	if ( chartType === 'scatter' ) {
		const pairs = Math.floor( ( header.length - 1 ) / 2 );
		return Array.from( { length: pairs }, ( _, d ) => String( header[ 1 + d * 2 ] || `Series ${ d + 1 }` ) );
	}
	return header.slice( 1 ).map( ( h, d ) => String( h || `Dataset ${ d + 1 }` ) );
}

/** Charts narrower than this (in px) switch to a compact mobile layout. */
const COMPACT_WIDTH = 480;
const COMPACT_MAX_FONT = 11;

function isCompact( chart ) {
	return chart.width > 0 && chart.width < COMPACT_WIDTH;
}

/**
 * Scriptable font: uses the configured font, capped to a smaller size
 * when the chart is narrow. The base font lives in the plugin options
 * so it is part of the (JSON) config and changes re-render the preview.
 */
function responsiveFont( ctx ) {
	const font = ctx.chart.config.options.plugins?.wfcResponsive?.font || {};
	return isCompact( ctx.chart )
		? { ...font, size: Math.min( font.size || 13, COMPACT_MAX_FONT ) }
		: font;
}

/**
 * Applies the non-scriptable parts of the compact layout: moves side
 * legends underneath, tightens legend spacing and allows x-axis labels
 * to rotate fully so more of them fit.
 */
function applyCompactLayout( chart ) {
	const compact = isCompact( chart );
	if ( chart.$wfcCompact === compact ) return;
	chart.$wfcCompact = compact;

	const opts   = chart.config.options;
	const legend = opts.plugins?.legend;
	if ( ! chart.$wfcBase ) {
		chart.$wfcBase = { legendPosition: legend?.position || 'top' };
	}
	const base = chart.$wfcBase;

	if ( legend ) {
		const isSide = [ 'left', 'right' ].includes( base.legendPosition );
		legend.position = compact && isSide ? 'bottom' : base.legendPosition;
		legend.labels   = { ...legend.labels, padding: compact ? 10 : 16 };
	}

	const categoryAxis = opts.indexAxis === 'y' ? opts.scales?.y : opts.scales?.x;
	if ( categoryAxis ) {
		categoryAxis.ticks = {
			...categoryAxis.ticks,
			maxRotation:     compact ? 90 : 50,
			autoSkipPadding: compact ? 2 : 3,
		};
	}
}

const responsivePlugin = {
	id: 'wfcResponsive',
	// The chart's first update runs straight after init, and resize fires
	// before each re-render, so both pick up the layout without an extra update.
	afterInit( chart ) {
		applyCompactLayout( chart );
	},
	resize( chart ) {
		applyCompactLayout( chart );
	},
};

/**
 * Build a Chart.js config from block attributes.
 *
 * tableData row 0 is the header ([ '', series names… ]); each later row is
 * [ label, values… ]. How it maps to datasets depends on the chart type:
 *  - pie/doughnut/polarArea: one dataset, one slice per row (column 1 only)
 *  - scatter: one dataset per X/Y column pair, one point per row
 *  - everything else: one dataset per column, one category per row
 *
 * datasetColors must already be padded to the right length (callers do this).
 */
export function tableDataToChartConfig( {
	tableData,
	chartType,
	datasetColors,
	showLegend,
	legendPosition,
	legendAlign,
	showTooltips,
	enableAnimation,
	stacked,
	tension,
	pointRadius,
	fillArea,
	barBorderRadius,
	indexAxis,
	cutout,
	showGridX,
	showGridY,
	fontSize,
	fontFamily,
	fontWeight,
	xAxisLabel,
	yAxisLabel,
	gridColor,
	tickColor,
	customRange,
	rangeMin,
	rangeMax,
	rangeStep,
} ) {
	if ( ! tableData || tableData.length < 2 ) {
		return { type: 'bar', data: { labels: [], datasets: [] }, options: {} };
	}

	const isPieType  = [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
	const isRadar    = chartType === 'radar';
	const isScatter  = chartType === 'scatter';
	const defaults   = getDefaultColors();
	const colors     = datasetColors && datasetColors.length ? datasetColors : defaults;

	let labels   = [];
	let datasets = [];

	if ( isPieType ) {
		labels = tableData.slice( 1 ).map( ( row ) => String( row[ 0 ] || '' ) );
		const values    = tableData.slice( 1 ).map( ( row ) => Number( row[ 1 ] ) || 0 );
		const bgColors  = labels.map( ( _, i ) => colors[ i % colors.length ] );

		datasets = [ {
			label: String( tableData[ 0 ]?.[ 1 ] || 'Data' ),
			data:            values,
			backgroundColor: bgColors,
			borderColor:     bgColors.map( () => '#ffffff' ),
			borderWidth:     2,
			hoverOffset:     8,
		} ];
	} else if ( isScatter ) {
		labels = tableData.slice( 1 ).map( ( row ) => String( row[ 0 ] || '' ) );
		const numCols = ( tableData[ 0 ]?.length || 3 ) - 1;
		const dsPairs = Math.floor( numCols / 2 );

		for ( let d = 0; d < dsPairs; d++ ) {
			const xCol  = 1 + d * 2;
			const yCol  = xCol + 1;
			const color = colors[ d % colors.length ];

			datasets.push( {
				label: String( tableData[ 0 ]?.[ xCol ] || `Series ${ d + 1 }` ),
				data:            tableData.slice( 1 ).map( ( row ) => ( { x: Number( row[ xCol ] ) || 0, y: Number( row[ yCol ] ) || 0 } ) ),
				backgroundColor: hexToRgba( color, 0.7 ),
				borderColor:     color,
				pointRadius,
			} );
		}
	} else {
		labels = tableData.slice( 1 ).map( ( row ) => String( row[ 0 ] || '' ) );
		const numDatasets = ( tableData[ 0 ]?.length || 2 ) - 1;

		for ( let d = 0; d < numDatasets; d++ ) {
			const color  = colors[ d % colors.length ];
			const isLine = [ 'line', 'radar' ].includes( chartType );
			const values = tableData.slice( 1 ).map( ( row ) => {
				const v = row[ d + 1 ];
				return ( v === '' || v === null || v === undefined ) ? null : Number( v );
			} );

			datasets.push( {
				label:           String( tableData[ 0 ]?.[ d + 1 ] || `Dataset ${ d + 1 }` ),
				data:            values,
				backgroundColor: isLine ? hexToRgba( color, fillArea ? 0.15 : 0.8 ) : hexToRgba( color, 0.85 ),
				borderColor:     color,
				borderWidth:     isLine ? 2 : 1,
				fill:            fillArea ? 'origin' : false,
				tension:         isLine ? tension : 0,
				pointRadius:     isLine ? pointRadius : undefined,
				borderRadius:    ( chartType === 'bar' || chartType === 'horizontalBar' ) ? barBorderRadius : 0,
				pointHoverRadius: isLine ? pointRadius + 3 : undefined,
			} );
		}
	}

	// 'horizontalBar' isn't a Chart.js type: it's a bar chart on the y index axis.
	const actualType      = chartType === 'horizontalBar' ? 'bar' : chartType;
	const actualIndexAxis = chartType === 'horizontalBar' ? 'y' : indexAxis;
	const hasCartesian    = ! isPieType && ! isRadar;

	const fontSizeNum = typeof fontSize === 'number' ? fontSize : ( parseFloat( fontSize ) || 13 );
	const fontObj = {
		family: fontFamily || undefined,
		size:   fontSizeNum,
		weight: fontWeight || undefined,
	};

	const gridC = gridColor  || 'rgba(0,0,0,0.06)';
	const tickC = tickColor  || undefined;

	// Fixed min/max (and optional step) for the value axis.
	const range = {};
	if ( customRange ) {
		const min = toOptionalNumber( rangeMin );
		const max = toOptionalNumber( rangeMax );
		if ( min !== undefined ) range.min = min;
		if ( max !== undefined ) range.max = max;
	}
	const rangeStepNum = customRange ? toOptionalNumber( rangeStep ) : undefined;
	const stepTicks    = rangeStepNum > 0 ? { stepSize: rangeStepNum } : {};
	const valueAxis    = actualIndexAxis === 'y' ? 'x' : 'y';

	const config = {
		type: actualType,
		data: { labels, datasets },
		plugins: [ legendSpacingPlugin, responsivePlugin ],
		options: {
			responsive:          true,
			maintainAspectRatio: false,
			animation:           enableAnimation ? { duration: 600 } : false,
			indexAxis:           actualIndexAxis,
			plugins: {
				legend: {
					display:  showLegend,
					position: legendPosition || 'top',
					align:    legendAlign    || 'center',
					labels:   { font: responsiveFont, padding: 16, usePointStyle: true },
				},
				tooltip: {
					enabled: showTooltips,
				},
				wfcResponsive: { font: fontObj },
			},
			scales: hasCartesian ? {
				x: {
					stacked: stacked,
					grid:    { display: showGridX, color: gridC },
					title:   xAxisLabel ? { display: true, text: xAxisLabel, font: responsiveFont } : undefined,
					ticks:   { font: responsiveFont, color: tickC, ...( valueAxis === 'x' ? stepTicks : {} ) },
					...( valueAxis === 'x' ? range : {} ),
				},
				y: {
					stacked: stacked,
					grid:    { display: showGridY, color: gridC },
					title:   yAxisLabel ? { display: true, text: yAxisLabel, font: responsiveFont } : undefined,
					ticks:   { font: responsiveFont, color: tickC, ...( valueAxis === 'y' ? stepTicks : {} ) },
					...( valueAxis === 'y' ? range : {} ),
				},
			} : isRadar ? {
				r: {
					ticks:       { font: responsiveFont, backdropColor: 'transparent', color: tickC, ...stepTicks },
					pointLabels: { font: responsiveFont, color: tickC },
					grid:        { color: gridC },
					...range,
				},
			} : chartType === 'polarArea' ? {
				r: {
					// ticks.z > 0 draws the numbers above the segments (Chart.js
					// layers scales by ticks.z / grid.z, not a scale-level z);
					// otherwise they're hidden behind them. The translucent
					// backdrop keeps them readable where they overlap a segment.
					ticks: { z: 1, font: responsiveFont, color: tickC, backdropColor: 'rgba(255,255,255,0.75)', ...stepTicks },
					grid:  { color: gridC },
					...range,
				},
			} : {},
		},
	};

	if ( chartType === 'doughnut' ) {
		config.options.cutout = `${ cutout }%`;
	}

	return config;
}
