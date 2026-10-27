/**
 * Icons for the contact blocks, built from includes/contact-icons.json, the
 * same data the front end uses (includes/contact-types.php).
 *
 * Filled shapes only, on purpose: the editor's block-icon CSS and many themes
 * set `svg { fill: currentColor }`, which turns stroke-only outlines into solid boxes.
 */
import ICON_DATA from '../../includes/contact-icons.json';

const svgProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	viewBox: '0 0 24 24',
	width: 24,
	height: 24,
	fill: 'currentColor',
	'aria-hidden': true,
	focusable: false,
};

/** The bare <svg> for a type name (unknown names get the email icon). */
export function getSvg( name ) {
	const paths = ( name && name[ 0 ] !== '_' && ICON_DATA[ name ] ) || ICON_DATA.email;
	return (
		<svg { ...svgProps } className="wfc-contact-item__icon">
			{ paths.map( ( p, i ) => <path key={ i } d={ p.d } fillRule={ p.evenodd ? 'evenodd' : undefined } /> ) }
		</svg>
	);
}

/**
 * The icon as shown in an item: the <svg> inside a wrapper that carries the
 * background shape (circle etc.). The shape must not be on the <svg> itself:
 * browsers clip an <svg>'s content to its own rounded corners, which cut the
 * corners off square logos. Same markup as wp_free_charts_contact_icon().
 */
export function getIcon( name ) {
	return <span className="wfc-contact-item__icon-wrap" aria-hidden="true">{ getSvg( name ) }</span>;
}

export const emailIcon = getSvg( 'email' );

// Rounded frame for the card icon below.
const FRAME = 'M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z';

/** Block icon for Contact Details: a contact card. */
export const cardIcon = (
	<svg { ...svgProps }>
		<path fillRule="evenodd" d={ FRAME } />
		<circle cx="9" cy="10.5" r="2" />
		<path d="M5.8 16.5c.5-1.7 1.8-2.6 3.2-2.6s2.7.9 3.2 2.6zM14 9.5h4V11h-4zm0 3.5h4v1.5h-4z" />
	</svg>
);
