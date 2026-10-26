<?php
/**
 * Plugin Name:       WP Free Charts
 * Plugin URI:        https://github.com/ImThomasThorne/wp-free-charts
 * Description:       Add interactive, customizable charts (pie, bar, line & more) and flexible tables (merge cells, colour cells/rows/columns, resizable columns, mobile-friendly layouts) to your WordPress site with Gutenberg blocks.
 * Version:           2.5.0
 * Requires at least: 6.6
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

// Contact block: custom-field lookup (front end + editor preview route).
require WP_FREE_CHARTS_PATH . 'includes/contact-fields.php';

// Updates are served from GitHub releases via plugin-update-checker (bundled
// in plugin-update-checker/). Sites see an update when a release is published
// whose tag is higher than the Version header above.
require WP_FREE_CHARTS_PATH . 'plugin-update-checker/plugin-update-checker.php';

$wp_free_charts_update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
	'https://github.com/ImThomasThorne/wp-free-charts/',
	__FILE__,
	'wp-free-charts'
);
$wp_free_charts_update_checker->setBranch( 'main' );

/**
 * Register the blocks from their built block.json files, which wire up the
 * editor scripts, front-end scripts and styles. Run `npm run build` after
 * changing src/.
 *  - build/       WP Free Charts (chart block)
 *  - build/table/ WP Free Table
 *  - build/contact/ Contact Details, and build/contact/item/ its Contact Item children
 */
function wp_free_charts_register_block() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}
	register_block_type( WP_FREE_CHARTS_PATH . 'build' );
	register_block_type( WP_FREE_CHARTS_PATH . 'build/table' );
	register_block_type( WP_FREE_CHARTS_PATH . 'build/contact' );
	register_block_type( WP_FREE_CHARTS_PATH . 'build/contact/item' );
}
add_action( 'init', 'wp_free_charts_register_block' );
