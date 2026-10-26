import { __ } from '@wordpress/i18n';
import { useBlockProps, useInnerBlocksProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, ToggleControl } from '@wordpress/components';

const ITEM     = 'wp-free-charts/contact-item';
const TEMPLATE = [ [ ITEM, { type: 'email' } ], [ ITEM, { type: 'phone' } ] ];

export default function Edit( { attributes: { showText }, setAttributes } ) {
	const blockProps       = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		allowedBlocks: [ ITEM ],
		template: TEMPLATE,
		templateInsertUpdatesSelection: true,
	} );

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
				</PanelBody>
			</InspectorControls>
			<div { ...innerBlocksProps } />
		</>
	);
}
