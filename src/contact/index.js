/**
 * Contact Details block: a row of Contact Item blocks (email / phone), laid out
 * like core/buttons. Rendered on the server by render.php, so save() only keeps
 * the inner blocks and changing the markup never breaks block validation.
 */
import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import Edit from './edit';
import { cardIcon } from './icons';
import metadata from './block.json';
import './style.css';

registerBlockType( metadata.name, {
	icon: cardIcon,
	edit: Edit,
	save: () => <InnerBlocks.Content />,
} );
