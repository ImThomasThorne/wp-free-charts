import { __, sprintf } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { useBlockProps, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	TextControl,
	ToggleControl,
	RangeControl,
	Button,
	Notice,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import useImagePreview, { usePostId } from './useImagePreview';

/** Same rule as the server: letters, numbers, _ and -, no leading _, dots for Group fields. */
const isValidFieldName = ( name ) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}(\.[A-Za-z0-9_-]{1,64}){0,3}$/.test( name );

const RATIOS = [
	{ label: __( 'Original', 'wp-free-charts' ), value: '' },
	{ label: __( 'Square (1:1)', 'wp-free-charts' ), value: '1/1' },
	{ label: __( 'Portrait (4:5)', 'wp-free-charts' ), value: '4/5' },
	{ label: __( 'Portrait (3:4)', 'wp-free-charts' ), value: '3/4' },
	{ label: __( 'Portrait (2:3)', 'wp-free-charts' ), value: '2/3' },
	{ label: __( 'Landscape (4:3)', 'wp-free-charts' ), value: '4/3' },
	{ label: __( 'Landscape (3:2)', 'wp-free-charts' ), value: '3/2' },
	{ label: __( 'Wide (16:9)', 'wp-free-charts' ), value: '16/9' },
	{ label: __( 'Custom', 'wp-free-charts' ), value: 'custom' },
];

/** "5:6", "5/6" or "5 x 6" -> "5/6" (or '' if not a ratio). */
function parseRatio( text ) {
	const m = String( text ).match( /^\s*(\d{1,4}(?:\.\d{1,3})?)\s*[/:xX×]\s*(\d{1,4}(?:\.\d{1,3})?)\s*$/ );
	return m && Number( m[ 1 ] ) > 0 && Number( m[ 2 ] ) > 0 ? `${ m[ 1 ] }/${ m[ 2 ] }` : '';
}

const SOURCES = {
	main: [
		{ label: __( 'Featured image', 'wp-free-charts' ), value: 'featured' },
		{ label: __( 'Custom field (ACF or post meta)', 'wp-free-charts' ), value: 'field' },
		{ label: __( 'Choose from Media Library', 'wp-free-charts' ), value: 'media' },
	],
	hover: [
		{ label: __( 'Custom field (ACF or post meta)', 'wp-free-charts' ), value: 'field' },
		{ label: __( 'Featured image', 'wp-free-charts' ), value: 'featured' },
		{ label: __( 'Choose from Media Library', 'wp-free-charts' ), value: 'media' },
	],
};

const FIELD_FROM_OPTIONS = [
	{ label: __( 'This post (or each post in a Query Loop)', 'wp-free-charts' ), value: 'post' },
	{ label: __( 'ACF Options page', 'wp-free-charts' ), value: 'option' },
	{ label: __( "Post author's profile (ACF)", 'wp-free-charts' ), value: 'author' },
];

const WHERE = {
	post: __( 'this post', 'wp-free-charts' ),
	option: __( 'the ACF Options page', 'wp-free-charts' ),
	author: __( "the post author's profile", 'wp-free-charts' ),
};

