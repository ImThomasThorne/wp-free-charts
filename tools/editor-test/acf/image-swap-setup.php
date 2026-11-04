<?php
/**
 * Test-only content for image-swap.test.mjs, run once by blueprint-image-swap.json
 * (with ACF) or blueprint-image-swap-noacf.json (without). Creates coloured test
 * images, three "Swap staff" posts with a professional + fun photo each (one has
 * no fun photo), and the "Image swap test" post with a Query Loop of Image Swap
 * blocks plus single blocks for the other sources and a protected-meta check.
 */
require '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

$has_acf = function_exists( 'update_field' );

// A solid-colour PNG attachment (red/green/blue channel bytes).
$image = function ( $name, $rgb, $w = 400, $h = 500 ) {
	$up   = wp_upload_dir();
	$file = $up['path'] . '/' . $name . '.png';
	$im   = imagecreatetruecolor( $w, $h );
	imagefill( $im, 0, 0, imagecolorallocate( $im, $rgb[0], $rgb[1], $rgb[2] ) );
	imagepng( $im, $file );
	imagedestroy( $im );
	$id = wp_insert_attachment( array( 'post_mime_type' => 'image/png', 'post_title' => $name, 'post_status' => 'inherit' ), $file );
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $file ) );
	update_post_meta( $id, '_wp_attachment_image_alt', $name . ' alt' );
	return $id;
};
// ACF stores a field as meta + a "_name" key reference; without ACF, plain meta.
$set = function ( $name, $value, $post_id ) use ( $has_acf ) {
	if ( $has_acf ) {
		update_field( 'field_' . $name, $value, $post_id );
	} else {
		update_post_meta( $post_id, $name, $value );
	}
};

$block = function ( $attrs ) {
	return '<!-- wp:wp-free-charts/image-swap ' . wp_json_encode( $attrs ) . ' /-->';
};

$people = array(
	'Ann' => array( array( 200, 30, 30 ), array( 30, 200, 30 ) ),
	'Bob' => array( array( 30, 30, 200 ), array( 200, 200, 30 ) ),
	'Cat' => array( array( 120, 30, 120 ), null ), // No fun photo: no swap.
);
foreach ( $people as $who => $colours ) {
	$staff = wp_insert_post( array( 'post_title' => 'Swap staff ' . $who, 'post_status' => 'publish', 'post_author' => 1, 'post_content' => 'Staff' ) );
	$set( 'photo_pro', $image( strtolower( $who ) . '-pro', $colours[0] ), $staff );
	if ( $colours[1] ) {
		$set( 'photo_fun', $image( strtolower( $who ) . '-fun', $colours[1] ), $staff );
	}
}

$featured = $image( 'featured', array( 20, 20, 20 ) );
$picked   = $image( 'picked', array( 250, 140, 0 ) );
$secret   = $image( 'secret', array( 255, 0, 255 ) );

$loop_block = $block( array( 'mainSource' => 'field', 'mainField' => 'photo_pro', 'hoverSource' => 'field', 'hoverField' => 'photo_fun', 'aspectRatio' => '4/5', 'linkToPost' => true, 'revertDelay' => 3 ) );
$content    = implode(
	"\n\n",
	array(
		'<!-- wp:query {"queryId":9,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"asc","orderBy":"title","search":"Swap staff","inherit":false}} -->' .
		'<div class="wp-block-query"><!-- wp:post-template --><!-- wp:post-title /-->' . $loop_block . '<!-- /wp:post-template --></div><!-- /wp:query -->',
		// Featured image -> plain post meta (ID), no link, square, instant.
		$block( array( 'mainSource' => 'featured', 'hoverSource' => 'field', 'hoverField' => 'plain_photo', 'aspectRatio' => '1/1', 'fade' => false, 'width' => '200px' ) ),
		// Picked image -> ACF URL return format (or plain meta URL without ACF).
		$block( array( 'mainSource' => 'media', 'mainId' => $picked, 'hoverSource' => 'field', 'hoverField' => 'photo_url' ) ),
		// Must output nothing: protected meta as the main image.
		$block( array( 'mainSource' => 'field', 'mainField' => '_secret_photo', 'hoverSource' => 'media', 'hoverId' => $picked ) ),
	)
);

$id = wp_insert_post(
	array(
		'post_title'   => 'Image swap test',
		'post_name'    => 'image-swap-test',
		'post_status'  => 'publish',
		'post_author'  => 1,
		'post_content' => wp_slash( $content ),
	)
);
set_post_thumbnail( $id, $featured );
update_post_meta( $id, 'plain_photo', $picked );
update_post_meta( $id, '_secret_photo', $secret );
$urlpic = $image( 'urlpic', array( 0, 160, 160 ) );
$set( 'photo_url', $has_acf ? $urlpic : wp_get_attachment_url( $urlpic ), $id );
