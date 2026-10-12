/**
 * Front-end script (block.json "viewScript").
 *
 * Each saved block contains a <canvas> plus a JSON <script class="wfc-chart-config">
 * written by save.js. This script reads that JSON, builds the Chart.js config with
 * the same helper the editor uses, and wires up the optional filter buttons.
 */
import './style.css';
import { Chart, registerables } from 'chart.js';
import {
	tableDataToChartConfig,
	getDefaultColors,
	getFilterLabels,
	isPieLikeType,
} from './utils/chartDataUtils';

Chart.register( ...registerables );

/**
 * Rebuilds the filter buttons from the chart data and makes them toggle it.
 *
 * The buttons in the saved HTML come from save.js, whose output can't change
 * without breaking block validation for existing posts, and older saves have
 * wrong labels for some chart/filter combinations. So the buttons are
 * regenerated here from getFilterLabels(), which is the source of truth.
 */
function setupFilters( block, chart, { chartType, filterType, tableData } ) {
	const container = block.querySelector( '.wfc-filters' );
	if ( ! container ) return;

	const isPieLike = isPieLikeType( chartType );
	const byLabel   = ! isPieLike && filterType === 'label';
	const labels    = getFilterLabels( chartType, filterType, tableData );
	const visible   = labels.map( () => true );

	// Category filtering on cartesian/radar charts has no Chart.js API, so keep
	// the full data and re-filter it on every toggle.
	const original = {
		labels: [ ...chart.data.labels ],
		data:   chart.data.datasets.map( ( ds ) => [ ...ds.data ] ),
	};

	const apply = ( i ) => {
		if ( isPieLike ) {
			// Slices: Chart.js tracks per-index visibility for pie-like charts.
			if ( chart.getDataVisibility( i ) !== visible[ i ] ) chart.toggleDataVisibility( i );
		} else if ( byLabel ) {
			chart.data.labels = original.labels.filter( ( _, j ) => visible[ j ] );
			chart.data.datasets.forEach( ( ds, d ) => {
				ds.data = original.data[ d ].filter( ( _, j ) => visible[ j ] );
			} );
		} else {
			chart.setDatasetVisibility( i, visible[ i ] );
		}
		chart.update();
	};

	const buttons = labels.map( ( label, i ) => {
		const btn = document.createElement( 'button' );
		btn.type        = 'button';
		btn.className   = 'wfc-filter-btn wfc-filter-btn--active';
		btn.textContent = label;
		btn.setAttribute( 'aria-pressed', 'true' );
		btn.addEventListener( 'click', () => {
			visible[ i ] = ! visible[ i ];
			btn.classList.toggle( 'wfc-filter-btn--active', visible[ i ] );
			btn.setAttribute( 'aria-pressed', String( visible[ i ] ) );
			apply( i );
		} );
		return btn;
	} );

	container.replaceChildren( ...buttons );
}

function initCharts() {
	document.querySelectorAll( '.wfc-block' ).forEach( ( block ) => {
		const configEl = block.querySelector( '.wfc-chart-config' );
		const canvas   = block.querySelector( '.wfc-canvas' );
		if ( ! configEl || ! canvas ) return;

		let cfg;
		try {
			cfg = JSON.parse( configEl.textContent );
		} catch ( e ) {
			return;
		}

		const {
			chartType, tableData, datasetColors, showLegend, legendPosition,
			legendAlign, showTooltips, enableAnimation, stacked, tension,
			pointRadius, fillArea, barBorderRadius, indexAxis, cutout,
			showGridX, showGridY, fontSize, fontFamily, fontWeight,
			xAxisLabel, yAxisLabel, gridColor, tickColor,
			enableFilters,
			customRange, rangeMin, rangeMax, rangeStep,
		} = cfg;

		// Pad the saved colour list with defaults so every series/slice has one.
		const defaults    = getDefaultColors();
		const numDatasets = ( tableData[ 0 ]?.length ?? 2 ) - 1;
		const colorCount  = isPieLikeType( chartType ) ? tableData.length - 1 : numDatasets;
		const colors      = [ ...( datasetColors || [] ) ];
		while ( colors.length < colorCount ) colors.push( defaults[ colors.length % defaults.length ] );

		const chartConfig = tableDataToChartConfig( {
			tableData, chartType, datasetColors: colors, showLegend, legendPosition,
			legendAlign, showTooltips, enableAnimation, stacked, tension, pointRadius,
			fillArea, barBorderRadius, indexAxis, cutout, showGridX, showGridY,
			fontSize, fontFamily, fontWeight, xAxisLabel, yAxisLabel,
			gridColor, tickColor, customRange, rangeMin, rangeMax, rangeStep,
		} );

		const chart = new Chart( canvas, chartConfig );

		if ( enableFilters ) {
			setupFilters( block, chart, cfg );
		}
	} );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initCharts );
} else {
	initCharts();
}
