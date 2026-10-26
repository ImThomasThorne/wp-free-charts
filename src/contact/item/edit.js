import { __ } from '@wordpress/i18n';
import { useBlockProps, RichText, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl, Notice } from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { escapeHTML } from '@wordpress/escape-html';
import { ICONS } from '../icons';

/**
 * `value` and `label` are stored as RichText HTML (so "&" is "&amp;"). The
 * sidebar text fields work in plain text and convert both ways.
 */
const toPlain = ( html ) => decodeEntities( String( html ?? '' ).replace( /<[^>]*>/g, '' ) );

const looksLikeEmail = ( v ) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( v );
const phoneDigits    = ( v ) => v.replace( /[^0-9]/g, '' );

export default function Edit( { attributes, setAttributes, context } ) {
	const { type, value, label, className } = attributes;
	const isPhone  = type === 'phone';
	const showText = context[ 'wp-free-charts/showText' ] !== false;
	const isButton = ( className || '' ).split( /\s+/ ).includes( 'is-style-button' );

	const blockProps = useBlockProps( {
		className: [
			`is-type-${ type }`,
			isButton && 'wp-element-button',
			! showText && 'is-icon-only',
		].filter( Boolean ).join( ' ' ),
	} );

	// The text in the block edits the display text when one is set, otherwise
	// the email address / phone number itself.
	const editsLabel = !! toPlain( label );
	const plainValue = toPlain( value );

	let warning = '';
	if ( plainValue && ! isPhone && ! looksLikeEmail( plainValue ) ) {
		warning = __( "This doesn't look like an email address.", 'wp-free-charts' );
	} else if ( plainValue && isPhone && phoneDigits( plainValue ).length < 3 ) {
		warning = __( "This doesn't look like a phone number.", 'wp-free-charts' );
	}

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Contact', 'wp-free-charts' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Type', 'wp-free-charts' ) }
						value={ type }
						options={ [
							{ label: __( 'Email', 'wp-free-charts' ), value: 'email' },
							{ label: __( 'Phone', 'wp-free-charts' ), value: 'phone' },
						] }
						onChange={ ( next ) => setAttributes( { type: next } ) }
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						type={ isPhone ? 'tel' : 'email' }
						label={ isPhone ? __( 'Phone number', 'wp-free-charts' ) : __( 'Email address', 'wp-free-charts' ) }
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
						help={ __( 'Optional, e.g. "Call the office". Leave empty to show the address or number.', 'wp-free-charts' ) }
						value={ toPlain( label ) }
						onChange={ ( next ) => setAttributes( { label: escapeHTML( next ) } ) }
					/>
				</PanelBody>
			</InspectorControls>

			{ /* No href in the editor, so clicking selects the block instead of opening a link. */ }
			<a { ...blockProps }>
				{ ICONS[ type ] ?? ICONS.email }
				{ showText && (
					<RichText
						identifier={ editsLabel ? 'label' : 'value' }
						tagName="span"
						className="wfc-contact-item__text"
						value={ editsLabel ? label : value }
						onChange={ ( next ) => setAttributes( editsLabel ? { label: next } : { value: next } ) }
						placeholder={ isPhone
							? __( 'Phone number', 'wp-free-charts' )
							: __( 'Email address', 'wp-free-charts' ) }
						allowedFormats={ [] }
						withoutInteractiveFormatting
						disableLineBreaks
					/>
				) }
			</a>
		</>
	);
}
