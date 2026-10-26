/**
 * Contact Item block (child of Contact Details). Rendered by render.php, so
 * save() is null. The kind of item (email, phone, …) is chosen with the Type
 * dropdown in the sidebar; the list of kinds is in ../types.js.
 */
import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import { emailIcon } from '../icons';
import { getContactType } from '../types';
import metadata from './block.json';

registerBlockType( metadata.name, {
	icon: emailIcon,
	edit: Edit,
	save: () => null,
	// List View shows "Email", "Phone", … instead of "Contact Item".
	__experimentalLabel: ( attributes, { context } ) =>
		context === 'list-view' ? getContactType( attributes.type ).label : undefined,
} );
