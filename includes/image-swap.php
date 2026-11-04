<?php
/**
 * Image Swap block helpers: find the image for each of the block's two slots
 * (main + hover), used by build/image-swap/render.php and by a REST route that
 * lets the editor preview the images and explain why a slot is empty.
 *
 * A slot's source is one of:
 *  - featured: the post's featured image (each post inside a Query Loop);
 *  - field:    a custom field, read with wp_free_charts_field_raw() (same
 *              security rules as the contact block). ACF image fields work with
 *              any return format (array, ID or URL); without ACF, post meta
 *              holding an attachment ID or URL works too;
 *  - media:    an image picked from the Media Library.
 * Whatever the source, the result must be an image attachment.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * @param array $slot    { source, field, from, mediaId }.
 * @param int   $post_id The post being shown (0 if none).
 * @return array { id: int, error: string, field_type: string }
 *               error: '' or no_post, no_featured, no_media, not_image, empty,
 *               plus the field codes from wp_free_charts_field_raw().
 */
function wp_free_charts_image_swap_resolve( $slot, $post_id ) {
	$source = isset( $slot['source'] ) ? (string) $slot['source'] : 'field';
	$out    = array( 'id' => 0, 'error' => '', 'field_type' => '' );
	$id     = 0;

	if ( 'featured' === $source ) {
		if ( ! $post_id ) {
			$out['error'] = 'no_post';
			return $out;
		}
		$id = (int) get_post_thumbnail_id( $post_id );
		if ( ! $id ) {
			$out['error'] = 'no_featured';
			return $out;
		}
	} elseif ( 'media' === $source ) {
		$id = isset( $slot['mediaId'] ) ? (int) $slot['mediaId'] : 0;
		if ( ! $id ) {
			$out['error'] = 'no_media';
			return $out;
		}
	} else {
		$read              = wp_free_charts_field_raw(
			isset( $slot['field'] ) ? (string) $slot['field'] : '',
			isset( $slot['from'] ) ? (string) $slot['from'] : 'post',
			$post_id
		);
		$out['field_type'] = $read['field_type'];
		if ( '' !== $read['error'] ) {
			$out['error'] = $read['error'];
			return $out;
		}
		$raw = $read['raw'];
		if ( is_object( $raw ) ) {
			$raw = get_object_vars( $raw );
		}
		if ( null === $raw || false === $raw || '' === $raw || array() === $raw || 0 === $raw || '0' === $raw ) {
			$out['error'] = 'empty';
			return $out;
		}
		if ( is_array( $raw ) ) {
			// ACF image array ("ID"), or similar arrays with "id".
			if ( isset( $raw['ID'] ) && is_numeric( $raw['ID'] ) ) {
				$id = (int) $raw['ID'];
			} elseif ( isset( $raw['id'] ) && is_numeric( $raw['id'] ) ) {
				$id = (int) $raw['id'];
			}
		} elseif ( is_numeric( $raw ) ) {
			$id = (int) $raw;
		} elseif ( is_string( $raw ) && preg_match( '#^https?://#i', trim( $raw ) ) ) {
			$id = (int) attachment_url_to_postid( trim( $raw ) );
		}
	}

	if ( $id <= 0 || ! wp_attachment_is_image( $id ) ) {
		$out['error'] = 'not_image';
		return $out;
	}
	$out['id'] = $id;
	return $out;
}

/** As above, but a PHP error (e.g. from another plugin's field type) can't escape. */
function wp_free_charts_image_swap_resolve_safe( $slot, $post_id ) {
	try {
		return wp_free_charts_image_swap_resolve( $slot, $post_id );
	} catch ( Throwable $e ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- report, don't break the page.
		error_log( sprintf( 'WP Free Charts: finding an Image Swap image failed: %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine() ) );
		return array( 'id' => 0, 'error' => 'php_error', 'field_type' => '', 'message' => $e->getMessage() );
	}
}

/** Image size slugs that may be requested ("full" plus registered sizes). */
function wp_free_charts_image_swap_size( $size ) {
	$size = (string) $size;
	return in_array( $size, array_merge( array( 'full' ), get_intermediate_image_sizes() ), true ) ? $size : 'large';
}

/**
 * Block attributes for one slot ('main' or 'hover') as a slot array.
 *
 * @param array  $attributes Block attributes.
 * @param string $which      'main' or 'hover'.
 */
function wp_free_charts_image_swap_slot( $attributes, $which ) {
	$defaults = array( 'main' => 'featured', 'hover' => 'field' );
	return array(
		'source'  => isset( $attributes[ $which . 'Source' ] ) ? (string) $attributes[ $which . 'Source' ] : $defaults[ $which ],
		'field'   => isset( $attributes[ $which . 'Field' ] ) ? (string) $attributes[ $which . 'Field' ] : '',
		'from'    => isset( $attributes['fieldFrom'] ) ? (string) $attributes['fieldFrom'] : 'post',
		'mediaId' => isset( $attributes[ $which . 'Id' ] ) ? (int) $attributes[ $which . 'Id' ] : 0,
	);
}

/**
 * POST /wp-free-charts/v1/image-swap  { lookups: [ { source, field, from, mediaId, post_id, size }, … ] }
 * Editor preview for every Image Swap slot on the screen in one request.
 * Returns { id, url, alt, error, field_type } per lookup. Needs edit_posts;
 * each post must be readable by the user, otherwise that lookup returns 'forbidden'.
 */
function wp_free_charts_image_swap_register_rest() {
	register_rest_route(
		'wp-free-charts/v1',
		'/image-swap',
		array(
			'methods'             => 'POST',
			'callback'            => function ( WP_REST_Request $request ) {
				// Anything other code prints meanwhile (e.g. PHP notices with
				// WP_DEBUG_DISPLAY on) would corrupt the JSON reply: log it instead.
				ob_start();
				$out = array();
				foreach ( (array) $request['lookups'] as $lookup ) {
					$post_id = isset( $lookup['post_id'] ) ? (int) $lookup['post_id'] : 0;
					if ( $post_id && ! current_user_can( 'read_post', $post_id ) ) {
						$out[] = array( 'id' => 0, 'error' => 'forbidden', 'field_type' => '' );
						continue;
					}
					$res = wp_free_charts_image_swap_resolve_safe( $lookup, $post_id );
					if ( $res['id'] ) {
						$src        = wp_get_attachment_image_src( $res['id'], wp_free_charts_image_swap_size( isset( $lookup['size'] ) ? $lookup['size'] : 'large' ) );
						$res['url'] = $src ? $src[0] : '';
						$res['alt'] = (string) get_post_meta( $res['id'], '_wp_attachment_image_alt', true );
					}
					$out[] = $res;
				}
				wp_free_charts_discard_output( ob_get_clean(), 'image-swap' );
				return rest_ensure_response( $out );
			},
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
			'args'                => array(
				'lookups' => array(
					'type'     => 'array',
					'required' => true,
					'maxItems' => 100,
					'items'    => array(
						'type'       => 'object',
						'properties' => array(
							'source'  => array( 'type' => 'string', 'enum' => array( 'featured', 'field', 'media' ) ),
							'field'   => array( 'type' => 'string' ),
							'from'    => array( 'type' => 'string', 'enum' => array( 'post', 'option', 'author' ) ),
							'mediaId' => array( 'type' => 'integer', 'minimum' => 0 ),
							'post_id' => array( 'type' => 'integer', 'minimum' => 0 ),
							'size'    => array( 'type' => 'string' ),
						),
					),
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'wp_free_charts_image_swap_register_rest' );
