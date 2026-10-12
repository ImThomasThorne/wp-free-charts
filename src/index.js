/**
 * Editor entry point (block.json "editorScript").
 *
 * Registers the wp-free-charts/chart block. Attributes, supports and asset
 * handles all live in block.json; this file just wires up edit/save.
 */
import { registerBlockType } from '@wordpress/blocks';
import Edit     from './edit';
import save     from './save';
import metadata from './block.json';
import './editor.css';

registerBlockType( metadata.name, { edit: Edit, save } );
