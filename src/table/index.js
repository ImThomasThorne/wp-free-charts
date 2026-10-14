/**
 * Editor entry point for the WP Free Table block (block.json "editorScript").
 * Settings and assets live in block.json; this wires up edit/save and the
 * underline toolbar button.
 */
import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';
import transforms from './transforms';
import metadata from './block.json';
import './formats';
import './style.css';
import './editor.css';

registerBlockType( metadata.name, { edit: Edit, save, transforms } );
