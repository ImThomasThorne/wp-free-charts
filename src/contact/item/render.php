<?php
/**
 * Front-end markup for one Contact Item: an <a> with the type's icon and
 * (unless the parent hides it) the text.
 *
 * Styling is set on the parent Contact Details block and reaches the item
 * through CSS (see ../style.css) plus context: itemStyle "button" adds
 * wp-element-button so the theme's button styles apply. Types (links, icons)
 * are in includes/contact-types.php; field lookups in includes/contact-fields.php.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance (context: showText, itemStyle, openInNewTab, postId).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wfc_types     = wp_free_charts_contact_types();
$wfc_type_name = isset( $attributes['type'], $wfc_types[ $attributes['type'] ] ) ? $attributes['type'] : 'email';
$wfc_label     = wp_free_charts_contact_plain( isset( $attributes['label'] ) ? $attributes['label'] : '' );
$wfc_context   = $block->context;

if ( isset( $attributes['source'] ) && 'field' === $attributes['source'] ) {
	$wfc_field = wp_free_charts_contact_resolve_field_safe(
		isset( $attributes['field'] ) ? (string) $attributes['field'] : '',
		isset( $attributes['fieldFrom'] ) ? (string) $attributes['fieldFrom'] : 'post',
		isset( $wfc_context['postId'] ) ? (int) $wfc_context['postId'] : (int) get_the_ID()
	);
	$wfc_value = $wfc_field['value'];
} else {
	$wfc_value = wp_free_charts_contact_plain( isset( $attributes['value'] ) ? $attributes['value'] : '' );
}

$wfc_link = wp_free_charts_contact_link( $wfc_type_name, $wfc_value );
if ( ! $wfc_link || '' === $wfc_link['href'] ) {
	return;
}

$wfc_show_text  = ! isset( $wfc_context['wp-free-charts/showText'] ) || false !== $wfc_context['wp-free-charts/showText'];
$wfc_item_style = isset( $wfc_context['wp-free-charts/itemStyle'] ) ? (string) $wfc_context['wp-free-charts/itemStyle'] : 'plain';
$wfc_new_tab    = ! empty( $wfc_context['wp-free-charts/openInNewTab'] ) && $wfc_link['external'];
$wfc_text       = '' !== $wfc_label ? $wfc_label : $wfc_link['text'];

// Items saved before 2.7 could have the old per-item "Button" style.
$wfc_custom    = isset( $attributes['className'] ) ? (string) $attributes['className'] : '';
$wfc_is_button = 'button' === $wfc_item_style || ( 'plain' === $wfc_item_style && preg_match( '/(^|\s)is-style-button(\s|$)/', $wfc_custom ) );

$wfc_classes = array( 'is-type-' . $wfc_type_name );
if ( $wfc_is_button ) {
	$wfc_classes[] = 'wp-element-button';
}
if ( ! $wfc_show_text ) {
	$wfc_classes[] = 'is-icon-only';
}

$wfc_extra = array(
	'class' => implode( ' ', $wfc_classes ),
	'href'  => $wfc_link['href'],
);
if ( $wfc_new_tab ) {
	$wfc_extra['target'] = '_blank';
	$wfc_extra['rel']    = 'noopener noreferrer';
}
// Icon only: the link needs a name (display text if set, else e.g. "Email a@b.com").
if ( ! $wfc_show_text ) {
	$wfc_extra['aria-label'] = ( '' !== $wfc_label ? $wfc_label : $wfc_link['name'] )
		. ( $wfc_new_tab ? ' ' . __( '(opens in a new tab)', 'wp-free-charts' ) : '' );
}

$wfc_text_html = '';
if ( $wfc_show_text ) {
	$wfc_text_html = '<span class="wfc-contact-item__text">' . esc_html( $wfc_text ) . '</span>';
	if ( $wfc_new_tab ) {
		$wfc_text_html .= '<span class="wfc-sr-only">' . esc_html__( '(opens in a new tab)', 'wp-free-charts' ) . '</span>';
	}
}

printf(
	'<a %1$s>%2$s%3$s</a>',
	get_block_wrapper_attributes( $wfc_extra ), // Escapes each attribute.
	wp_free_charts_contact_icon( $wfc_type_name ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped icon data.
	$wfc_text_html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
);
