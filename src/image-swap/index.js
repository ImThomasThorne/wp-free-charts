/**
 * Image Swap block: one image that swaps to another on hover (tap / keyboard
 * focus where there's no hover). Rendered on the server by render.php, so
 * save() is null and changing the markup never breaks block validation.
 */
import { registerBlockType } from '@wordpress/blocks';
import { SVG, Path } from '@wordpress/primitives';
import Edit from './edit';
import metadata from './block.json';
import './style.css';
import './editor.css';

const icon = (
	<SVG xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<Path d="M3 4h11v11H3V4zm1.5 1.5v6.2l2.4-2.4 2.6 2.6 1.3-1.3 1.7 1.7V5.5h-8zM10 20v-3.5h1.5V18.5h8v-8H17V9h4v11H10zm6.3-4.3 1.2-1.2-1.8-1.8h3.3V11h-6v6h1.7v-3.3l1.6 2z" />
	</SVG>
);

registerBlockType( metadata.name, {
	icon,
	edit: Edit,
	save: () => null,
} );
