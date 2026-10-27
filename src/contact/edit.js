/**
 * Contact Details editor. All item and icon styling lives here (not on the
 * items), so every item in the row looks the same:
 *  - Settings tab: show text, open web links in a new tab.
 *  - Styles tab → Color: item text/background (+ hover), item border, icon, icon background.
 *  - Styles tab → Items / Icons panels: style, icon position, gap, padding,
 *    border, radius, underline; icon size, background shape, space around.
 * The settings become classes + CSS vars (styles.js, mirrored in PHP by
 * includes/contact-styles.php) that style.css applies to the items.
 */
import { __ } from '@wordpress/i18n';
import * as blockEditor from '@wordpress/block-editor';
import * as components from '@wordpress/components';
import { useBlockProps, useInnerBlocksProps, InspectorControls, PanelColorSettings, useSettings } from '@wordpress/block-editor';
import { PanelBody, ToggleControl, SelectControl } from '@wordpress/components';
import { contactStyle } from './styles';

const ITEM     = 'wp-free-charts/contact-item';
const TEMPLATE = [ [ ITEM, { type: 'email' } ], [ ITEM, { type: 'phone' } ] ];

// Newer editor controls, looked up at runtime so older WordPress still works.
const ColorDropdown       = blockEditor.__experimentalColorGradientSettingsDropdown;
const useColorSettings    = blockEditor.__experimentalUseMultipleOriginColorsAndGradients;
const SpacingSizesControl = blockEditor.__experimentalSpacingSizesControl;
const ToggleGroupControl  = components.__experimentalToggleGroupControl;
const ToggleGroupOption   = components.__experimentalToggleGroupControlOption;
const UnitControl         = components.__experimentalUnitControl;
const BoxControl          = components.__experimentalBoxControl;

const UNITS = [
	{ value: 'px', label: 'px', default: 0 },
	{ value: 'em', label: 'em', default: 0 },
	{ value: 'rem', label: 'rem', default: 0 },
];

const BORDER_STYLES = [
	{ label: __( 'Default', 'wp-free-charts' ), value: '' },
	{ label: __( 'Solid', 'wp-free-charts' ), value: 'solid' },
	{ label: __( 'Dashed', 'wp-free-charts' ), value: 'dashed' },
	{ label: __( 'Dotted', 'wp-free-charts' ), value: 'dotted' },
	{ label: __( 'Double', 'wp-free-charts' ), value: 'double' },
	{ label: __( 'None', 'wp-free-charts' ), value: 'none' },
];

/** Segmented buttons where available, otherwise a dropdown. */
function Choice( { label, value, options, onChange, help } ) {
	if ( ToggleGroupControl && ToggleGroupOption ) {
		return (
			<ToggleGroupControl __nextHasNoMarginBottom __next40pxDefaultSize isBlock label={ label } help={ help } value={ value } onChange={ onChange }>
				{ options.map( ( o ) => <ToggleGroupOption key={ o.value } value={ o.value } label={ o.label } /> ) }
			</ToggleGroupControl>
		);
	}
	return <SelectControl __nextHasNoMarginBottom label={ label } help={ help } value={ value } options={ options } onChange={ onChange } />;
}

/** A length field ("12px"); a plain text field if UnitControl is missing. */
function Length( { label, value, onChange, help } ) {
	const Control = UnitControl || components.TextControl;
	return (
		<div className="wfc-contact-control">
			<Control __next40pxDefaultSize label={ label } help={ help } value={ value } units={ UNITS } min={ 0 } onChange={ ( v ) => onChange( v || '' ) } />
		</div>
	);
}

function findColorSlug( palette, value ) {
	if ( ! value ) return '';
	return palette.find( ( p ) => p.color?.toLowerCase() === value.toLowerCase() )?.slug || '';
}

