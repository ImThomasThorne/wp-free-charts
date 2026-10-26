import { __ } from '@wordpress/i18n';
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

const TYPE_OPTIONS = CONTACT_TYPES.map( ( t ) => ( { label: t.label, value: t.name } ) );

export default function Edit( { attributes, setAttributes, context } ) {
	const { value, label, className } = attributes;
	const type     = getContactType( attributes.type );
	const showText = context[ 'wp-free-charts/showText' ] !== false;
	const isButton = ( className || '' ).split( /\s+/ ).includes( 'is-style-button' );

	const blockProps = useBlockProps( {
		className: [
			`is-type-${ type.name }`,
			isButton && 'wp-element-button',
			! showText && 'is-icon-only',
		].filter( Boolean ).join( ' ' ),
	} );

	// The text in the block edits the display text when one is set, otherwise
	// the contact detail itself.
	const editsLabel = !! toPlain( label );
	const plainValue = toPlain( value );
	const warning    = plainValue && ! type.isValid( plainValue ) ? type.invalidMessage : '';

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
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						type={ type.inputType }
						label={ type.fieldLabel }
						value={ plainValue }
						onChange={ ( next ) => setAttributes( { value: escapeHTML( next ) } ) }
					/>
					{ warning && (
						<Notice status="warning" isDismissible={ false }>{ warning }</Notice>
					) }
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Display text', 'wp-free-charts' ) }
						help={ __( 'Optional, e.g. "Call the office". Leave empty to show the contact detail.', 'wp-free-charts' ) }
						value={ toPlain( label ) }
						onChange={ ( next ) => setAttributes( { label: escapeHTML( next ) } ) }
					/>
				</PanelBody>
			</InspectorControls>

			{ /* No href in the editor, so clicking selects the block instead of opening a link. */ }
			<a { ...blockProps }>
				{ type.icon }
				{ showText && (
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
				) }
			</a>
		</>
	);
}