/** Plain-English reason a slot has no image (codes from includes/image-swap.php). */
function slotProblem( preview, slot ) {
	const where = WHERE[ slot.from ] ?? WHERE.post;
	switch ( preview?.error ) {
		case 'no_post':
			return __( "There's no post here to read from (for example, in a template). On the site, the post being viewed is used.", 'wp-free-charts' );
		case 'no_featured':
			return __( "This post has no featured image, so nothing is shown for it on the site.", 'wp-free-charts' );
		case 'no_media':
			return __( 'Choose an image.', 'wp-free-charts' );
		case 'no_author':
			return __( "This post has no author, so there's no profile to read the field from.", 'wp-free-charts' );
		case 'needs_acf':
			return __( 'Options page and author fields need the Advanced Custom Fields plugin. Without it, only fields saved on the post itself can be read.', 'wp-free-charts' );
		case 'not_found':
			/* translators: 1: field name, 2: where the field was looked for. */
			return sprintf( __( 'No field called "%1$s" was found on %2$s. Use the field name, not its label (ACF shows it under Field Name), and make sure a value has been saved.', 'wp-free-charts' ), slot.field, where );
		case 'empty':
			/* translators: 1: field name, 2: where the field was looked for. */
			return sprintf( __( 'The field "%1$s" has no image saved on %2$s. In a Query Loop, this checks the selected post; others may be fine.', 'wp-free-charts' ), slot.field, where );
		case 'not_image': {
			// "photo.title" etc. reaches inside an ACF Image field and gets one of its details, not the image.
			if ( slot.source === 'field' && preview.field_type === 'image' && slot.field.includes( '.' ) ) {
				const base = slot.field.split( '.' )[ 0 ];
				/* translators: 1: field name as typed, 2: the image field's name. */
				return sprintf( __( '"%1$s" picks out one detail of the image (such as its title), not the image itself. Use just "%2$s".', 'wp-free-charts' ), slot.field, base );
			}
			const type = preview.field_type ? ` (${ preview.field_type })` : '';
			return slot.source === 'field'
				/* translators: 1: field name, 2: ACF field type in brackets. */
				? sprintf( __( 'The field "%1$s"%2$s doesn\'t hold an image from the Media Library. Use an ACF Image field, or a field holding an image\'s ID or URL.', 'wp-free-charts' ), slot.field, type )
				: __( "This isn't an image from the Media Library.", 'wp-free-charts' );
		}
		case 'invalid_name':
			return __( 'Field names can only use letters, numbers, "_" and "-", and can\'t start with "_". Use a dot for a field inside a Group, e.g. photos.fun.', 'wp-free-charts' );
		case 'forbidden':
			return __( "You don't have permission to read this post's fields.", 'wp-free-charts' );
		case 'php_error':
			/* translators: %s: PHP error message. */
			return sprintf( __( 'Reading this field caused a PHP error: %s', 'wp-free-charts' ), preview.message || '' );
		case 'request_failed':
			return __( "Couldn't check the image.", 'wp-free-charts' ) + ( preview.message ? ` ${ preview.message }` : '' );
		default:
			return '';
	}
}

/** Slot settings (source + field name or picked image) for the main or hover image. */
function SlotControls( { which, label, attributes, setAttributes, preview, slot } ) {
	const source = attributes[ `${ which }Source` ];
	const field  = attributes[ `${ which }Field` ];
	const nameOk = isValidFieldName( field );
	let warning  = '';
	if ( source === 'field' && field && ! nameOk ) warning = slotProblem( { error: 'invalid_name' }, slot );
	else if ( source !== 'field' || field ) warning = slotProblem( preview, slot );

	return (
		<div className="wfc-image-swap-slot">
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ label }
				value={ source }
				options={ SOURCES[ which ] }
				onChange={ ( next ) => setAttributes( { [ `${ which }Source` ]: next } ) }
			/>
			{ source === 'field' && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Field name', 'wp-free-charts' ) }
					help={ __( 'The field name (not its label), e.g. photo_fun. For a field inside an ACF Group, use group.field. Works with ACF Image fields or post meta holding an image ID or URL.', 'wp-free-charts' ) }
					value={ field }
					onChange={ ( next ) => setAttributes( { [ `${ which }Field` ]: next.trim() } ) }
				/>
			) }
			{ source === 'media' && (
				<MediaUploadCheck>
					<MediaUpload
						allowedTypes={ [ 'image' ] }
						value={ attributes[ `${ which }Id` ] || undefined }
						onSelect={ ( media ) => setAttributes( { [ `${ which }Id` ]: media?.id || 0 } ) }
						render={ ( { open } ) => (
							<div className="wfc-image-swap-media">
								{ preview?.url && <img src={ preview.url } alt="" /> }
								<Button variant="secondary" onClick={ open }>
									{ attributes[ `${ which }Id` ] ? __( 'Replace image', 'wp-free-charts' ) : __( 'Choose image', 'wp-free-charts' ) }
								</Button>
								{ !! attributes[ `${ which }Id` ] && (
									<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { [ `${ which }Id` ]: 0 } ) }>
										{ __( 'Remove', 'wp-free-charts' ) }
									</Button>
								) }
							</div>
						) }
					/>
				</MediaUploadCheck>
			) }
			{ warning && <Notice status="warning" isDismissible={ false }>{ warning }</Notice> }
		</div>
	);
}

