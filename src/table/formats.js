/**
 * Adds an "Underline" button to the rich-text toolbar for table cells.
 * WordPress ships an underline format (Ctrl+U) but no toolbar button for it.
 * The button only shows while editing a WP Free Table block, so other
 * blocks are unaffected.
 */
import { registerFormatType, toggleFormat } from '@wordpress/rich-text';
import { RichTextToolbarButton } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

const NAME = 'wp-free-charts/underline';

function UnderlineButton( { isActive, value, onChange } ) {
	const inTable = useSelect(
		( select ) => select( 'core/block-editor' ).getSelectedBlock()?.name === 'wp-free-charts/table',
		[]
	);
	if ( ! inTable ) return null;
	return (
		<RichTextToolbarButton
			icon="editor-underline"
			title={ __( 'Underline', 'wp-free-charts' ) }
			isActive={ isActive }
			onClick={ () => onChange( toggleFormat( value, { type: NAME } ) ) }
		/>
	);
}

registerFormatType( NAME, {
	title:     __( 'Underline', 'wp-free-charts' ),
	tagName:   'u',
	className: null,
	edit:      UnderlineButton,
} );

export const UNDERLINE_FORMAT = NAME;
