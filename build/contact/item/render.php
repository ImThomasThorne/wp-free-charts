<?php
/**
 * Front-end markup for one Contact Item: an <a> with an icon, a link built
 * from the contact detail, and (unless the parent hides it) the text.
 *
 * Colours, typography, padding and borders from the sidebar arrive through
 * get_block_wrapper_attributes(), so the <a> is the block wrapper.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance (context: wp-free-charts/showText).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * The kinds of contact item. Keep in step with src/contact/types.js (same
 * names) and src/contact/icons.js (same icons).
 *  - icon:     inner SVG markup on a 24x24 grid, drawn with fill (no strokes).
 *  - protocol: the link's scheme, allowed through esc_url().
 *  - link:     contact detail => array( link target without scheme, accessible name ),
 *              or null when the detail can't make a link (nothing is output).
 */
$wfc_frame = 'M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z';
$wfc_types = array(
	'email' => array(
		'icon'     => '<path fill-rule="evenodd" d="' . $wfc_frame . '"/><path d="M4.4 7.2 5.6 5.6 12 9.9l6.4-4.3 1.2 1.6-7.6 5.1z"/>',
		'protocol' => 'mailto',
		'link'     => static function ( $value ) {
			$email = sanitize_email( $value );
			/* translators: %s: email address. */
			return '' === $email ? null : array( $email, sprintf( __( 'Email %s', 'wp-free-charts' ), $email ) );
		},
	),
	'phone' => array(
		'icon'     => '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
		'protocol' => 'tel',
		'link'     => static function ( $value ) {
			// tel: links take digits only, with an optional leading "+".
			$number = preg_replace( '/[^0-9]/', '', $value );
			if ( '' === $number ) {
				return null;
			}
			if ( 0 === strpos( $value, '+' ) ) {
				$number = '+' . $number;
			}
			/* translators: %s: phone number. */
			return array( $number, sprintf( __( 'Call %s', 'wp-free-charts' ), $value ) );
		},
	),
);

$wfc_type_name = isset( $attributes['type'], $wfc_types[ $attributes['type'] ] ) ? $attributes['type'] : 'email';
$wfc_type      = $wfc_types[ $wfc_type_name ];
$wfc_label     = wp_free_charts_contact_plain( isset( $attributes['label'] ) ? $attributes['label'] : '' );

if ( isset( $attributes['source'] ) && 'field' === $attributes['source'] ) {
	// Lookup rules (and why they're strict) are in includes/contact-fields.php.
	$wfc_field = wp_free_charts_contact_resolve_field_safe(
		isset( $attributes['field'] ) ? (string) $attributes['field'] : '',
		isset( $attributes['fieldFrom'] ) ? (string) $attributes['fieldFrom'] : 'post',
		isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID()
	);
	$wfc_value = $wfc_field['value'];
} else {
	$wfc_value = wp_free_charts_contact_plain( isset( $attributes['value'] ) ? $attributes['value'] : '' );
}

$wfc_link = '' === $wfc_value ? null : call_user_func( $wfc_type['link'], $wfc_value );
if ( ! $wfc_link ) {
	return;
}
$wfc_href = esc_url( $wfc_type['protocol'] . ':' . $wfc_link[0], array( $wfc_type['protocol'] ) );
if ( '' === $wfc_href ) {
	return;
}

$wfc_show_text = ! isset( $block->context['wp-free-charts/showText'] ) || false !== $block->context['wp-free-charts/showText'];
$wfc_text      = '' !== $wfc_label ? $wfc_label : $wfc_value;

$wfc_classes = array( 'is-type-' . $wfc_type_name );
$wfc_custom  = isset( $attributes['className'] ) ? (string) $attributes['className'] : '';
if ( preg_match( '/(^|\s)is-style-button(\s|$)/', $wfc_custom ) ) {
	$wfc_classes[] = 'wp-element-button';
}
if ( ! $wfc_show_text ) {
	$wfc_classes[] = 'is-icon-only';
}

$wfc_extra = array(
	'class' => implode( ' ', $wfc_classes ),
	'href'  => $wfc_href,
);
// Icon only: the link needs a name. With text, a custom label like "Call us"
// is fine as it is.
if ( ! $wfc_show_text ) {
	$wfc_extra['aria-label'] = $wfc_link[1];
}

printf(
	'<a %1$s><svg class="wfc-contact-item__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false">%2$s</svg>%3$s</a>',
	get_block_wrapper_attributes( $wfc_extra ), // Escapes each attribute.
	$wfc_type['icon'], // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixed markup.
	$wfc_show_text ? '<span class="wfc-contact-item__text">' . esc_html( $wfc_text ) . '</span>' : ''
);
