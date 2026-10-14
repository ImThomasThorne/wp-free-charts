/**
 * Editor entry point for the WP Free Table block (block.json "editorScript").
 * Settings and assets live in block.json; this wires up edit/save, the
 * transforms, the deprecations and the underline toolbar button.
 */
import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save, { saveV1 } from './save';
import transforms from './transforms';
import metadata from './block.json';
import './formats';
import './style.css';
import './editor.css';

/**
 * Older saved markup that must still validate. WordPress tries `save` first,
 * then each entry here; a match is upgraded to the current markup the next
 * time the post is saved. Newest first. Same attributes, only save differs.
 */
const deprecated = [
	// 2.0.x: header line breaks became spaces in the mobile card labels.
	{ attributes: metadata.attributes, supports: metadata.supports, save: saveV1 },
];

registerBlockType( metadata.name, { edit: Edit, save, transforms, deprecated } );
