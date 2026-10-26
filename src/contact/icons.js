/**
 * Icons for the contact blocks. The front end draws the same SVGs from
 * item/render.php, so change both together.
 *
 * They're filled shapes (no strokes) on purpose: the editor's block-icon CSS
 * and many themes set `svg { fill: currentColor }`, which turns stroke-only
 * outlines into solid boxes.
 */
const svgProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	viewBox: '0 0 24 24',
	width: 24,
	height: 24,
	fill: 'currentColor',
	'aria-hidden': true,
	focusable: false,
};

// Rounded frame shared by the envelope and the card (outer edge minus inner edge).
const FRAME = 'M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z';

export const emailIcon = (
	<svg { ...svgProps } className="wfc-contact-item__icon">
		<path fillRule="evenodd" d={ FRAME } />
		<path d="M4.4 7.2 5.6 5.6 12 9.9l6.4-4.3 1.2 1.6-7.6 5.1z" />
	</svg>
);

export const phoneIcon = (
	<svg { ...svgProps } className="wfc-contact-item__icon">
		<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
	</svg>
);

/** Block icon for Contact Details: a contact card. */
export const cardIcon = (
	<svg { ...svgProps }>
		<path fillRule="evenodd" d={ FRAME } />
		<circle cx="9" cy="10.5" r="2" />
		<path d="M5.8 16.5c.5-1.7 1.8-2.6 3.2-2.6s2.7.9 3.2 2.6zM14 9.5h4V11h-4zm0 3.5h4v1.5h-4z" />
	</svg>
);
