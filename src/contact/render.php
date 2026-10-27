<?php
/**
 * Front-end markup for the Contact Details block. The flex layout classes and
 * gap are added by WordPress's layout block support. Item and icon styling
 * (set on this block, applied to every item) becomes classes + CSS custom
 * properties here: see includes/contact-styles.php and style.css.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered Contact Item blocks.
 * @var WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wfc_style = wp_free_charts_contact_style( $attributes );

printf(
	'<div %1$s>%2$s</div>',
	get_block_wrapper_attributes( array( 'class' => $wfc_style['class'], 'style' => $wfc_style['style'] ) ),
	$content // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- rendered inner blocks.
);
