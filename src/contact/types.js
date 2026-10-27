/**
 * The kinds of contact item, in the order they appear in the Type dropdown.
 *
 * To add a type: add it here (editor) AND in wp_free_charts_contact_types()
 * in includes/contact-types.php (front end: link), with the same `name`, and
 * give it an icon in includes/contact-icons.json.
 *
 * kind: email | phone | whatsapp | url. It decides the input field, the check,
 * and the default text when no display text is set.
 */
import { __ } from '@wordpress/i18n';
import { getIcon } from './icons';

const isEmail = ( v ) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( v );
const isPhone = ( v ) => v.replace( /[^0-9]/g, '' ).length >= 3;
const isUrl   = ( v ) => /^(https?:\/\/)?[^\s/?#]+\.[^\s/?#]+/i.test( v );

const KINDS = {
	email: {
		fieldLabel: __( 'Email address', 'wp-free-charts' ),
		inputType: 'email',
		isValid: isEmail,
		invalidMessage: __( "This doesn't look like an email address.", 'wp-free-charts' ),
	},
	phone: {
		fieldLabel: __( 'Phone number', 'wp-free-charts' ),
		inputType: 'tel',
		isValid: isPhone,
		invalidMessage: __( "This doesn't look like a phone number.", 'wp-free-charts' ),
	},
	whatsapp: {
		fieldLabel: __( 'WhatsApp number (with country code)', 'wp-free-charts' ),
		inputType: 'tel',
		isValid: isPhone,
		invalidMessage: __( "This doesn't look like a phone number.", 'wp-free-charts' ),
	},
	url: {
		fieldLabel: __( 'Profile URL', 'wp-free-charts' ),
		inputType: 'url',
		isValid: isUrl,
		invalidMessage: __( "This doesn't look like a web address.", 'wp-free-charts' ),
	},
};

const contact = ( name, label, kind, extra = {} ) => ( { name, label, kind, group: 'contact', icon: getIcon( name ), ...KINDS[ kind ], ...extra } );
const social  = ( name, label ) => ( { name, label, kind: 'url', group: 'social', icon: getIcon( name ), ...KINDS.url } );

export const CONTACT_TYPES = [
	contact( 'email', __( 'Email', 'wp-free-charts' ), 'email' ),
	contact( 'phone', __( 'Phone', 'wp-free-charts' ), 'phone' ),
	contact( 'whatsapp', 'WhatsApp', 'whatsapp' ),
	contact( 'website', __( 'Website', 'wp-free-charts' ), 'url', { fieldLabel: __( 'Website address', 'wp-free-charts' ) } ),
	social( 'facebook', 'Facebook' ),
	social( 'instagram', 'Instagram' ),
	social( 'x', 'X' ),
	social( 'linkedin', 'LinkedIn' ),
	social( 'youtube', 'YouTube' ),
	social( 'tiktok', 'TikTok' ),
	social( 'threads', 'Threads' ),
	social( 'bluesky', 'Bluesky' ),
	social( 'pinterest', 'Pinterest' ),
	social( 'snapchat', 'Snapchat' ),
	social( 'discord', 'Discord' ),
	social( 'mastodon', 'Mastodon' ),
];

export const TYPE_GROUPS = [
	{ label: __( 'Contact', 'wp-free-charts' ), group: 'contact' },
	{ label: __( 'Social', 'wp-free-charts' ), group: 'social' },
];

/** The type's settings, falling back to the first type for unknown names. */
export const getContactType = ( name ) =>
	CONTACT_TYPES.find( ( t ) => t.name === name ) ?? CONTACT_TYPES[ 0 ];

/**
 * Text shown when no display text is set (matches wp_free_charts_contact_link()):
 * the detail itself for email/phone/WhatsApp, the address without "https://"
 * for a website, and the network's name for social profiles.
 */
export function defaultText( type, value ) {
	if ( type.group === 'social' ) return type.label;
	if ( type.name === 'website' ) return value.replace( /^https?:\/\//i, '' ).replace( /\/$/, '' );
	return value;
}
