<?php
/**
 * Plugin Name:       WP Free Charts
 * Plugin URI:        https://github.com/ImThomasThorne/wp-free-charts
 * Description:       Add interactive, customizable charts (pie, bar, line & more) to your WordPress site with a powerful Gutenberg block featuring spreadsheet data entry, theme colour integration, and front-end filters.
 * Version:           1.0.7
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-free-charts
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WP_FREE_CHARTS_PATH', plugin_dir_path( __FILE__ ) );

// Updates are served from GitHub releases via plugin-update-checker.
require WP_FREE_CHARTS_PATH . 'plugin-update-checker/plugin-update-checker.php';

$wp_free_charts_update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
	'https://github.com/ImThomasThorne/wp-free-charts/',
	__FILE__,
	'wp-free-charts'
);
$wp_free_charts_update_checker->setBranch( 'main' );

function wp_free_charts_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}
	register_block_type( WP_FREE_CHARTS_PATH . 'build' );
}
add_action( 'init', 'wp_free_charts_register_block' );
