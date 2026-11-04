<?php
/**
 * Front-end markup for the Image Swap block:
 *   <a|div .wp-block-wp-free-charts-image-swap data-revert="3000">
 *     <img .wfc-image-swap__img .wfc-image-swap__img--main>
 *     <img .wfc-image-swap__img .wfc-image-swap__img--hover aria-hidden>
 *   </a|div>
 * Mouse hover is pure CSS (style.css). view.js adds .is-swapped on tap and on
 * keyboard focus, and removes it after data-revert ms.
 * Images are found by includes/image-swap.php.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance (context: postId).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wfc_post_id = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID();
$wfc_main    = wp_free_charts_image_swap_resolve_safe( wp_free_charts_image_swap_slot( $attributes, 'main' ), $wfc_post_id );
if ( ! $wfc_main['id'] ) {
	return; // No main image: show nothing (e.g. a staff member without a photo yet).
}
$wfc_hover = wp_free_charts_image_swap_resolve_safe( wp_free_charts_image_swap_slot( $attributes, 'hover' ), $wfc_post_id );
if ( $wfc_hover['id'] === $wfc_main['id'] ) {
	$wfc_hover['id'] = 0;
}

$wfc_size  = wp_free_charts_image_swap_size( isset( $attributes['sizeSlug'] ) ? $attributes['sizeSlug'] : 'large' );
$wfc_ratio = isset( $attributes['aspectRatio'] ) ? (string) $attributes['aspectRatio'] : '';
$wfc_ratio = preg_match( '#^\d{1,4}(\.\d{1,3})?/\d{1,4}(\.\d{1,3})?$#', $wfc_ratio ) ? $wfc_ratio : '';
$wfc_width = isset( $attributes['width'] ) ? (string) $attributes['width'] : '';
$wfc_width = preg_match( '/^\d{1,4}(\.\d{1,3})?(px|em|rem|%|vw)$/', $wfc_width ) ? $wfc_width : '';
$wfc_fit   = isset( $attributes['scale'] ) && 'contain' === $attributes['scale'] ? 'contain' : 'cover';
$wfc_delay = isset( $attributes['revertDelay'] ) ? (float) $attributes['revertDelay'] : 3;
$wfc_delay = (int) round( 1000 * min( 30, max( 0.5, $wfc_delay ) ) );
$wfc_link  = ! empty( $attributes['linkToPost'] ) && $wfc_post_id ? get_permalink( $wfc_post_id ) : '';

// Alt text: the image's own, or the post title (e.g. the staff member's name).
$wfc_alt = trim( (string) get_post_meta( $wfc_main['id'], '_wp_attachment_image_alt', true ) );
if ( '' === $wfc_alt && $wfc_post_id ) {
	$wfc_alt = wp_strip_all_tags( get_the_title( $wfc_post_id ) );
}

$wfc_classes = array();
$wfc_styles  = array();
if ( $wfc_hover['id'] ) {
	$wfc_classes[] = 'has-hover-image';
}
if ( isset( $attributes['fade'] ) && false === $attributes['fade'] ) {
	$wfc_classes[] = 'is-instant';
}
if ( $wfc_ratio ) {
	$wfc_classes[] = 'has-aspect-ratio';
	$wfc_styles[]  = 'aspect-ratio:' . $wfc_ratio;
}
if ( 'contain' === $wfc_fit ) {
	$wfc_classes[] = 'is-fit-contain';
}
if ( $wfc_width ) {
	$wfc_styles[] = 'width:' . $wfc_width;
}

$wfc_extra = array( 'class' => implode( ' ', $wfc_classes ) );
if ( $wfc_styles ) {
	$wfc_extra['style'] = implode( ';', $wfc_styles ) . ';';
}
if ( $wfc_hover['id'] ) {
	$wfc_extra['data-revert'] = (string) $wfc_delay;
}
if ( $wfc_link ) {
	$wfc_extra['href'] = $wfc_link;
} elseif ( $wfc_hover['id'] ) {
	// Focusable so keyboard users can see the second image too.
	$wfc_extra['tabindex'] = '0';
}

$wfc_main_html = wp_get_attachment_image(
	$wfc_main['id'],
	$wfc_size,
	false,
	array(
		'class' => 'wfc-image-swap__img wfc-image-swap__img--main',
		'alt'   => $wfc_alt,
	)
);

$wfc_hover_html = '';
if ( $wfc_hover['id'] ) {
	// Same picture of the same person, so it's hidden from screen readers.
	$wfc_hover_html = wp_get_attachment_image(
		$wfc_hover['id'],
		$wfc_size,
		false,
		array(
			'class'         => 'wfc-image-swap__img wfc-image-swap__img--hover',
			'alt'           => '',
			'aria-hidden'   => 'true',
			'loading'       => 'lazy',
			'decoding'      => 'async',
			'fetchpriority' => 'low',
		)
	);
}

$wfc_tag = $wfc_link ? 'a' : 'div';
printf(
	'<%1$s %2$s>%3$s%4$s</%1$s>',
	$wfc_tag, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- 'a' or 'div'.
	get_block_wrapper_attributes( $wfc_extra ), // Escapes each attribute.
	$wfc_main_html, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core image markup.
	$wfc_hover_html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core image markup.
);
