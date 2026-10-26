<?php
/**
 * Contact block helpers: reading a contact detail from a custom field (ACF or
 * post meta), used by build/contact/item/render.php on the front end and by a
 * small REST route that lets the editor preview the value and explain why a
 * field gives nothing.
 *
 * Security: contact blocks can be added by Authors and the output is public,
 * so fields are read only from:
 *  - post:   the current post (each post inside a Query Loop): its ACF field,
 *            or else plain post meta that isn't protected ("_…");
 *  - option: an ACF field on an Options page;
 *  - author: an ACF field on the post author's profile.
 * Raw wp_options and user meta are never read.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** RichText HTML ("&amp;", tags) to plain text. */
function wp_free_charts_contact_plain( $html ) {
	return trim( html_entity_decode( wp_strip_all_tags( (string) $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
}

/**
 * Resolve a contact detail from a custom field.
 *
 * `$name` may point into a Group (or other array) field with dots:
 * "contact.email" reads the "email" sub-field of the "contact" field.
 *
 * @param string $name    Field name, e.g. "staff_email" or "contact.email".
 * @param string $from    'post', 'option' or 'author'.
 * @param int    $post_id The post being shown (0 if none).
 * @return array {
 *     @type string $value      Plain-text value ('' when there's none).
 *     @type string $error      '' or a reason code: invalid_name, no_post, no_author,
 *                              needs_acf, not_found, empty, not_text.
 *     @type string $field_type ACF field type when known.
 *     @type array  $suggest    For not_text: dotted names of text sub-values to use instead.
 * }
 */
function wp_free_charts_contact_resolve_field( $name, $from, $post_id ) {
	$result = array( 'value' => '', 'error' => '', 'field_type' => '', 'suggest' => array() );
	$fail   = function ( $code ) use ( &$result ) {
		$result['error'] = $code;
		return $result;
	};

	if ( ! preg_match( '/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}(\.[A-Za-z0-9_-]{1,64}){0,3}$/', (string) $name ) ) {
		return $fail( 'invalid_name' );
	}
	$path    = explode( '.', $name );
	$base    = array_shift( $path );
	$post_id = (int) $post_id;
	$has_acf = function_exists( 'get_field_object' );

	if ( 'option' === $from || 'author' === $from ) {
		if ( ! $has_acf ) {
			return $fail( 'needs_acf' );
		}
		if ( 'option' === $from ) {
			$target = 'option';
		} else {
			$author = $post_id ? (int) get_post_field( 'post_author', $post_id ) : 0;
			if ( ! $author ) {
				return $fail( $post_id ? 'no_author' : 'no_post' );
			}
			$target = 'user_' . $author;
		}
	} else {
		if ( ! $post_id ) {
			return $fail( 'no_post' );
		}
		$target = $post_id;
	}

	$found = false;
	$raw   = null;
	if ( $has_acf ) {
		$field = get_field_object( $base, $target );
		if ( is_array( $field ) ) {
			$found                = true;
			$raw                  = isset( $field['value'] ) ? $field['value'] : null;
			$result['field_type'] = isset( $field['type'] ) ? (string) $field['type'] : '';
		}
	}
	if ( ! $found && 'post' === $from && ! is_protected_meta( $base, 'post' ) && metadata_exists( 'post', $post_id, $base ) ) {
		$found = true;
		$raw   = get_post_meta( $post_id, $base, true );
	}
	if ( ! $found ) {
		return $fail( 'not_found' );
	}

	foreach ( $path as $key ) {
		if ( is_object( $raw ) ) {
			$raw = get_object_vars( $raw );
		}
		if ( ! is_array( $raw ) || ! array_key_exists( $key, $raw ) ) {
			return $fail( null === $raw || '' === $raw || array() === $raw ? 'empty' : 'not_found' );
		}
		$raw = $raw[ $key ];
	}

	if ( is_object( $raw ) ) {
		$raw = get_object_vars( $raw );
	}
	if ( is_array( $raw ) ) {
		foreach ( $raw as $key => $sub ) {
			if ( is_string( $key ) && is_scalar( $sub ) && ! is_bool( $sub ) && '' !== trim( (string) $sub ) ) {
				$result['suggest'][] = $name . '.' . $key;
			}
		}
		return $fail( array() === $raw ? 'empty' : 'not_text' );
	}
	if ( null === $raw || is_bool( $raw ) ) {
		return $fail( 'empty' );
	}

	$result['value'] = wp_free_charts_contact_plain( $raw );
	return '' === $result['value'] ? $fail( 'empty' ) : $result;
}

/**
 * GET /wp-free-charts/v1/contact-field?field=…&from=…&post_id=…
 * Editor preview: the same lookup as the front end, for users who can edit
 * posts and read that post.
 */
function wp_free_charts_contact_register_rest() {
	register_rest_route(
		'wp-free-charts/v1',
		'/contact-field',
		array(
			'methods'             => 'GET',
			'callback'            => function ( WP_REST_Request $request ) {
				return rest_ensure_response(
					wp_free_charts_contact_resolve_field( $request['field'], $request['from'], $request['post_id'] )
				);
			},
			'permission_callback' => function ( WP_REST_Request $request ) {
				$post_id = (int) $request['post_id'];
				return current_user_can( 'edit_posts' ) && ( ! $post_id || current_user_can( 'read_post', $post_id ) );
			},
			'args'                => array(
				'field'   => array( 'type' => 'string', 'required' => true ),
				'from'    => array( 'type' => 'string', 'enum' => array( 'post', 'option', 'author' ), 'default' => 'post' ),
				'post_id' => array( 'type' => 'integer', 'default' => 0, 'minimum' => 0 ),
			),
		)
	);
}
add_action( 'rest_api_init', 'wp_free_charts_contact_register_rest' );
