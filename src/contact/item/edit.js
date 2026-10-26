import { __, sprintf } from '@wordpress/i18n';
import { useBlockProps, RichText, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl, Notice } from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { escapeHTML } from '@wordpress/escape-html';
import { CONTACT_TYPES, getContactType } from '../types';
import useFieldPreview from './useFieldPreview';

/**
 * `value` and `label` are stored as RichText HTML (so "&" is "&amp;"). The
 * sidebar text fields work in plain text and convert both ways.
 */
const toPlain = ( html ) => decodeEntities( String( html ?? '' ).replace( /<[^>]*>/g, '' ) );

/**
 * Field names the server accepts (no leading "_": that's private meta). Dots
 * reach into Group fields: "contact.email".
 */
const isValidFieldName = ( name ) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}(\.[A-Za-z0-9_-]{1,64}){0,3}$/.test( name );

const WHERE = {
	post: __( 'this post', 'wp-free-charts' ),
	option: __( 'the ACF Options page', 'wp-free-charts' ),
	author: __( "the post author's profile", 'wp-free-charts' ),
};

/** Plain-English reason a field gave nothing (codes from includes/contact-fields.php). */
function fieldProblem( preview, field, fieldFrom ) {
	const where = WHERE[ fieldFrom ] ?? WHERE.post;
	switch ( preview.error ) {
		case 'no_post':
			return __( "There's no post here to read the field from (for example, in a template). On the site, the post being viewed is used.", 'wp-free-charts' );
		case 'no_author':
			return __( "This post has no author, so there's no profile to read the field from.", 'wp-free-charts' );
		case 'needs_acf':
			return __( 'Options page and author fields need the Advanced Custom Fields plugin.', 'wp-free-charts' );
		case 'not_found':
			/* translators: 1: field name, 2: where the field was looked for. */
			return sprintf( __( 'No field called "%1$s" was found on %2$s. Use the field name, not its label (ACF shows it under Field Name), check "Field belongs to", and make sure a value has been saved.', 'wp-free-charts' ), field, where );
		case 'empty':
			/* translators: 1: field name, 2: where the field was looked for. */
			return sprintf( __( 'The field "%1$s" is empty on %2$s, so this item won\'t be shown.', 'wp-free-charts' ), field, where );
		case 'not_text': {
			const type = preview.field_type ? ` (${ preview.field_type })` : '';
			const hint = preview.suggest?.length
				/* translators: %s: list of field names. */
				? ' ' + sprintf( __( 'Try one of: %s', 'wp-free-charts' ), preview.suggest.join( ', ' ) )
				: '';
			/* translators: 1: field name, 2: ACF field type in brackets. */
			return sprintf( __( 'The field "%1$s"%2$s holds several values, not text.', 'wp-free-charts' ), field, type ) + hint;
		}
		case 'invalid_name':
			return __( 'Field names can only use letters, numbers, "_" and "-", and can\'t start with "_". Use a dot for a field inside a Group, e.g. contact.email.', 'wp-free-charts' );
		case 'request_failed':
			return __( "Couldn't check the field.", 'wp-free-charts' ) + ( preview.message ? ` ${ preview.message }` : '' );
		default:
			return '';
	}
}

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

	const nameOk  = isValidFieldName( field );
	const preview = useFieldPreview( fromField && nameOk, field, fieldFrom, context.postId );
	const found   = preview?.value || '';

	let warning = '';
	if ( fromField ) {
		if ( field && ! nameOk ) {
			warning = fieldProblem( { error: 'invalid_name' }, field, fieldFrom );
		} else if ( preview?.error ) {
			warning = fieldProblem( preview, field, fieldFrom );
		} else if ( found && ! type.isValid( found ) ) {
			warning = type.invalidMessage;
		}
	} else if ( plainValue && ! type.isValid( plainValue ) ) {
		warning = type.invalidMessage;
	}

	// What the block shows in the editor: for a field, the value it gives for
	// this post (or its name while unknown), unless display text is set.
	let text;
	if ( fromField && ! plainLabel ) {
		let shown;
		if ( ! field ) shown = __( 'Choose a field in the sidebar', 'wp-free-charts' );
		/* translators: %s: custom field name. */
		else if ( ! found ) shown = sprintf( __( 'Field: %s', 'wp-free-charts' ), field );
		text = found ? (
			<span className="wfc-contact-item__text">{ found }</span>
		) : (
			<span className="wfc-contact-item__text wfc-contact-item__field">{ shown }</span>
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
								help={ __( 'The ACF field name (not its label), e.g. staff_email. For a field inside a Group, use group.field. Without ACF, a post meta key.', 'wp-free-charts' ) }
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
							{ found && (
								<p className="wfc-contact-field-found">
									{ /* translators: %s: the field's current value. */ }
									{ sprintf( __( 'Found: %s', 'wp-free-charts' ), found ) }
								</p>
							) }
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
