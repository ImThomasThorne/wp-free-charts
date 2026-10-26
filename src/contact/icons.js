/**
 * Icons for the contact blocks. The front end draws the same SVGs from
 * item/render.php, so change both together.
 */
const svgProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	viewBox: '0 0 24 24',
	width: 24,
	height: 24,
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
	focusable: false,
};

export const emailIcon = (
	<svg { ...svgProps } className="wfc-contact-item__icon">
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<path d="m3 7 9 6 9-6" />
	</svg>
);

export const phoneIcon = (
	<svg { ...svgProps } className="wfc-contact-item__icon">
		<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
	</svg>
);

export const ICONS = { email: emailIcon, phone: phoneIcon };

/** Block icon for Contact Details: a contact card. */
export const cardIcon = (
	<svg { ...svgProps }>
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<circle cx="9" cy="11" r="2" />
		<path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M15 10h3M15 14h3" />
	</svg>
);
