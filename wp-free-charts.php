











<?php
/**
 * Plugin Name:       WP Free Charts
 * Plugin URI:        https://github.com/YOUR-USERNAME/wp-free-charts
 * Description:       Add interactive, customizable charts (pie, bar, line & more) to your WordPress site with a powerful Gutenberg block featuring spreadsheet data entry, theme colour integration, and front-end filters.
 * Version:           1.0.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-free-charts
 * GitHub Plugin URI: https://github.com/YOUR-USERNAME/wp-free-charts
 * Primary Branch:    main
 * Release Asset:     true
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WP_FREE_CHARTS_VERSION', '1.0.0' );
define( 'WP_FREE_CHARTS_PATH', plugin_dir_path( __FILE__ ) );
define( 'WP_FREE_CHARTS_URL', plugin_dir_url( __FILE__ ) );

function wp_free_charts_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}
	register_block_type( WP_FREE_CHARTS_PATH . 'build' );
}
add_action( 'init', 'wp_free_charts_register_block' );
