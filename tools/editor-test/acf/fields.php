<?php
/**
 * Test-only ACF fields for contact-acf.test.mjs. Loaded as an mu-plugin by
 * blueprint-acf.json; never shipped (tools/ is excluded from release zips).
 */
add_action(
	'acf/init',
	function () {
		$field = function ( $name, $type = 'text' ) {
			return array( 'key' => 'field_' . $name, 'name' => $name, 'label' => $name, 'type' => $type );
		};
		acf_add_local_field_group(
			array(
				'key'      => 'group_wfc_test_post',
				'title'    => 'WFC test (post)',
				'fields'   => array( $field( 'staff_email', 'email' ), $field( 'staff_phone' ) ),
				'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ) ) ),
			)
		);
		acf_add_local_field_group(
			array(
				'key'      => 'group_wfc_test_user',
				'title'    => 'WFC test (user)',
				'fields'   => array( $field( 'user_phone' ) ),
				'location' => array( array( array( 'param' => 'user_form', 'operator' => '==', 'value' => 'all' ) ) ),
			)
		);
		acf_add_local_field_group(
			array(
				'key'      => 'group_wfc_test_options',
				'title'    => 'WFC test (options)',
				'fields'   => array( $field( 'office_phone' ) ),
				'location' => array( array( array( 'param' => 'options_page', 'operator' => '==', 'value' => 'wfc-contact' ) ) ),
			)
		);
	}
);
