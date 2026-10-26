/**
 * The kinds of contact item, in the order they appear in the Type dropdown.
 *
 * To add a type: add an entry here (editor) AND in the $wfc_types list in
 * item/render.php (front end: icon and link), using the same `name`.
 */
import { __ } from '@wordpress/i18n';
import { emailIcon, phoneIcon } from './icons';

export const CONTACT_TYPES = [
	{
		name: 'email',
		label: __( 'Email', 'wp-free-charts' ),
		icon: emailIcon,
		fieldLabel: __( 'Email address', 'wp-free-charts' ),
		inputType: 'email',
		isValid: ( v ) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( v ),
		invalidMessage: __( "This doesn't look like an email address.", 'wp-free-charts' ),
	},
	{
		name: 'phone',
		label: __( 'Phone', 'wp-free-charts' ),
		icon: phoneIcon,
		fieldLabel: __( 'Phone number', 'wp-free-charts' ),
		inputType: 'tel',
		isValid: ( v ) => v.replace( /[^0-9]/g, '' ).length >= 3,
		invalidMessage: __( "This doesn't look like a phone number.", 'wp-free-charts' ),
	},
];

/** The type's settings, falling back to the first type for unknown names. */
export const getContactType = ( name ) =>
	CONTACT_TYPES.find( ( t ) => t.name === name ) ?? CONTACT_TYPES[ 0 ];