export default function Edit( { attributes, setAttributes, context } ) {
	const { mainSource, hoverSource, fieldFrom, aspectRatio, width, scale, sizeSlug, linkToPost, revertDelay, fade } = attributes;
	const postId = usePostId( context.postId );

	const slotFor = ( which ) => {
		const source = attributes[ `${ which }Source` ];
		const field  = attributes[ `${ which }Field` ];
		const slot   = { source, field, from: fieldFrom, mediaId: attributes[ `${ which }Id` ] || 0 };
		// Skip lookups that can't succeed yet (no field name / no picked image).
		const ready  = source === 'featured' || ( source === 'field' ? isValidFieldName( field ) : slot.mediaId > 0 );
		return { slot, ready };
	};
	const main  = slotFor( 'main' );
	const hover = slotFor( 'hover' );
	const mainPreview  = useImagePreview( main.ready ? main.slot : null, postId, sizeSlug );
	const hoverPreview = useImagePreview( hover.ready ? hover.slot : null, postId, sizeSlug );
	const mainUrl  = mainPreview?.url || '';
	const hoverUrl = hoverPreview?.url && hoverPreview.id !== mainPreview?.id ? hoverPreview.url : '';

	const imageSizes = useSelect( ( select ) => select( 'core/block-editor' ).getSettings()?.imageSizes || [], [] );
	const sizeOptions = [
		...imageSizes.map( ( s ) => ( { label: s.name, value: s.slug } ) ),
		...( imageSizes.some( ( s ) => s.slug === 'full' ) ? [] : [ { label: __( 'Full size', 'wp-free-charts' ), value: 'full' } ] ),
	];

	const isPreset = RATIOS.some( ( r ) => r.value === aspectRatio && r.value !== 'custom' );
	const [ customOpen, setCustomOpen ] = useState( ! isPreset );
	const [ customText, setCustomText ] = useState( isPreset ? '' : aspectRatio.replace( '/', ':' ) );
	const ratioChoice = customOpen ? 'custom' : aspectRatio;
	const customValid = ! customText || !! parseRatio( customText );

	const usesField = mainSource === 'field' || hoverSource === 'field';

	const style = {};
	if ( aspectRatio ) style.aspectRatio = aspectRatio;
	if ( width ) style.width = width;
	const blockProps = useBlockProps( {
		className: [
			hoverUrl && 'has-hover-image',
			aspectRatio && 'has-aspect-ratio',
			scale === 'contain' && 'is-fit-contain',
			! fade && 'is-instant',
		].filter( Boolean ).join( ' ' ),
		style,
	} );

	let placeholder = '';
	if ( ! mainUrl ) {
		if ( mainPreview?.loading ) placeholder = __( 'Loading image…', 'wp-free-charts' );
		else if ( mainSource === 'featured' ) placeholder = __( 'Image Swap: this post has no featured image.', 'wp-free-charts' );
		else if ( mainSource === 'field' && attributes.mainField ) {
			/* translators: %s: custom field name. */
			placeholder = sprintf( __( 'Image Swap: no image in the field "%s" for this post.', 'wp-free-charts' ), attributes.mainField );
		} else placeholder = __( 'Image Swap: choose the main and hover images in the sidebar.', 'wp-free-charts' );
	}

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Images', 'wp-free-charts' ) }>
					<SlotControls
						which="main"
						label={ __( 'Main image', 'wp-free-charts' ) }
						attributes={ attributes }
						setAttributes={ setAttributes }
						preview={ mainPreview }
						slot={ main.slot }
					/>
					<SlotControls
						which="hover"
						label={ __( 'Hover image', 'wp-free-charts' ) }
						attributes={ attributes }
						setAttributes={ setAttributes }
						preview={ hoverPreview }
						slot={ hover.slot }
					/>
					{ usesField && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Fields belong to', 'wp-free-charts' ) }
							value={ fieldFrom }
							options={ FIELD_FROM_OPTIONS }
							onChange={ ( next ) => setAttributes( { fieldFrom: next } ) }
						/>
					) }
					<p className="components-base-control__help">
						{ __( "If there's no main image, nothing is shown. If there's no hover image, the main image is shown without a swap.", 'wp-free-charts' ) }
					</p>
				</PanelBody>
				<PanelBody title={ __( 'Size and shape', 'wp-free-charts' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Aspect ratio', 'wp-free-charts' ) }
						help={ __( 'Both images are cropped to this shape, so the swap doesn\'t jump.', 'wp-free-charts' ) }
						value={ ratioChoice }
						options={ RATIOS }
						onChange={ ( next ) => {
							if ( next === 'custom' ) {
								setCustomOpen( true );
								setCustomText( aspectRatio ? aspectRatio.replace( '/', ':' ) : '' );
								return;
							}
							setCustomOpen( false );
							setAttributes( { aspectRatio: next } );
						} }
					/>
					{ customOpen && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Custom ratio (width:height)', 'wp-free-charts' ) }
							help={ customValid ? __( 'For example 5:6 or 1.5:1.', 'wp-free-charts' ) : __( 'Use two numbers, like 5:6.', 'wp-free-charts' ) }
							value={ customText }
							placeholder="5:6"
							onChange={ ( next ) => {
								setCustomText( next );
								setAttributes( { aspectRatio: parseRatio( next ) } );
							} }
						/>
					) }
					{ !! aspectRatio && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Image fit', 'wp-free-charts' ) }
							value={ scale }
							options={ [
								{ label: __( 'Crop to fill', 'wp-free-charts' ), value: 'cover' },
								{ label: __( 'Fit inside (no cropping)', 'wp-free-charts' ), value: 'contain' },
							] }
							onChange={ ( next ) => setAttributes( { scale: next } ) }
						/>
					) }
					<UnitControl
						__next40pxDefaultSize
						label={ __( 'Width', 'wp-free-charts' ) }
						help={ __( 'Leave empty to fill the space available.', 'wp-free-charts' ) }
						value={ width }
						units={ [
							{ value: 'px', label: 'px', default: 300 },
							{ value: '%', label: '%', default: 100 },
							{ value: 'rem', label: 'rem', default: 20 },
							{ value: 'em', label: 'em', default: 20 },
							{ value: 'vw', label: 'vw', default: 50 },
						] }
						min={ 0 }
						onChange={ ( next ) => setAttributes( { width: next && parseFloat( next ) > 0 ? next : '' } ) }
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Resolution', 'wp-free-charts' ) }
						value={ sizeSlug }
						options={ sizeOptions }
						onChange={ ( next ) => setAttributes( { sizeSlug: next } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Behaviour', 'wp-free-charts' ) }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Link to the post', 'wp-free-charts' ) }
						help={ __( 'On phones, the first tap shows the hover image and a second tap opens the post.', 'wp-free-charts' ) }
						checked={ linkToPost }
						onChange={ ( next ) => setAttributes( { linkToPost: next } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Fade between images', 'wp-free-charts' ) }
						checked={ fade }
						onChange={ ( next ) => setAttributes( { fade: next } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Swap back after (seconds)', 'wp-free-charts' ) }
						help={ __( 'For phones, tablets and keyboard users, who can\'t hover. With a mouse, the image swaps back when the pointer moves away.', 'wp-free-charts' ) }
						value={ revertDelay }
						min={ 1 }
						max={ 10 }
						step={ 0.5 }
						onChange={ ( next ) => setAttributes( { revertDelay: next ?? 3 } ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ mainUrl ? (
					<>
						<img className="wfc-image-swap__img wfc-image-swap__img--main" src={ mainUrl } alt={ mainPreview?.alt || '' } />
						{ hoverUrl && (
							<img className="wfc-image-swap__img wfc-image-swap__img--hover" src={ hoverUrl } alt="" aria-hidden="true" />
						) }
					</>
				) : (
					<div className="wfc-image-swap__placeholder">{ placeholder }</div>
				) }
			</div>
		</>
	);
}
