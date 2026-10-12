// Generates test pages for tools/visual-check/shoot.ps1 (see that file).
// Each page mimics save.js markup for one chart type, loads the built
// view.js + style-view.css, and adds aggressive "theme" button styles to
// prove the filter buttons resist them. "#click=1,2" in a page URL clicks
// those filter buttons after load.
// Usage: node gen.mjs <buildDir> <outDir>
import fs from 'node:fs';
import path from 'node:path';

const [ , , buildDir, outDir ] = process.argv;
fs.mkdirSync( outDir, { recursive: true } );
for ( const f of [ 'view.js', 'style-view.css' ] ) {
	fs.copyFileSync( path.join( buildDir, f ), path.join( outDir, f ) );
}

const months = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
const multi  = [ [ '', 'Applications', 'Interviews', 'Offers' ], ...months.map( ( m, i ) => [ m, 20 + ( i * 37 ) % 70, 10 + ( i * 23 ) % 50, 2 + ( i * 11 ) % 25 ] ) ];
const slices = [ [ '', 'Share' ], [ 'Housing', 30 ], [ 'Transport', 15 ], [ 'Food and groceries', 20 ], [ 'Utilities', 10 ], [ 'Leisure', 12 ], [ 'Savings', 13 ] ];
const radar  = [ [ '', 'Team A', 'Team B' ], [ 'Communication', 4 ], [ 'Teamwork', 5 ], [ 'Problem solving', 3 ], [ 'Leadership', 2 ], [ 'Creativity', 5 ], [ 'Reliability', 4 ] ].map( ( r, i ) => i ? [ ...r, 6 - r[ 1 ] ] : r );
const scatter = [ [ '', 'Age (x)', 'Score (y)' ], ...Array.from( { length: 15 }, ( _, i ) => [ `P${ i }`, 14 + i, 30 + ( i * 17 ) % 60 ] ) ];

const types = {
	bar: multi, horizontalBar: multi, line: multi, scatter,
	pie: slices, doughnut: slices, polarArea: slices, radar,
};

const base = {
	showLegend: true, legendAlign: 'center', showTooltips: true, enableAnimation: false,
	stacked: false, tension: 0.3, pointRadius: 4, fillArea: false, barBorderRadius: 4,
	indexAxis: 'x', cutout: 55, showGridX: true, showGridY: true, fontSize: 16,
	fontFamily: '', fontWeight: '', gridColor: '', tickColor: '',
	enableFilters: true, filterType: 'dataset', datasetColors: [],
};

const themeCss = 'body{margin:0;padding:16px;font-family:sans-serif}' +
	'button{padding:14px 32px;font-size:18px;text-transform:uppercase;letter-spacing:.1em;min-height:48px;font-weight:700;border-radius:4px;background:#222;color:#fff;border:0}';

// Clicks the filter buttons listed in "#click=1,2" once the chart is up.
const clicker = `<script>setTimeout(function(){var m=location.hash.match(/click=([\\d,]+)/);if(!m)return;
var b=document.querySelectorAll('.wfc-filter-btn');m[1].split(',').forEach(function(i){b[i]&&b[i].click();});},300);</script>`;

function page( type, legendPosition, filterType = null, title = null ) {
	const isPie = [ 'pie', 'doughnut', 'polarArea' ].includes( type );
	const td    = types[ type ];
	const cfg   = {
		...base, chartType: type, tableData: td, legendPosition,
		xAxisLabel: isPie || type === 'radar' ? '' : 'X label',
		yAxisLabel: isPie || type === 'radar' ? '' : 'Y label',
		filterType: filterType || ( isPie ? 'label' : 'dataset' ),
	};
	const labels  = isPie ? td.slice( 1 ).map( ( r ) => r[ 0 ] ) : td[ 0 ].slice( 1 );
	const buttons = labels.map( ( l, i ) => `<button type="button" class="wfc-filter-btn wfc-filter-btn--active" data-filter-index="${ i }">${ l }</button>` ).join( '' );
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="style-view.css"><style>${ themeCss }</style></head><body>
<figure class="wfc-block" style="padding:24px 24px 24px 24px;margin:0 0 0 0">
<div class="wfc-chart-title" style="text-align:center;font-size:22px;font-weight:bold">${ title || `${ type } (legend ${ legendPosition })` }</div>
<div class="wfc-chart-container" style="position:relative;height:400px;--wfc-height:400px"><canvas class="wfc-canvas" role="img"></canvas></div>
<div class="wfc-filters" data-filter-type="${ cfg.filterType }">${ buttons }</div>
<script type="application/json" class="wfc-chart-config">${ JSON.stringify( cfg ) }</script></figure>
<script src="view.js"></script>${ clicker }</body></html>`;
}

// Filter test pages: every type with each filter type; the grid clicks button 1 off.
for ( const type of Object.keys( types ) ) {
	for ( const ft of [ 'dataset', 'label' ] ) {
		fs.writeFileSync( path.join( outDir, `${ type }-filter-${ ft }.html` ),
			page( type, 'top', ft, `${ type }: ${ ft } filter, 2nd off` ) );
	}
}
{
	const frames = Object.keys( types ).flatMap( ( t ) => [ 'dataset', 'label' ].map( ( ft ) =>
		`<iframe src="${ t }-filter-${ ft }.html#click=1" width="375" height="560"></iframe>` ) ).join( '' );
	fs.writeFileSync( path.join( outDir, 'grid-filters.html' ),
		`<!doctype html><html><body style="margin:0;background:#ccc"><div style="display:grid;grid-template-columns:repeat(4,375px);gap:8px;padding:8px">${ frames }</div>
<style>iframe{border:0;background:#fff}</style></body></html>` );
}

for ( const legend of [ 'top', 'right' ] ) {
	for ( const type of Object.keys( types ) ) {
		fs.writeFileSync( path.join( outDir, `${ type }-${ legend }.html` ), page( type, legend ) );
	}
}

// Grid pages: one per (width, legend) combo.
for ( const [ name, width, cols ] of [ [ 'mobile', 375, 4 ], [ 'desktop', 760, 2 ] ] ) {
	for ( const legend of [ 'top', 'right' ] ) {
		const frames = Object.keys( types ).map( ( t ) => `<iframe src="${ t }-${ legend }.html" width="${ width }" height="680"></iframe>` ).join( '' );
		fs.writeFileSync( path.join( outDir, `grid-${ name }-${ legend }.html` ),
			`<!doctype html><html><body style="margin:0;background:#ccc"><div style="display:grid;grid-template-columns:repeat(${ cols },${ width }px);gap:8px;padding:8px">${ frames }</div>
<style>iframe{border:0;background:#fff}</style></body></html>` );
	}
}
console.log( 'ok' );
