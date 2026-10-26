<?php
/**
 * Test-only content for contact-acf.test.mjs, run once by blueprint-acf.json.
 * Creates ACF values (post, options, user), two "Staff member" posts for a
 * Query Loop, and the "ACF contact test" post with field-sourced contact items,
 * including attempts to read protected meta, raw options and raw user meta.
 */
require '/wordpress/wp-load.php';

$item = function ( $attrs ) {
	return '<!-- wp:wp-free-charts/contact-item ' . wp_json_encode( $attrs ) . ' /-->';
};
$row = function ( $items ) {
	return "<!-- wp:wp-free-charts/contact-details -->\n" . implode( "\n", $items ) . "\n<!-- /wp:wp-free-charts/contact-details -->";
};

update_field( 'field_user_phone', '07700 900123', 'user_1' );
update_field( 'field_office_phone', '0800 123 4567', 'option' );
update_user_meta( 1, 'wfc_raw_user_meta', 'raw-user@example.com' );
update_option( 'wfc_raw_option', 'raw-option@example.com' );

foreach ( array( 'Ann' => 'ann@example.com', 'Bob' => 'bob@example.com' ) as $who => $email ) {
	$staff = wp_insert_post( array( 'post_title' => 'Staff member ' . $who, 'post_status' => 'publish', 'post_author' => 1, 'post_content' => 'Staff' ) );
	update_field( 'field_staff_email', $email, $staff );
}

$content = implode(
	"\n\n",
	array(
		$row(
			array(
				$item( array( 'source' => 'field', 'field' => 'staff_email' ) ),
				$item( array( 'type' => 'phone', 'source' => 'field', 'field' => 'staff_phone' ) ),
				$item( array( 'type' => 'phone', 'source' => 'field', 'field' => 'office_phone', 'fieldFrom' => 'option' ) ),
				$item( array( 'type' => 'phone', 'source' => 'field', 'field' => 'user_phone', 'fieldFrom' => 'author', 'label' => 'Call the author' ) ),
				$item( array( 'source' => 'field', 'field' => 'plain_email' ) ),
				$item( array( 'source' => 'field', 'field' => 'contact.email' ) ),
				$item( array( 'type' => 'phone', 'source' => 'field', 'field' => 'contact.phone' ) ),
			)
		),
		// Must all output nothing.
		$row(
			array(
				$item( array( 'source' => 'field', 'field' => '_secret_email' ) ),
				$item( array( 'source' => 'field', 'field' => 'wfc_raw_option', 'fieldFrom' => 'option' ) ),
				$item( array( 'source' => 'field', 'field' => 'admin_email', 'fieldFrom' => 'option' ) ),
				$item( array( 'source' => 'field', 'field' => 'wfc_raw_user_meta', 'fieldFrom' => 'author' ) ),
				$item( array( 'source' => 'field', 'field' => 'missing_field' ) ),
				$item( array( 'source' => 'field', 'field' => '../etc' ) ),
				$item( array( 'source' => 'field', 'field' => 'contact' ) ),
			)
		),
		'<!-- wp:query {"queryId":7,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"asc","orderBy":"title","search":"Staff member","inherit":false}} -->' .
		'<div class="wp-block-query"><!-- wp:post-template --><!-- wp:post-title /-->' .
		$row( array( $item( array( 'source' => 'field', 'field' => 'staff_email' ) ) ) ) .
		'<!-- /wp:post-template --></div><!-- /wp:query -->',
	)
);

$id = wp_insert_post(
	array(
		'post_title'   => 'ACF contact test',
		'post_name'    => 'acf-contact-test',
		'post_status'  => 'publish',
		'post_author'  => 1,
		'post_content' => wp_slash( $content ),
	)
);
update_field( 'field_staff_email', 'me@example.com', $id );
update_field( 'field_staff_phone', '+44 20 7946 0000', $id );
update_field( 'field_contact', array( 'field_contact_email' => 'group@example.com', 'field_contact_phone' => '01111 222333' ), $id );
update_post_meta( $id, 'plain_email', 'plain@example.com' );
update_post_meta( $id, '_secret_email', 'leak@example.com' );
