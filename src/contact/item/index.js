/**
 * Contact Item block (child of Contact Details). Rendered by render.php, so
 * save() is null. The Email / Phone variations show up in the inserter and in
 * the block switcher.
 */
import { __ } from '@wordpress/i18n';
import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import { emailIcon, phoneIcon } from '../icons';
import metadata from './block.json';

registerBlockType( metadata.name, {
	icon: emailIcon,
	edit: Edit,
	save: () => null,
	variations: [
		{
			name: 'email',
			title: __( 'Email', 'wp-free-charts' ),
			description: __( 'An email address that opens a new email when clicked.', 'wp-free-charts' ),
			icon: emailIcon,
			attributes: { type: 'email' },
			isDefault: true,
			isActive: [ 'type' ],
			scope: [ 'inserter', 'block', 'transform' ],
		},
		{
			name: 'phone',
			title: __( 'Phone', 'wp-free-charts' ),
			description: __( 'A phone number that starts a call when clicked.', 'wp-free-charts' ),
			icon: phoneIcon,
			attributes: { type: 'phone' },
			isActive: [ 'type' ],
			scope: [ 'inserter', 'block', 'transform' ],
		},
	],
} );
