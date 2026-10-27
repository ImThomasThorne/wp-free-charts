<?php
/**
 * Contact item types (front end): label, how the link is built, and the icon.
 * The editor's list is src/contact/types.js; keep the names in step. Icons
 * for both come from contact-icons.json.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The types, in dropdown order.
 * - kind: email | phone | whatsapp | url (website and social profiles).
 * - label: shown as the default text for social profiles and in screen-reader names.
 *
 * @return array<string, array{label: string, kind: string}>
 */
function wp_free_charts_contact_types() {
	$social = array(
		'facebook'  => 'Facebook',
		'instagram' => 'Instagram',
		'x'         => 'X',
		'linkedin'  => 'LinkedIn',
		'youtube'   => 'YouTube',
		'tiktok'    => 'TikTok',
		'threads'   => 'Threads',
		'bluesky'   => 'Bluesky',
		'pinterest' => 'Pinterest',
		'snapchat'  => 'Snapchat',
		'discord'   => 'Discord',
		'mastodon'  => 'Mastodon',
	);
	$types = array(
		'email'    => array( 'label' => __( 'Email', 'wp-free-charts' ), 'kind' => 'email' ),
		'phone'    => array( 'label' => __( 'Phone', 'wp-free-charts' ), 'kind' => 'phone' ),
		'whatsapp' => array( 'label' => 'WhatsApp', 'kind' => 'whatsapp' ),
		'website'  => array( 'label' => __( 'Website', 'wp-free-charts' ), 'kind' => 'url' ),
	);
	foreach ( $social as $name => $label ) {
		$types[ $name ] = array( 'label' => $label, 'kind' => 'url' );
	}
	return $types;
}

/**
 * Build the link for a contact detail.
 *
 * @param string $type  Type name (unknown names fall back to email).
 * @param string $value Plain-text contact detail.
 * @return array{href: string, text: string, name: string, external: bool}|null
 *         href (escaped), default display text, accessible name, and whether it's
 *         a web link (eligible for "open in a new tab"); null when no link can be made.
 */
function wp_free_charts_contact_link( $type, $value ) {
	$types = wp_free_charts_contact_types();
	$def   = isset( $types[ $type ] ) ? $types[ $type ] : $types['email'];
	$value = trim( (string) $value );
	if ( '' === $value ) {
		return null;
	}

	switch ( $def['kind'] ) {
		case 'email':
			$email = sanitize_email( $value );
			if ( '' === $email ) {
				return null;
			}
			/* translators: %s: email address. */
			return array( 'href' => esc_url( 'mailto:' . $email, array( 'mailto' ) ), 'text' => $email, 'name' => sprintf( __( 'Email %s', 'wp-free-charts' ), $email ), 'external' => false );

		case 'phone':
		case 'whatsapp':
			// Digits only, with an optional leading "+" (wa.me wants no "+").
			$digits = preg_replace( '/[^0-9]/', '', $value );
			if ( '' === $digits ) {
				return null;
			}
			if ( 'whatsapp' === $def['kind'] ) {
				/* translators: %s: phone number. */
				return array( 'href' => esc_url( 'https://wa.me/' . $digits, array( 'https' ) ), 'text' => $value, 'name' => sprintf( __( 'WhatsApp %s', 'wp-free-charts' ), $value ), 'external' => true );
			}
			$number = ( 0 === strpos( $value, '+' ) ? '+' : '' ) . $digits;
			/* translators: %s: phone number. */
			return array( 'href' => esc_url( 'tel:' . $number, array( 'tel' ) ), 'text' => $value, 'name' => sprintf( __( 'Call %s', 'wp-free-charts' ), $value ), 'external' => false );

		default: // url
			$url = preg_match( '#^https?://#i', $value ) ? $value : 'https://' . ltrim( $value, '/' );
			$url = esc_url( $url, array( 'http', 'https' ) );
			// Needs a host with a dot. (Not wp_http_validate_url(): it does a DNS lookup.)
			if ( '' === $url || ! preg_match( '#^https?://[^/\s?\#]+\.[^/\s?\#]+#i', $url ) ) {
				return null;
			}
			if ( 'website' === $type ) {
				// "https://www.example.com/" -> "www.example.com"
				$text = untrailingslashit( preg_replace( '#^https?://#i', '', $value ) );
				/* translators: %s: website address. */
				return array( 'href' => $url, 'text' => $text, 'name' => sprintf( __( 'Website: %s', 'wp-free-charts' ), $text ), 'external' => true );
			}
			return array( 'href' => $url, 'text' => $def['label'], 'name' => $def['label'], 'external' => true );
	}
}

/**
 * The icon as an <svg> (from contact-icons.json). Unknown names fall back to email.
 *
 * @param string $type Type name.
 * @return string Fixed, escaped markup.
 */
function wp_free_charts_contact_icon( $type ) {
	static $icons = null;
	if ( null === $icons ) {
		$json  = file_get_contents( __DIR__ . '/contact-icons.json' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.
		$icons = $json ? json_decode( $json, true ) : array();
	}
	$paths = isset( $icons[ $type ] ) && '_' !== $type[0] ? $icons[ $type ] : ( isset( $icons['email'] ) ? $icons['email'] : array() );

	$inner = '';
	foreach ( (array) $paths as $path ) {
		$inner .= sprintf(
			'<path%s d="%s"/>',
			empty( $path['evenodd'] ) ? '' : ' fill-rule="evenodd"',
			esc_attr( isset( $path['d'] ) ? $path['d'] : '' )
		);
	}
	// The wrapper carries the background shape; on the <svg> itself a rounded
	// shape would clip the icon's corners. Same markup as getIcon() in src/contact/icons.js.
	return '<span class="wfc-contact-item__icon-wrap" aria-hidden="true">'
		. '<svg class="wfc-contact-item__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false">' . $inner . '</svg>'
		. '</span>';
}
