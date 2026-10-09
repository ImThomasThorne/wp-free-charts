import { useState, useEffect } from '@wordpress/element';
import {
	InspectorControls,
	BlockControls,
	useBlockProps,
	useSettings,
} from '@wordpress/block-editor';
import {
	PanelBody,
	Button,
	ToolbarGroup,
	ToolbarButton,
	Modal,
	SelectControl,
	TextControl,
	ToggleControl,
	RangeControl,
	BaseControl,
	ColorPalette,
	FontSizePicker,
	__experimentalBoxControl    as BoxControl,
	__experimentalUnitControl   as UnitControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

import ChartPreview      from './components/ChartPreview';
import DataSpreadsheet   from './components/DataSpreadsheet';
import ChartTypeSelector from './components/ChartTypeSelector';
import { tableDataToChartConfig, getDefaultColors, generateUniqueId } from './utils/chartDataUtils';

const FONT_OPTIONS = [
	{ label: 'Theme Default', value: '' },
	{ label: 'Arial',           value: 'Arial, sans-serif' },
	{ label: 'Helvetica',       value: "'Helvetica Neue', Helvetica, sans-serif" },
	{ label: 'Georgia',         value: 'Georgia, serif' },
	{ label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
	{ label: 'Verdana',         value: 'Verdana, Geneva, sans-serif' },
	{ label: 'Tahoma',          value: 'Tahoma, Geneva, sans-serif' },
	{ label: 'Trebuchet MS',    value: "'Trebuchet MS', sans-serif" },
	{ label: 'Courier New',     value: "'Courier New', monospace" },
	{ label: 'Impact',          value: 'Impact, Charcoal, sans-serif' },
];

const WEIGHT_OPTIONS = [
	{ label: __( 'Default',          'wp-free-charts' ), value: ''       },
	{ label: __( 'Thin (100)',        'wp-free-charts' ), value: '100'    },
	{ label: __( 'Light (300)',       'wp-free-charts' ), value: '300'    },
	{ label: __( 'Normal',            'wp-free-charts' ), value: 'normal' },
	{ label: __( 'Medium (500)',      'wp-free-charts' ), value: '500'    },
	{ label: __( 'Semi-Bold (600)',   'wp-free-charts' ), value: '600'    },
	{ label: __( 'Bold',              'wp-free-charts' ), value: 'bold'   },
	{ label: __( 'Extra Bold (800)',  'wp-free-charts' ), value: '800'    },
];

const LETTER_SPACING_UNITS = [
	{ value: 'px',  label: 'px',  default: 0 },
	{ value: 'em',  label: 'em',  default: 0 },
	{ value: 'rem', label: 'rem', default: 0 },
];

const HEIGHT_UNITS = [
	{ value: 'px',  label: 'px',  default: 400 },
	{ value: 'vh',  label: 'vh',  default: 50  },
	{ value: 'em',  label: 'em',  default: 25  },
	{ value: 'rem', label: 'rem', default: 25  },
];

const BORDER_UNITS = [
	{ value: 'px',  label: 'px',  default: 0 },
	{ value: 'em',  label: 'em',  default: 0 },
	{ value: 'rem', label: 'rem', default: 0 },
];

const RADIUS_UNITS = [
	{ value: 'px',  label: 'px',  default: 0 },
	{ value: 'em',  label: 'em',  default: 0 },
	{ value: 'rem', label: 'rem', default: 0 },
	{ value: '%',   label: '%',   default: 0 },
];

const DEFAULT_SPACING_UNITS = [
	{ value: 'px',  label: 'px',  default: 0 },
	{ value: 'em',  label: 'em',  default: 0 },
	{ value: 'rem', label: 'rem', default: 0 },
	{ value: '%',   label: '%',   default: 0 },
	{ value: 'vw',  label: 'vw',  default: 0 },
	{ value: 'vh',  label: 'vh',  default: 0 },
];

/**
 * Convert theme fontSizes (which may use rem/em strings) to plain px numbers
 * for use by Chart.js, which only accepts numeric font sizes.
 */
function toNumericFontSizes( fontSizes ) {
	if ( ! fontSizes?.length ) return [];
	return fontSizes.map( ( { name, slug, size } ) => {
		let n;
		if ( typeof size === 'number' ) {
			n = Math.round( size );
		} else {
			const parsed = parseFloat( size );
			if ( isNaN( parsed ) ) return null;
			const s = String( size );
			n = ( s.endsWith( 'rem' ) || s.endsWith( 'em' ) )
				? Math.round( parsed * 16 )
				: Math.round( parsed );
		}
		return n > 0 ? { name, slug, size: n } : null;
	} ).filter( Boolean );
}

/** Normalise a value that may be a legacy number (px) or a new string. */
function toUnitVal( v, dflt = '0px' ) {
	if ( v === undefined || v === null || v === '' ) return dflt;
	if ( typeof v === 'number' ) return `${ v }px`;
	return v;
}

function hasMeasure( v ) {
	return !! v && parseFloat( v ) !== 0;
}

export default function Edit( { attributes, setAttributes } ) {
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

	const [ dataOpen, setDataOpen ] = useState( false );
	const [ typeOpen, setTypeOpen ] = useState( false );

	const [ colorPalette ] = useSettings( 'color.palette' );
	const [ fontSizes ]    = useSettings( 'typography.fontSizes' );
	const [ spacingUnits ] = useSettings( 'spacing.units' );

	const spacingUnitList = spacingUnits?.length
		? spacingUnits.map( ( u ) => ( { value: u, label: u, default: 0 } ) )
		: DEFAULT_SPACING_UNITS;

	useEffect( () => {
		if ( ! uniqueId ) setAttributes( { uniqueId: generateUniqueId() } );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const isPieType = [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
	const isLine    = [ 'line', 'radar' ].includes( chartType );
	const isBar     = chartType === 'bar' || chartType === 'horizontalBar';
	const isScatter = chartType === 'scatter';
	const hasValueScale = ! [ 'pie', 'doughnut' ].includes( chartType );

	const defaults       = getDefaultColors();
	const numDatasets    = ( tableData[ 0 ]?.length ?? 2 ) - 1;
	const colorCount     = isPieType ? tableData.length - 1 : numDatasets;
	const resolvedColors = [ ...datasetColors ];
	while ( resolvedColors.length < colorCount ) {
		resolvedColors.push( defaults[ resolvedColors.length % defaults.length ] );
	}

	const chartConfig = tableDataToChartConfig( {
		tableData, chartType, datasetColors: resolvedColors,
		showLegend, legendPosition, legendAlign, showTooltips, enableAnimation,
		stacked, tension, pointRadius, fillArea, barBorderRadius, indexAxis,
		cutout, showGridX, showGridY, fontSize, fontFamily, fontWeight,
		xAxisLabel, yAxisLabel, gridColor, tickColor,
		customRange, rangeMin, rangeMax, rangeStep,
	} );

	const setColor = ( index, val ) => {
		const next = [ ...resolvedColors ];
		next[ index ] = val || defaults[ index % defaults.length ];
		setAttributes( { datasetColors: next } );
	};

	const colorLabels = isPieType
		? tableData.slice( 1 ).map( ( r ) => String( r[ 0 ] || '' ) )
		: ( tableData[ 0 ]?.slice( 1 ) ?? [] ).map( String );

	const filterLabels = isPieType
		? tableData.slice( 1 ).map( ( r ) => r[ 0 ] )
		: ( tableData[ 0 ]?.slice( 1 ) ?? [] );

	const chartHeightVal = toUnitVal( chartHeight, '400px' );
	const hasBorder      = hasMeasure( toUnitVal( borderWidth, '0' ) );
	const hasRadius      = hasMeasure( toUnitVal( borderRadius, '0' ) );

	const blockProps = useBlockProps( {
		style: {
			backgroundColor: backgroundColor || undefined,
			padding:      `${ toUnitVal( paddingTop ) } ${ toUnitVal( paddingRight ) } ${ toUnitVal( paddingBottom ) } ${ toUnitVal( paddingLeft ) }`,
			margin:       `${ toUnitVal( marginTop, '0' ) } ${ toUnitVal( marginRight, '0' ) } ${ toUnitVal( marginBottom, '0' ) } ${ toUnitVal( marginLeft, '0' ) }`,
			border:       hasBorder ? `${ toUnitVal( borderWidth ) } ${ borderStyle } ${ borderColor }` : undefined,
			borderRadius: hasRadius ? toUnitVal( borderRadius, '0' ) : undefined,
			fontFamily:   fontFamily   || undefined,
			fontWeight:   fontWeight   || undefined,
			fontStyle:    fontStyle && fontStyle !== 'normal' ? fontStyle : undefined,
			lineHeight:   lineHeight   || undefined,
			letterSpacing: letterSpacing || undefined,
			textTransform: textTransform || undefined,
		},
	} );

	return (
		<>
			{ /* ── Toolbar ─────────────────────────────────────────────────────────── */ }
			<BlockControls>
				<ToolbarGroup>
					<ToolbarButton icon="edit" onClick={ () => setDataOpen( true ) }>
						{ __( 'Edit Data', 'wp-free-charts' ) }
					</ToolbarButton>
					<ToolbarButton onClick={ () => setTypeOpen( true ) }>
						{ chartType.charAt( 0 ).toUpperCase() + chartType.slice( 1 ) } { __( 'Chart', 'wp-free-charts' ) }
					</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>

			{ /* ── Sidebar ──────────────────────────────────────────────────────────── */ }
			<InspectorControls>

				{ /* Title & Legend */ }
				<PanelBody title={ __( 'Title & Legend', 'wp-free-charts' ) } initialOpen>
					<ToggleControl
						label={ __( 'Show Title', 'wp-free-charts' ) }
						checked={ showTitle }
						onChange={ ( v ) => setAttributes( { showTitle: v } ) }
					/>
					{ showTitle && <>
						<TextControl
							label={ __( 'Title Text', 'wp-free-charts' ) }
							value={ title }
							onChange={ ( v ) => setAttributes( { title: v } ) }
							placeholder={ __( 'Enter chart title…', 'wp-free-charts' ) }
						/>
						<BaseControl label={ __( 'Title Font Size', 'wp-free-charts' ) } __nextHasNoMarginBottom={ false }>
							<FontSizePicker
								fontSizes={ fontSizes }
								value={ titleFontSize }
								onChange={ ( v ) =>
									setAttributes( {
										titleFontSize: v !== undefined
											? ( typeof v === 'number' ? `${ v }px` : v )
											: '22px',
									} )
								}
								disableCustomFontSizes={ false }
								withSlider={ false }
							/>
						</BaseControl>
						<SelectControl
							label={ __( 'Alignment', 'wp-free-charts' ) }
							value={ titleAlign }
							options={ [
								{ label: 'Left',   value: 'left'   },
								{ label: 'Centre', value: 'center' },
								{ label: 'Right',  value: 'right'  },
							] }
							onChange={ ( v ) => setAttributes( { titleAlign: v } ) }
						/>
						<SelectControl
							label={ __( 'Font Weight', 'wp-free-charts' ) }
							value={ titleFontWeight }
							options={ WEIGHT_OPTIONS.map( ( o ) => o.value === '' ? { ...o, label: __( 'Bold (default)', 'wp-free-charts' ) } : o ) }
							onChange={ ( v ) => setAttributes( { titleFontWeight: v || 'bold' } ) }
						/>
						<SelectControl
							label={ __( 'Font Style', 'wp-free-charts' ) }
							value={ titleFontStyle || 'normal' }
							options={ [
								{ label: 'Normal', value: 'normal' },
								{ label: 'Italic', value: 'italic' },
							] }
							onChange={ ( v ) => setAttributes( { titleFontStyle: v } ) }
						/>
						<UnitControl
							label={ __( 'Letter Spacing', 'wp-free-charts' ) }
							value={ titleLetterSpacing || '' }
							onChange={ ( v ) => setAttributes( { titleLetterSpacing: v || '' } ) }
							units={ LETTER_SPACING_UNITS }
						/>
						<BaseControl label={ __( 'Title Colour', 'wp-free-charts' ) }>
							<ColorPalette
								colors={ colorPalette }
								value={ titleColor }
								onChange={ ( v ) => setAttributes( { titleColor: v || '#111111' } ) }
								disableCustomColors={ false }
							/>
						</BaseControl>
					</> }

					<ToggleControl
						label={ __( 'Show Legend', 'wp-free-charts' ) }
						checked={ showLegend }
						onChange={ ( v ) => setAttributes( { showLegend: v } ) }
					/>
					{ showLegend && <>
						<SelectControl
							label={ __( 'Legend Position', 'wp-free-charts' ) }
							value={ legendPosition }
							options={ [
								{ label: 'Top',    value: 'top'    },
								{ label: 'Bottom', value: 'bottom' },
								{ label: 'Left',   value: 'left'   },
								{ label: 'Right',  value: 'right'  },
							] }
							onChange={ ( v ) => setAttributes( { legendPosition: v } ) }
						/>
						<SelectControl
							label={ __( 'Legend Align', 'wp-free-charts' ) }
							value={ legendAlign }
							options={ [
								{ label: 'Start',  value: 'start'  },
								{ label: 'Centre', value: 'center' },
								{ label: 'End',    value: 'end'    },
							] }
							onChange={ ( v ) => setAttributes( { legendAlign: v } ) }
						/>
					</> }
				</PanelBody>

				{ /* Dataset Colours */ }
				<PanelBody title={ __( 'Dataset Colours', 'wp-free-charts' ) } initialOpen={ false }>
					<p className="wfc-hint">
						{ isPieType
							? __( 'One colour per slice.', 'wp-free-charts' )
							: __( 'One colour per dataset column.', 'wp-free-charts' ) }
					</p>
					{ resolvedColors.slice( 0, colorCount ).map( ( color, i ) => (
						<BaseControl key={ i } label={ colorLabels[ i ] || `Item ${ i + 1 }` } className="wfc-color-row">
							<ColorPalette
								colors={ colorPalette }
								value={ color }
								onChange={ ( v ) => setColor( i, v ) }
								disableCustomColors={ false }
							/>
						</BaseControl>
					) ) }
				</PanelBody>

				{ /* Front-end Filters */ }
				<PanelBody title={ __( 'Front-End Filters', 'wp-free-charts' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Enable Filters', 'wp-free-charts' ) }
						checked={ enableFilters }
						onChange={ ( v ) => setAttributes( { enableFilters: v } ) }
						help={ __( 'Show toggle buttons so visitors can show/hide series or categories.', 'wp-free-charts' ) }
					/>
					{ enableFilters && (
						<SelectControl
							label={ __( 'Filter By', 'wp-free-charts' ) }
							value={ filterType }
							options={ [
								{ label: 'Dataset (series)',  value: 'dataset' },
								{ label: 'Label (category)', value: 'label'   },
							] }
							onChange={ ( v ) => setAttributes( { filterType: v } ) }
						/>
					) }
				</PanelBody>

				{ /* Chart Options */ }
				<PanelBody title={ __( 'Chart Options', 'wp-free-charts' ) } initialOpen={ false }>
					<UnitControl
						label={ __( 'Chart Height', 'wp-free-charts' ) }
						value={ chartHeightVal }
						onChange={ ( v ) => setAttributes( { chartHeight: v || '400px' } ) }
						units={ HEIGHT_UNITS }
						min={ 100 }
					/>
					<ToggleControl
						label={ __( 'Show Tooltips', 'wp-free-charts' ) }
						checked={ showTooltips }
						onChange={ ( v ) => setAttributes( { showTooltips: v } ) }
					/>
					<ToggleControl
						label={ __( 'Enable Animation', 'wp-free-charts' ) }
						checked={ enableAnimation }
						onChange={ ( v ) => setAttributes( { enableAnimation: v } ) }
					/>
					{ ( isBar || isLine || isScatter ) && <>
						<ToggleControl
							label={ __( 'Show X Grid Lines', 'wp-free-charts' ) }
							checked={ showGridX }
							onChange={ ( v ) => setAttributes( { showGridX: v } ) }
						/>
						<ToggleControl
							label={ __( 'Show Y Grid Lines', 'wp-free-charts' ) }
							checked={ showGridY }
							onChange={ ( v ) => setAttributes( { showGridY: v } ) }
						/>
						<BaseControl label={ __( 'Grid Line Colour', 'wp-free-charts' ) }>
							<ColorPalette
								colors={ colorPalette }
								value={ gridColor }
								onChange={ ( v ) => setAttributes( { gridColor: v || '' } ) }
								disableCustomColors={ false }
							/>
						</BaseControl>
						<BaseControl label={ __( 'Axis Tick Colour', 'wp-free-charts' ) }>
							<ColorPalette
								colors={ colorPalette }
								value={ tickColor }
								onChange={ ( v ) => setAttributes( { tickColor: v || '' } ) }
								disableCustomColors={ false }
							/>
						</BaseControl>
						<TextControl
							label={ __( 'X-Axis Label', 'wp-free-charts' ) }
							value={ xAxisLabel }
							onChange={ ( v ) => setAttributes( { xAxisLabel: v } ) }
						/>
						<TextControl
							label={ __( 'Y-Axis Label', 'wp-free-charts' ) }
							value={ yAxisLabel }
							onChange={ ( v ) => setAttributes( { yAxisLabel: v } ) }
						/>
					</> }
					{ isBar && <>
						<ToggleControl
							label={ __( 'Stacked', 'wp-free-charts' ) }
							checked={ stacked }
							onChange={ ( v ) => setAttributes( { stacked: v } ) }
						/>
						<SelectControl
							label={ __( 'Orientation', 'wp-free-charts' ) }
							value={ indexAxis }
							options={ [
								{ label: 'Vertical',   value: 'x' },
								{ label: 'Horizontal', value: 'y' },
							] }
							onChange={ ( v ) => setAttributes( { indexAxis: v } ) }
						/>
						<RangeControl
							label={ __( 'Bar Corner Radius', 'wp-free-charts' ) }
							value={ barBorderRadius } min={ 0 } max={ 24 }
							onChange={ ( v ) => setAttributes( { barBorderRadius: v } ) }
						/>
					</> }
					{ isLine && <>
						<RangeControl
							label={ __( 'Line Smoothing', 'wp-free-charts' ) }
							value={ tension } min={ 0 } max={ 1 } step={ 0.05 }
							onChange={ ( v ) => setAttributes( { tension: v } ) }
						/>
						<RangeControl
							label={ __( 'Point Radius', 'wp-free-charts' ) }
							value={ pointRadius } min={ 0 } max={ 16 }
							onChange={ ( v ) => setAttributes( { pointRadius: v } ) }
						/>
						<ToggleControl
							label={ __( 'Fill Area', 'wp-free-charts' ) }
							checked={ fillArea }
							onChange={ ( v ) => setAttributes( { fillArea: v } ) }
						/>
					</> }
					{ hasValueScale && <>
						<ToggleControl
							label={ __( 'Set Value Range', 'wp-free-charts' ) }
							checked={ customRange }
							onChange={ ( v ) => setAttributes( { customRange: v } ) }
							help={ __( 'Fix the start and end of the value axis, e.g. 1 to 6.', 'wp-free-charts' ) }
						/>
						{ customRange && <>
							<TextControl
								type="number"
								label={ __( 'Minimum', 'wp-free-charts' ) }
								value={ rangeMin }
								onChange={ ( v ) => setAttributes( { rangeMin: v } ) }
								placeholder={ __( 'Auto', 'wp-free-charts' ) }
							/>
							<TextControl
								type="number"
								label={ __( 'Maximum', 'wp-free-charts' ) }
								value={ rangeMax }
								onChange={ ( v ) => setAttributes( { rangeMax: v } ) }
								placeholder={ __( 'Auto', 'wp-free-charts' ) }
							/>
							<TextControl
								type="number"
								label={ __( 'Step', 'wp-free-charts' ) }
								value={ rangeStep }
								onChange={ ( v ) => setAttributes( { rangeStep: v } ) }
								placeholder={ __( 'Auto', 'wp-free-charts' ) }
								help={ __( 'Gap between axis numbers, e.g. 1 shows 1, 2, 3… Leave blank for automatic.', 'wp-free-charts' ) }
							/>
						</> }
					</> }
					{ chartType === 'doughnut' && (
						<RangeControl
							label={ __( 'Cutout (%)', 'wp-free-charts' ) }
							value={ cutout } min={ 0 } max={ 90 }
							onChange={ ( v ) => setAttributes( { cutout: v } ) }
						/>
					) }
					<BaseControl label={ __( 'Chart Label Size', 'wp-free-charts' ) } __nextHasNoMarginBottom={ false }>
						<FontSizePicker
							fontSizes={ toNumericFontSizes( fontSizes ) }
							value={ fontSize }
							onChange={ ( v ) => {
								const n = typeof v === 'number'
									? Math.round( v )
									: ( parseFloat( v ) || 13 );
								setAttributes( { fontSize: n || 13 } );
							} }
							disableCustomFontSizes={ false }
							withSlider={ false }
						/>
					</BaseControl>
				</PanelBody>

				{ /* Typography */ }
				<PanelBody title={ __( 'Typography', 'wp-free-charts' ) } initialOpen={ false }>
					<p className="wfc-hint">
						{ __( 'Applies to the block wrapper, title, and filter buttons. Chart axis/legend font is set in Chart Options.', 'wp-free-charts' ) }
					</p>
					<SelectControl
						label={ __( 'Font Family', 'wp-free-charts' ) }
						value={ fontFamily }
						options={ FONT_OPTIONS }
						onChange={ ( v ) => setAttributes( { fontFamily: v } ) }
					/>
					<SelectControl
						label={ __( 'Font Weight', 'wp-free-charts' ) }
						value={ fontWeight || '' }
						options={ WEIGHT_OPTIONS }
						onChange={ ( v ) => setAttributes( { fontWeight: v } ) }
					/>
					<SelectControl
						label={ __( 'Font Style', 'wp-free-charts' ) }
						value={ fontStyle || 'normal' }
						options={ [
							{ label: 'Normal', value: 'normal' },
							{ label: 'Italic', value: 'italic' },
						] }
						onChange={ ( v ) => setAttributes( { fontStyle: v } ) }
					/>
					<UnitControl
						label={ __( 'Line Height', 'wp-free-charts' ) }
						value={ lineHeight || '' }
						onChange={ ( v ) => setAttributes( { lineHeight: v || '' } ) }
						units={ [
							{ value: 'em', label: 'em', default: 1.5 },
							{ value: 'px', label: 'px', default: 20  },
						] }
					/>
					<UnitControl
						label={ __( 'Letter Spacing', 'wp-free-charts' ) }
						value={ letterSpacing || '' }
						onChange={ ( v ) => setAttributes( { letterSpacing: v || '' } ) }
						units={ LETTER_SPACING_UNITS }
					/>
					<SelectControl
						label={ __( 'Text Transform', 'wp-free-charts' ) }
						value={ textTransform || '' }
						options={ [
							{ label: 'Default',    value: ''           },
							{ label: 'Uppercase',  value: 'uppercase'  },
							{ label: 'Lowercase',  value: 'lowercase'  },
							{ label: 'Capitalize', value: 'capitalize' },
						] }
						onChange={ ( v ) => setAttributes( { textTransform: v } ) }
					/>
				</PanelBody>

				{ /* Background */ }
				<PanelBody title={ __( 'Background', 'wp-free-charts' ) } initialOpen={ false }>
					<BaseControl label={ __( 'Background Colour', 'wp-free-charts' ) }>
						<ColorPalette
							colors={ colorPalette }
							value={ backgroundColor }
							onChange={ ( v ) => setAttributes( { backgroundColor: v || '' } ) }
							disableCustomColors={ false }
						/>
					</BaseControl>
				</PanelBody>

				{ /* Spacing */ }
				<PanelBody title={ __( 'Spacing', 'wp-free-charts' ) } initialOpen={ false }>
					<BoxControl
						label={ __( 'Padding', 'wp-free-charts' ) }
						values={ {
							top:    toUnitVal( paddingTop ),
							right:  toUnitVal( paddingRight ),
							bottom: toUnitVal( paddingBottom ),
							left:   toUnitVal( paddingLeft ),
						} }
						onChange={ ( { top, right, bottom, left } ) => setAttributes( {
							paddingTop:    top    ?? '0',
							paddingRight:  right  ?? '0',
							paddingBottom: bottom ?? '0',
							paddingLeft:   left   ?? '0',
						} ) }
						units={ spacingUnitList }
					/>
					<BoxControl
						label={ __( 'Margin', 'wp-free-charts' ) }
						values={ {
							top:    toUnitVal( marginTop,    '0' ),
							right:  toUnitVal( marginRight,  '0' ),
							bottom: toUnitVal( marginBottom, '0' ),
							left:   toUnitVal( marginLeft,   '0' ),
						} }
						onChange={ ( { top, right, bottom, left } ) => setAttributes( {
							marginTop:    top    ?? '0',
							marginRight:  right  ?? '0',
							marginBottom: bottom ?? '0',
							marginLeft:   left   ?? '0',
						} ) }
						units={ spacingUnitList }
					/>
				</PanelBody>

				{ /* Border */ }
				<PanelBody title={ __( 'Border', 'wp-free-charts' ) } initialOpen={ false }>
					<UnitControl
						label={ __( 'Border Width', 'wp-free-charts' ) }
						value={ toUnitVal( borderWidth, '0' ) }
						min={ 0 }
						onChange={ ( v ) => setAttributes( { borderWidth: v || '0' } ) }
						units={ BORDER_UNITS }
					/>
					{ hasBorder && <>
						<SelectControl
							label={ __( 'Border Style', 'wp-free-charts' ) }
							value={ borderStyle }
							options={ [
								{ label: 'Solid',  value: 'solid'  },
								{ label: 'Dashed', value: 'dashed' },
								{ label: 'Dotted', value: 'dotted' },
								{ label: 'Double', value: 'double' },
							] }
							onChange={ ( v ) => setAttributes( { borderStyle: v } ) }
						/>
						<BaseControl label={ __( 'Border Colour', 'wp-free-charts' ) }>
							<ColorPalette
								colors={ colorPalette }
								value={ borderColor }
								onChange={ ( v ) => setAttributes( { borderColor: v || '#cccccc' } ) }
								disableCustomColors={ false }
							/>
						</BaseControl>
					</> }
					<UnitControl
						label={ __( 'Border Radius', 'wp-free-charts' ) }
						value={ toUnitVal( borderRadius, '0' ) }
						min={ 0 }
						onChange={ ( v ) => setAttributes( { borderRadius: v || '0' } ) }
						units={ RADIUS_UNITS }
					/>
				</PanelBody>

			</InspectorControls>

			{ /* ── Block content ────────────────────────────────────────────────────── */ }
			<figure { ...blockProps }>
				{ showTitle && (
					<div
						className="wfc-chart-title"
						style={ {
							textAlign:     titleAlign,
							fontSize:      typeof titleFontSize === 'number' ? `${ titleFontSize }px` : titleFontSize,
							fontWeight:    titleFontWeight,
							fontStyle:     titleFontStyle && titleFontStyle !== 'normal' ? titleFontStyle : undefined,
							letterSpacing: titleLetterSpacing || undefined,
							color:         titleColor,
							fontFamily:    titleFontFamily || fontFamily || undefined,
							marginBottom:  '10px',
						} }
					>
						{ title || <span style={ { opacity: 0.4 } }>{ __( 'Chart Title — add text in the sidebar', 'wp-free-charts' ) }</span> }
					</div>
				) }

				<div className="wfc-chart-container" style={ { height: chartHeightVal } }>
					<ChartPreview chartConfig={ chartConfig } height={ chartHeightVal } />
				</div>

				{ enableFilters && filterLabels.length > 0 && (
					<div className="wfc-filters-preview">
						<span className="wfc-filters-label">{ __( 'Filters:', 'wp-free-charts' ) }</span>
						{ filterLabels.map( ( label, i ) => (
							<span key={ i } className="wfc-filter-chip wfc-filter-chip--active">{ label }</span>
						) ) }
					</div>
				) }

				<div className="wfc-block-actions">
					<Button variant="primary" size="small" onClick={ () => setDataOpen( true ) }>
						{ __( 'Edit Data', 'wp-free-charts' ) }
					</Button>
					<Button variant="secondary" size="small" onClick={ () => setTypeOpen( true ) }>
						{ __( 'Change Chart Type', 'wp-free-charts' ) }
					</Button>
				</div>
			</figure>

			{ /* ── Modals ────────────────────────────────────────────────────────────── */ }
			{ dataOpen && (
				<DataSpreadsheet
					tableData={ tableData }
					chartType={ chartType }
					onSave={ ( newData ) => { setAttributes( { tableData: newData } ); setDataOpen( false ); } }
					onClose={ () => setDataOpen( false ) }
				/>
			) }

			{ typeOpen && (
				<Modal
					title={ __( 'Select Chart Type', 'wp-free-charts' ) }
					onRequestClose={ () => setTypeOpen( false ) }
					className="wfc-type-modal"
				>
					<ChartTypeSelector
						value={ chartType }
						onChange={ ( type ) => { setAttributes( { chartType: type } ); setTypeOpen( false ); } }
					/>
				</Modal>
			) }
		</>
	);
}
