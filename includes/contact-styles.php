<?php
/**
 * Contact Details styling (front end): turns the parent block's item/icon
 * settings into classes + CSS custom properties on the wrapper, which
 * src/contact/style.css applies to every item. Mirrors src/contact/styles.js
 * (the editor); keep the two in step.
 *
 * Values come from block attributes, which Authors can set, so each one is
 * checked against a narrow pattern before it reaches the style attribute.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** A CSS length ("12px", "1.5em", "0") or ''. */
function wp_free_charts_css_length( $value ) {
	$value = trim( (string) $value );
	return preg_match( '/^(0|\d*\.?\d+(px|em|rem|%|vw|vh|ch|pt))$/', $value ) ? $value : '';
}

/** A theme spacing preset ("var:preset|spacing|40") as a CSS var, or a length. */
function wp_free_charts_css_spacing( $value ) {
	if ( is_string( $value ) && preg_match( '/^var:preset\|spacing\|([a-z0-9-]+)$/', $value, $m ) ) {
		return 'var(--wp--preset--spacing--' . $m[1] . ')';
	}
	return wp_free_charts_css_length( $value );
}

/** A colour: theme slug -> preset var; else hex / rgb() / hsl() / a name. Or ''. */
function wp_free_charts_css_color( $value, $slug ) {
	if ( is_string( $slug ) && preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
		return 'var(--wp--preset--color--' . $slug . ')';
	}
	$value = trim( (string) $value );
	if ( preg_match( '/^#[0-9a-f]{3,8}$/i', $value ) || preg_match( '/^(rgb|rgba|hsl|hsla)\([0-9.,%\s\/deg]+\)$/i', $value ) || preg_match( '/^[a-z]{3,20}$/i', $value ) ) {
		return $value;
	}
	return '';
}

/**
 * Classes and inline style for the Contact Details wrapper.
 *
 * @param array $a Block attributes.
 * @return array{class: string, style: string}
 */
function wp_free_charts_contact_style( $a ) {
	$get = function ( $key, $default = '' ) use ( $a ) {
		return isset( $a[ $key ] ) && is_scalar( $a[ $key ] ) ? (string) $a[ $key ] : $default;
	};
	$one_of = function ( $key, $allowed, $default ) use ( $get ) {
		$v = $get( $key, $default );
		return in_array( $v, $allowed, true ) ? $v : $default;
	};

	$classes = array(
		'is-item-style-' . $one_of( 'itemStyle', array( 'plain', 'button', 'outline' ), 'plain' ),
		'is-icon-' . $one_of( 'iconPosition', array( 'before', 'after', 'top' ), 'before' ),
	);
	$shape = $one_of( 'iconShape', array( 'none', 'circle', 'rounded', 'square' ), 'none' );
	if ( 'none' !== $shape ) {
		$classes[] = 'has-icon-shape-' . $shape;
	}
	if ( isset( $a['showText'] ) && false === $a['showText'] ) {
		$classes[] = 'is-icon-only';
	}

	// Padding: any side set -> all four (unset sides are 0).
	$padding = '';
	if ( isset( $a['itemPadding'] ) && is_array( $a['itemPadding'] ) ) {
		$sides = array();
		$any   = false;
		foreach ( array( 'top', 'right', 'bottom', 'left' ) as $side ) {
			$v       = isset( $a['itemPadding'][ $side ] ) ? wp_free_charts_css_spacing( $a['itemPadding'][ $side ] ) : '';
			$any     = $any || '' !== $v;
			$sides[] = '' === $v ? '0' : $v;
		}
		$padding = $any ? implode( ' ', $sides ) : '';
	}
	$decoration = $one_of( 'itemDecoration', array( '', 'none', 'underline' ), '' );
	$border_style = $one_of( 'itemBorderStyle', array( '', 'solid', 'dashed', 'dotted', 'double', 'none' ), '' );

	// CSS var => [ value, class added when set ].
	$vars = array(
		'--wfc-item-color'        => array( wp_free_charts_css_color( $get( 'itemColor' ), $get( 'itemColorSlug' ) ), 'has-item-color' ),
		'--wfc-item-bg'           => array( wp_free_charts_css_color( $get( 'itemBackground' ), $get( 'itemBackgroundSlug' ) ), 'has-item-bg' ),
		'--wfc-item-hover-color'  => array( wp_free_charts_css_color( $get( 'itemHoverColor' ), $get( 'itemHoverColorSlug' ) ), 'has-item-hover-color' ),
		'--wfc-item-hover-bg'     => array( wp_free_charts_css_color( $get( 'itemHoverBackground' ), $get( 'itemHoverBackgroundSlug' ) ), 'has-item-hover-bg' ),
		'--wfc-item-border-color' => array( wp_free_charts_css_color( $get( 'itemBorderColor' ), $get( 'itemBorderColorSlug' ) ), 'has-item-border' ),
		'--wfc-item-border-width' => array( wp_free_charts_css_length( $get( 'itemBorderWidth' ) ), 'has-item-border' ),
		'--wfc-item-border-style' => array( $border_style, 'has-item-border' ),
		'--wfc-item-radius'       => array( wp_free_charts_css_length( $get( 'itemRadius' ) ), 'has-item-radius' ),
		'--wfc-item-padding'      => array( $padding, 'has-item-padding' ),
		'--wfc-item-gap'          => array( wp_free_charts_css_length( $get( 'itemGap' ) ), '' ),
		'--wfc-item-decoration'   => array( $decoration, 'has-item-decoration' ),
		'--wfc-icon-color'        => array( wp_free_charts_css_color( $get( 'iconColor' ), $get( 'iconColorSlug' ) ), 'has-icon-color' ),
		'--wfc-icon-bg'           => array( wp_free_charts_css_color( $get( 'iconBackground' ), $get( 'iconBackgroundSlug' ) ), 'has-icon-bg' ),
		'--wfc-icon-size'         => array( wp_free_charts_css_length( $get( 'iconSize' ) ), '' ),
		'--wfc-icon-padding'      => array( wp_free_charts_css_length( $get( 'iconPadding' ) ), '' ),
	);

	$style = '';
	foreach ( $vars as $name => list( $value, $class ) ) {
		if ( '' === $value ) {
			continue;
		}
		$style .= $name . ':' . $value . ';';
		if ( $class && ! in_array( $class, $classes, true ) ) {
			$classes[] = $class;
		}
	}

	return array( 'class' => implode( ' ', $classes ), 'style' => $style );
}