export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		showText, openInNewTab, itemStyle, iconPosition, itemGap, itemPadding, itemBorderWidth,
		itemBorderStyle, itemRadius, itemDecoration, iconSize, iconShape, iconPadding,
	} = attributes;

	const { className, style } = contactStyle( attributes );
	const blockProps       = useBlockProps( { className, style } );
	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		allowedBlocks: [ ITEM ],
		template: TEMPLATE,
		templateInsertUpdatesSelection: true,
		// "+" adds an item straight away; its type is then picked in the sidebar.
		defaultBlock: [ ITEM, { type: 'email' } ],
		directInsert: true,
	} );

	// Colours: store the value and, for theme colours, the slug (output as the
	// preset CSS var, so the block follows palette changes).
	const [ themePalette, defaultPalette, customPalette ] = useSettings( 'color.palette.theme', 'color.palette.default', 'color.palette.custom' );
	const palette  = [ ...( themePalette || [] ), ...( defaultPalette || [] ), ...( customPalette || [] ) ];
	const setColor = ( prop ) => ( value ) =>
		setAttributes( { [ prop ]: value || '', [ `${ prop }Slug` ]: findColorSlug( palette, value ) } );
	const colorSettings = useColorSettings ? useColorSettings() : null;

	const COLORS = [
		[ 'itemColor', __( 'Item text', 'wp-free-charts' ) ],
		[ 'itemBackground', __( 'Item background', 'wp-free-charts' ) ],
		[ 'itemHoverColor', __( 'Item text on hover', 'wp-free-charts' ) ],
		[ 'itemHoverBackground', __( 'Item background on hover', 'wp-free-charts' ) ],
		[ 'itemBorderColor', __( 'Item border', 'wp-free-charts' ) ],
		[ 'iconColor', __( 'Icon', 'wp-free-charts' ) ],
		[ 'iconBackground', __( 'Icon background', 'wp-free-charts' ) ],
	];

	const colorControls = ColorDropdown && colorSettings ? (
		<InspectorControls group="color">
			{ COLORS.map( ( [ prop, label ] ) => (
				<ColorDropdown
					key={ prop }
					__experimentalIsRenderedInSidebar
					panelId={ clientId }
					settings={ [ {
						label,
						colorValue: attributes[ prop ] || undefined,
						onColorChange: setColor( prop ),
						clearable: true,
						enableAlpha: true,
						resetAllFilter: () => ( { [ prop ]: '', [ `${ prop }Slug` ]: '' } ),
					} ] }
					{ ...colorSettings }
					gradients={ [] }
					disableCustomGradients
				/>
			) ) }
		</InspectorControls>
	) : (
		<InspectorControls group="styles">
			<PanelColorSettings
				title={ __( 'Item & icon colours', 'wp-free-charts' ) }
				initialOpen={ false }
				colorSettings={ COLORS.map( ( [ prop, label ] ) => ( { label, value: attributes[ prop ], onChange: setColor( prop ) } ) ) }
			/>
		</InspectorControls>
	);

	const PaddingControl = SpacingSizesControl || BoxControl;

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Settings', 'wp-free-charts' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show contact details', 'wp-free-charts' ) }
						help={ showText
							? __( 'Icons and text are shown.', 'wp-free-charts' )
							: __( 'Only icons are shown. Screen readers still read out the details.', 'wp-free-charts' ) }
						checked={ showText }
						onChange={ ( value ) => setAttributes( { showText: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Open web links in a new tab', 'wp-free-charts' ) }
						help={ __( 'Website, social and WhatsApp links. Email and phone links are never affected.', 'wp-free-charts' ) }
						checked={ openInNewTab }
						onChange={ ( value ) => setAttributes( { openInNewTab: value } ) }
					/>
				</PanelBody>
			</InspectorControls>

			{ colorControls }

			<InspectorControls group="styles">
				<PanelBody title={ __( 'Items', 'wp-free-charts' ) }>
					<Choice
						label={ __( 'Style', 'wp-free-charts' ) }
						help={ __( "Button uses your theme's button design.", 'wp-free-charts' ) }
						value={ itemStyle }
						options={ [
							{ value: 'plain', label: __( 'Plain', 'wp-free-charts' ) },
							{ value: 'button', label: __( 'Button', 'wp-free-charts' ) },
							{ value: 'outline', label: __( 'Outline', 'wp-free-charts' ) },
						] }
						onChange={ ( v ) => setAttributes( { itemStyle: v } ) }
					/>
					<Choice
						label={ __( 'Icon position', 'wp-free-charts' ) }
						value={ iconPosition }
						options={ [
							{ value: 'before', label: __( 'Before', 'wp-free-charts' ) },
							{ value: 'after', label: __( 'After', 'wp-free-charts' ) },
							{ value: 'top', label: __( 'Above', 'wp-free-charts' ) },
						] }
						onChange={ ( v ) => setAttributes( { iconPosition: v } ) }
					/>
					<Length label={ __( 'Space between icon and text', 'wp-free-charts' ) } value={ itemGap } onChange={ ( v ) => setAttributes( { itemGap: v } ) } />
					{ PaddingControl && (
						<div className="wfc-contact-control">
							<PaddingControl
								label={ __( 'Padding', 'wp-free-charts' ) }
								values={ itemPadding }
								onChange={ ( v ) => setAttributes( { itemPadding: v || {} } ) }
								sides={ [ 'top', 'right', 'bottom', 'left' ] }
								splitOnAxis
								allowReset
								minimumCustomValue={ 0 }
							/>
						</div>
					) }
					<Length label={ __( 'Border width', 'wp-free-charts' ) } value={ itemBorderWidth } onChange={ ( v ) => setAttributes( { itemBorderWidth: v } ) } />
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Border style', 'wp-free-charts' ) }
						value={ itemBorderStyle }
						options={ BORDER_STYLES }
						onChange={ ( v ) => setAttributes( { itemBorderStyle: v } ) }
					/>
					<Length label={ __( 'Corner radius', 'wp-free-charts' ) } value={ itemRadius } onChange={ ( v ) => setAttributes( { itemRadius: v } ) } />
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Underline', 'wp-free-charts' ) }
						value={ itemDecoration }
						options={ [
							{ label: __( 'Theme default', 'wp-free-charts' ), value: '' },
							{ label: __( 'None', 'wp-free-charts' ), value: 'none' },
							{ label: __( 'Underline', 'wp-free-charts' ), value: 'underline' },
						] }
						onChange={ ( v ) => setAttributes( { itemDecoration: v } ) }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Icons', 'wp-free-charts' ) }>
					<Length
						label={ __( 'Icon size', 'wp-free-charts' ) }
						help={ __( 'Leave empty to size icons with the text.', 'wp-free-charts' ) }
						value={ iconSize }
						onChange={ ( v ) => setAttributes( { iconSize: v } ) }
					/>
					<Choice
						label={ __( 'Background shape', 'wp-free-charts' ) }
						help={ __( 'Pick the colour under Color → Icon background.', 'wp-free-charts' ) }
						value={ iconShape }
						options={ [
							{ value: 'none', label: __( 'None', 'wp-free-charts' ) },
							{ value: 'circle', label: __( 'Circle', 'wp-free-charts' ) },
							{ value: 'rounded', label: __( 'Rounded', 'wp-free-charts' ) },
							{ value: 'square', label: __( 'Square', 'wp-free-charts' ) },
						] }
						onChange={ ( v ) => setAttributes( { iconShape: v } ) }
					/>
					{ iconShape !== 'none' && (
						<Length
							label={ __( 'Space around icon', 'wp-free-charts' ) }
							value={ iconPadding }
							onChange={ ( v ) => setAttributes( { iconPadding: v } ) }
						/>
					) }
				</PanelBody>
			</InspectorControls>

			<div { ...innerBlocksProps } />
		</>
	);
}
