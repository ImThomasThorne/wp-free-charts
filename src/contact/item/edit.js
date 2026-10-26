import { __, sprintf } from '@wordpress/i18n';
import { useBlockProps, RichText, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl, Notice } from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { escapeHTML } from '@wordpress/escape-html';
import { CONTACT_TYPES, getContactType } from '../types';

/**
 * `value` and `label` are stored as RichText HTML (so "&" is "&amp;"). The
 * sidebar text fields work in plain text and convert both ways.
 */
const toPlain = ( html ) => decodeEntities( String( html ?? '' ).replace( /<[^>]*>/g, '' ) );

/** Field names render.php accepts (no leading "_": that's private meta). */
const isValidFieldName = ( name ) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test( name );

const TYPE_OPTIONS = CONTACT_TYPES.map( ( t ) => ( { label: t.label, value: t.name } ) );

const SOURCE_OPTIONS = [
	{ label: __( 'Typed in', 'wp-free-charts' ), value: 'manual' },
	{ label: __( 'Custom field (ACF or post meta)', 'wp-free-charts' ), value: 'field' },
];

const FIELD_FROM_OPTIONS = [
	{ label: __( 'This post (or each post in a Query Loop)', 'wp-free-charts' ), value: 'post' },
	{ label: __( 'ACF Options page', 'wp-free-charts' ), value: 'option' },
	{ label: __( "Post author's profile (ACF)", 'wp-free-charts' ), value: 'author' },
];

export default function Edit( { attributes, setAttributes, context } ) {
	const { value, label, className, field, fieldFrom } = attributes;
	const type      = getContactType( attributes.type );
	const fromField = attributes.source === 'field';
	const showText  = context[ 'wp-free-charts/showText' ] !== false;
	const isButton  = ( className || '' ).split( /\s+/ ).includes( 'is-style-button' );

	const blockProps = useBlockProps( {
		className: [
			`is-type-${ type.name }`,
			isButton && 'wp-element-button',
			! showText && 'is-icon-only',
			fromField && 'is-from-field',
		].filter( Boolean ).join( ' ' ),
	} );

	const plainLabel = toPlain( label );
	const plainValue = toPlain( value );

	let warning = '';
	if ( fromField ) {
		if ( field && ! isValidFieldName( field ) ) {
			warning = __( 'Field names can only use letters, numbers, "_" and "-", and can\'t start with "_".', 'wp-free-charts' );
		}
	} else if ( plainValue && ! type.isValid( plainValue ) ) {
		warning = type.invalidMessage;
	}

	// What the block shows in the editor. Field values are only known on the
	// front end, so a field shows its name (unless display text is set).
	let text;
	if ( fromField && ! plainLabel ) {
		text = (
			<span className="wfc-contact-item__text wfc-contact-item__field">
				{ field
					/* translators: %s: custom field name. */
					? sprintf( __( 'Field: %s', 'wp-free-charts' ), field )
					: __( 'Choose a field in the sidebar', 'wp-free-charts' ) }
			</span>
		);
	} else {
		// Edits the display text when one is set, otherwise the typed-in detail.
		const editsLabel = !! plainLabel || fromField;
		text = (
			<RichText
				identifier={ editsLabel ? 'label' : 'value' }
				tagName="span"
				className="wfc-contact-item__text"
				value={ editsLabel ? label : value }
				onChange={ ( next ) => setAttributes( editsLabel ? { label: next } : { value: next } ) }
				placeholder={ type.fieldLabel }
				allowedFormats={ [] }
				withoutInteractiveFormatting
				disableLineBreaks
			/>
		);
	}

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Contact', 'wp-free-charts' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Type', 'wp-free-charts' ) }
						value={ type.name }
						options={ TYPE_OPTIONS }
						onChange={ ( next ) => setAttributes( { type: next } ) }
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Source', 'wp-free-charts' ) }
						value={ fromField ? 'field' : 'manual' }
						options={ SOURCE_OPTIONS }
						onChange={ ( next ) => setAttributes( { source: next } ) }
					/>
					{ fromField ? (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Field name', 'wp-free-charts' ) }
								help={ __( 'The ACF field name (not its label), e.g. staff_email. Without ACF, a post meta key.', 'wp-free-charts' ) }
								value={ field }
								onChange={ ( next ) => setAttributes( { field: next.trim() } ) }
							/>
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Field belongs to', 'wp-free-charts' ) }
								help={ __( 'If the field is empty, nothing is shown for this item.', 'wp-free-charts' ) }
								value={ fieldFrom }
								options={ FIELD_FROM_OPTIONS }
								onChange={ ( next ) => setAttributes( { fieldFrom: next } ) }
							/>
						</>
					) : (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type={ type.inputType }
							label={ type.fieldLabel }
							value={ plainValue }
							onChange={ ( next ) => setAttributes( { value: escapeHTML( next ) } ) }
						/>
					) }
					{ warning && (
						<Notice status="warning" isDismissible={ false }>{ warning }</Notice>
					) }
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Display text', 'wp-free-charts' ) }
						help={ __( 'Optional, e.g. "Call the office". Leave empty to show the contact detail.', 'wp-free-charts' ) }
						value={ plainLabel }
						onChange={ ( next ) => setAttributes( { label: escapeHTML( next ) } ) }
					/>
				</PanelBody>
			</InspectorControls>

			{ /* No href in the editor, so clicking selects the block instead of opening a link. */ }
			<a { ...blockProps }>
				{ type.icon }
				{ showText && text }
			</a>
		</>
	);
}
