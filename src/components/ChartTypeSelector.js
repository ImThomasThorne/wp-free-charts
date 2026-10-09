import { __ } from '@wordpress/i18n';

const CHART_TYPES = [
	{
		type: 'bar',
		label: __( 'Bar', 'wp-free-charts' ),
		desc: 'Compare categories with vertical bars',
		svg: (
			<svg viewBox="0 0 40 32" fill="currentColor">
				<rect x="2"  y="16" width="8"  height="14" rx="1" opacity="0.9"/>
				<rect x="13" y="8"  width="8"  height="22" rx="1" opacity="0.9"/>
				<rect x="24" y="12" width="8"  height="18" rx="1" opacity="0.9"/>
			</svg>
		),
	},
	{
		type: 'horizontalBar',
		label: __( 'Horizontal Bar', 'wp-free-charts' ),
		desc: 'Compare categories with horizontal bars',
		svg: (
			<svg viewBox="0 0 40 32" fill="currentColor">
				<rect x="2"  y="4"  width="18" height="6" rx="1" opacity="0.9"/>
				<rect x="2"  y="13" width="28" height="6" rx="1" opacity="0.9"/>
				<rect x="2"  y="22" width="22" height="6" rx="1" opacity="0.9"/>
			</svg>
		),
	},
	{
		type: 'line',
		label: __( 'Line', 'wp-free-charts' ),
		desc: 'Show trends over time',
		svg: (
			<svg viewBox="0 0 40 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
				<polyline points="2,28 10,18 20,22 30,8 38,12"/>
				<circle cx="2"  cy="28" r="2" fill="currentColor" stroke="none"/>
				<circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>
				<circle cx="20" cy="22" r="2" fill="currentColor" stroke="none"/>
				<circle cx="30" cy="8"  r="2" fill="currentColor" stroke="none"/>
				<circle cx="38" cy="12" r="2" fill="currentColor" stroke="none"/>
			</svg>
		),
	},
	{
		type: 'pie',
		label: __( 'Pie', 'wp-free-charts' ),
		desc: 'Show proportions of a whole',
		svg: (
			/* centre (20,16) r=13; slices 40%/35%/25% → 144°/126°/90° clockwise from top */
			<svg viewBox="0 0 40 32">
				<path d="M20 16 L20 3 A13 13 0 0 1 27.6 26.5 Z" fill="#4e79a7"/>
				<path d="M20 16 L27.6 26.5 A13 13 0 0 1 7 16 Z" fill="#f28e2b"/>
				<path d="M20 16 L7 16 A13 13 0 0 1 20 3 Z" fill="#e15759"/>
			</svg>
		),
	},
	{
		type: 'doughnut',
		label: __( 'Doughnut', 'wp-free-charts' ),
		desc: 'Pie chart with a cutout centre',
		svg: (
			<svg viewBox="0 0 40 32">
				<path d="M20 16 L20 3 A13 13 0 0 1 27.6 26.5 Z" fill="#4e79a7" opacity="0.9"/>
				<path d="M20 16 L27.6 26.5 A13 13 0 0 1 7 16 Z" fill="#f28e2b" opacity="0.9"/>
				<path d="M20 16 L7 16 A13 13 0 0 1 20 3 Z" fill="#e15759" opacity="0.9"/>
				<circle cx="20" cy="16" r="6" fill="white"/>
			</svg>
		),
	},
	{
		type: 'polarArea',
		label: __( 'Polar Area', 'wp-free-charts' ),
		desc: 'Radial segments with equal angles',
		svg: (
			<svg viewBox="0 0 40 32">
				<circle cx="20" cy="16" r="13" fill="#f0f0f0" stroke="#ddd" strokeWidth="0.5"/>
				<path d="M20 16 L20 4 A12 12 0 0 1 30.4 22 Z" fill="#4e79a7" opacity="0.85"/>
				<path d="M20 16 L30.4 22 A12 12 0 0 1 9.6 22 Z" fill="#f28e2b" opacity="0.85"/>
				<path d="M20 16 L9.6 22 A12 12 0 0 1 20 4 Z" fill="#e15759" opacity="0.85"/>
			</svg>
		),
	},
	{
		type: 'radar',
		label: __( 'Radar', 'wp-free-charts' ),
		desc: 'Compare multiple variables',
		svg: (
			<svg viewBox="0 0 40 32" fill="none" stroke="currentColor" strokeWidth="1">
				<polygon points="20,4 34,22 6,22" stroke="#ccc" strokeWidth="0.8"/>
				<polygon points="20,9 29,20 11,20" stroke="#ccc" strokeWidth="0.8"/>
				<polygon points="20,14 24,18 16,18" stroke="#ccc" strokeWidth="0.8"/>
				<polygon points="20,6 32,21 8,21" fill="#4e79a7" fillOpacity="0.4" stroke="#4e79a7" strokeWidth="1.5"/>
				<line x1="20" y1="4" x2="20" y2="22" strokeWidth="0.8" stroke="#ccc"/>
				<line x1="6"  y1="22" x2="34" y2="22" strokeWidth="0.8" stroke="#ccc"/>
				<line x1="6"  y1="22" x2="20" y2="4"  strokeWidth="0.8" stroke="#ccc"/>
			</svg>
		),
	},
	{
		type: 'scatter',
		label: __( 'Scatter', 'wp-free-charts' ),
		desc: 'Show correlation between X/Y values',
		svg: (
			<svg viewBox="0 0 40 32" fill="currentColor">
				<circle cx="8"  cy="24" r="2.5" opacity="0.8"/>
				<circle cx="14" cy="16" r="2.5" opacity="0.8"/>
				<circle cx="20" cy="20" r="2.5" opacity="0.8"/>
				<circle cx="26" cy="10" r="2.5" opacity="0.8"/>
				<circle cx="32" cy="14" r="2.5" opacity="0.8"/>
				<circle cx="18" cy="8"  r="2.5" opacity="0.8" fill="#f28e2b"/>
				<circle cx="10" cy="12" r="2.5" opacity="0.8" fill="#f28e2b"/>
				<circle cx="28" cy="22" r="2.5" opacity="0.8" fill="#f28e2b"/>
			</svg>
		),
	},
];

export default function ChartTypeSelector( { value, onChange } ) {
	const normalised = value === 'bar' ? 'bar' : value;

	return (
		<div className="wfc-type-grid">
			{ CHART_TYPES.map( ( { type, label, desc, svg } ) => (
				<button
					key={ type }
					type="button"
					className={ `wfc-type-card${ normalised === type ? ' is-selected' : '' }` }
					onClick={ () => onChange( type ) }
				>
					<span className="wfc-type-icon">{ svg }</span>
					<span className="wfc-type-label">{ label }</span>
					<span className="wfc-type-desc">{ desc }</span>
				</button>
			) ) }
		</div>
	);
}
