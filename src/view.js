import './style.css';
import { Chart, registerables } from 'chart.js';
import { tableDataToChartConfig, getDefaultColors } from './utils/chartDataUtils';

Chart.register( ...registerables );

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
			enableFilters, filterType,
		} = cfg;

		const defaults      = getDefaultColors();
		const isPieType     = [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
		const numDatasets   = ( tableData[ 0 ]?.length ?? 2 ) - 1;
		const colorCount    = isPieType ? tableData.length - 1 : numDatasets;
		const colors        = [ ...( datasetColors || [] ) ];
		while ( colors.length < colorCount ) colors.push( defaults[ colors.length % defaults.length ] );

		const chartConfig = tableDataToChartConfig( {
			tableData, chartType, datasetColors: colors, showLegend, legendPosition,
			legendAlign, showTooltips, enableAnimation, stacked, tension, pointRadius,
			fillArea, barBorderRadius, indexAxis, cutout, showGridX, showGridY,
			fontSize, fontFamily, fontWeight, xAxisLabel, yAxisLabel,
			gridColor, tickColor,
		} );

		const chart = new Chart( canvas, chartConfig );

		if ( enableFilters ) {
			block.querySelectorAll( '.wfc-filter-btn' ).forEach( ( btn ) => {
				btn.addEventListener( 'click', () => {
					const idx    = parseInt( btn.dataset.filterIndex, 10 );
					const active = btn.classList.toggle( 'wfc-filter-btn--active' );

					if ( filterType === 'dataset' ) {
						const meta  = chart.getDatasetMeta( idx );
						meta.hidden = ! active;
					} else {
						chart.data.datasets.forEach( ( _, dsIdx ) => {
							const meta = chart.getDatasetMeta( dsIdx );
							if ( meta.data[ idx ] ) meta.data[ idx ].hidden = ! active;
						} );
					}

					chart.update();
				} );
			} );
		}
	} );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initCharts );
} else {
	initCharts();
}
