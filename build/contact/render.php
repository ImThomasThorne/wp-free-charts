<?php
/**
 * Front-end markup for the Contact Details block. The flex layout classes and
 * gap are added by WordPress's layout block support.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered Contact Item blocks.
 * @var WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wfc_classes = empty( $attributes['showText'] ) ? 'is-icon-only' : '';

printf(
	'<div %1$s>%2$s</div>',
	get_block_wrapper_attributes( array( 'class' => $wfc_classes ) ),
	$content // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- rendered inner blocks.
);
