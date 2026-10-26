<?php
/**
 * Front-end markup for one Contact Item: an <a> with a mailto: or tel: link,
 * an icon, and (unless the parent hides it) the text.
 *
 * Colours, typography, padding and borders from the sidebar arrive through
 * get_block_wrapper_attributes(), so the <a> is the block wrapper.
 * The icons match src/contact/icons.js.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance (context: wp-free-charts/showText).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wp_free_charts_contact_plain' ) ) {
	/** RichText HTML ("&amp;", tags) to plain text. */
	function wp_free_charts_contact_plain( $html ) {
		return trim( html_entity_decode( wp_strip_all_tags( (string) $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
	}
}

$wfc_type  = ( isset( $attributes['type'] ) && 'phone' === $attributes['type'] ) ? 'phone' : 'email';
$wfc_value = wp_free_charts_contact_plain( isset( $attributes['value'] ) ? $attributes['value'] : '' );
$wfc_label = wp_free_charts_contact_plain( isset( $attributes['label'] ) ? $attributes['label'] : '' );

if ( 'phone' === $wfc_type ) {
	// tel: links take digits only, with an optional leading "+".
	$wfc_number = preg_replace( '/[^0-9]/', '', $wfc_value );
	if ( '' === $wfc_number ) {
		return;
	}
	if ( 0 === strpos( ltrim( $wfc_value ), '+' ) ) {
		$wfc_number = '+' . $wfc_number;
	}
	$wfc_href = esc_url( 'tel:' . $wfc_number, array( 'tel' ) );
	/* translators: %s: phone number. */
	$wfc_aria = sprintf( __( 'Call %s', 'wp-free-charts' ), $wfc_value );
} else {
	$wfc_email = sanitize_email( $wfc_value );
	if ( '' === $wfc_email ) {
		return;
	}
	$wfc_href = esc_url( 'mailto:' . $wfc_email, array( 'mailto' ) );
	/* translators: %s: email address. */
	$wfc_aria = sprintf( __( 'Email %s', 'wp-free-charts' ), $wfc_email );
}

if ( '' === $wfc_href ) {
	return;
}

$wfc_show_text = ! isset( $block->context['wp-free-charts/showText'] ) || false !== $block->context['wp-free-charts/showText'];
$wfc_text      = '' !== $wfc_label ? $wfc_label : $wfc_value;

$wfc_classes = array( 'is-type-' . $wfc_type );
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
	$wfc_extra['aria-label'] = $wfc_aria;
}

$wfc_icon_attrs = 'class="wfc-contact-item__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
$wfc_icons      = array(
	'email' => '<svg ' . $wfc_icon_attrs . '><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
	'phone' => '<svg ' . $wfc_icon_attrs . '><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
);

printf(
	'<a %1$s>%2$s%3$s</a>',
	get_block_wrapper_attributes( $wfc_extra ), // Escapes each attribute.
	$wfc_icons[ $wfc_type ], // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fixed markup.
	$wfc_show_text ? '<span class="wfc-contact-item__text">' . esc_html( $wfc_text ) . '</span>' : ''
);
