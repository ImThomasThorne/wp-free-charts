export function generateUniqueId() {
	return 'wfc-' + Math.random().toString( 36 ).substr( 2, 9 ) + Date.now().toString( 36 );
}

export function getDefaultColors() {
	return [
		'#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
		'#59a14f', '#edc948', '#b07aa1', '#ff9da7',
		'#9c755f', '#bab0ac',
	];
}

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
		plugins: [ legendSpacingPlugin ],
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
					labels:   { font: fontObj, padding: 16, usePointStyle: true },
				},
				tooltip: {
					enabled: showTooltips,
				},
			},
			scales: hasCartesian ? {
				x: {
					stacked: stacked,
					grid:    { display: showGridX, color: gridC },
					title:   xAxisLabel ? { display: true, text: xAxisLabel, font: fontObj } : undefined,
					ticks:   { font: fontObj, color: tickC, ...( valueAxis === 'x' ? stepTicks : {} ) },
					...( valueAxis === 'x' ? range : {} ),
				},
				y: {
					stacked: stacked,
					grid:    { display: showGridY, color: gridC },
					title:   yAxisLabel ? { display: true, text: yAxisLabel, font: fontObj } : undefined,
					ticks:   { font: fontObj, color: tickC, ...( valueAxis === 'y' ? stepTicks : {} ) },
					...( valueAxis === 'y' ? range : {} ),
				},
			} : isRadar ? {
				r: {
					ticks:       { font: fontObj, backdropColor: 'transparent', color: tickC, ...stepTicks },
					pointLabels: { font: fontObj, color: tickC },
					grid:        { color: gridC },
					...range,
				},
			} : chartType === 'polarArea' && customRange ? {
				r: {
					ticks: { ...stepTicks },
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
