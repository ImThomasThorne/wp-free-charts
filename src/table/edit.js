/**
 * Editor UI for the table block.
 *
 * Layout in the editor: the real table plus an extra handle row (column
 * letters, with drag grips for resizing) and handle column (row numbers).
 * Handles exist only here; save.js outputs just the table.
 *
 * Selection (local state, origin-cell keys "r-c"):
 *  - click a cell            → select it
 *  - Shift+click             → select the rectangle from the last clicked cell
 *  - Ctrl/Cmd+click          → add/remove a cell
 *  - click a letter / number → select the column / row (Shift/Ctrl work too)
 * Toolbar and sidebar actions apply to the selection. All grid changes go
 * through the pure helpers in tableUtils.js.
 *
 * Keyboard & clipboard (native capture listeners on <table>, see useEffect):
 *  - arrow keys move to the neighbouring cell when the caret is at the edge
 *    of the text (start/end, first/last line); focus moves via the editor's
 *    selectionChange() using each RichText's identifier "cell-r-c"
 *  - pasting tab-separated data (Excel/Sheets) fills cells from the caret's
 *    cell, growing the table; anything else pastes normally into one cell
 */
import { useState, useEffect, useRef } from '@wordpress/element';
import {
	BlockControls,
	InspectorControls,
	PanelColorSettings,
	RichText,
	useBlockProps,
	useSettings,
} from '@wordpress/block-editor';
import * as blockEditor from '@wordpress/block-editor';
import {
	Button,
	FontSizePicker,
	PanelBody,
	Placeholder,
	SelectControl,
	TextControl,
	ToggleControl,
	ToolbarButton,
	ToolbarDropdownMenu,
	ToolbarGroup,
	__experimentalBoxControl as BoxControl,
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { create } from '@wordpress/rich-text';

import {
	key, parseKey, dims, createGrid, insertRow, deleteRow, insertColumn, deleteColumn,
	mergeCells, splitCell, expandRect, originsInRect, boundsOfKeys, updateCells,
	clearFormatting, getHeaderRowCount, insertColumnWidth, deleteColumnWidth, normalizeWidths, spanOf,
	neighbourCell, parseClipboardGrid, pasteGrid,
} from './tableUtils';
import { cellStyle, tableStyle, tableClassName } from './styles';
import { UNDERLINE_FORMAT } from './formats';

/** Formatting allowed inside cells (bold/italic/underline/links/colour etc). */
const CELL_FORMATS = [
	'core/bold', 'core/italic', 'core/underline', UNDERLINE_FORMAT, 'core/strikethrough',
	'core/link', 'core/text-color', 'core/subscript', 'core/superscript', 'core/code',
];

const BORDER_UNITS = [
	{ value: 'px', label: 'px', default: 1 },
	{ value: 'em', label: 'em', default: 0.1 },
];

const MIN_WIDTH_UNITS = [
	{ value: 'px', label: 'px', default: 600 },
	{ value: 'em', label: 'em', default: 40 },
	{ value: 'rem', label: 'rem', default: 40 },
];

/** A, B, … Z, AA, AB … */
function colLetter( n ) {
	let s = '';
	for ( n += 1; n > 0; n = Math.floor( ( n - 1 ) / 26 ) ) {
		s = String.fromCharCode( 65 + ( ( n - 1 ) % 26 ) ) + s;
	}
	return s;
}

/** Slug of a theme/default/custom palette colour, so it can be stored as a CSS variable. */
function findColorSlug( palette, value ) {
	if ( ! value ) return undefined;
	return palette.find( ( p ) => p.color?.toLowerCase() === value.toLowerCase() )?.slug;
}

/*
 * WordPress's own typography and spacing controls (the ones core blocks use,
 * fed by the theme's fonts, weights and spacing scale). They're marked
 * experimental, so each is looked up at runtime and simply not shown if a
 * WordPress version doesn't have it.
 */
const FontAppearanceControl = blockEditor.__experimentalFontAppearanceControl;
const LineHeightControl     = blockEditor.LineHeightControl;
const LetterSpacingControl  = blockEditor.__experimentalLetterSpacingControl;
const TextTransformControl  = blockEditor.__experimentalTextTransformControl;
const TextDecorationControl = blockEditor.__experimentalTextDecorationControl;
const SpacingSizesControl   = blockEditor.__experimentalSpacingSizesControl;

const ARROW_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * Is the caret at the edge of the cell in this direction? Left/right: at the
 * very start/end of the text. Up/down: on the first/last line. Only then do
 * arrow keys jump to the next cell, so they still move within the text.
 */
function caretAtEdge( el, dir ) {
	const doc = el.ownerDocument;
	const sel = doc.defaultView.getSelection();
	if ( ! sel.rangeCount || ! sel.isCollapsed ) return false;
	const caret = sel.getRangeAt( 0 );
	const all   = doc.createRange();
	all.selectNodeContents( el );

	if ( dir === 'left' || dir === 'right' ) {
		const probe = all.cloneRange();
		if ( dir === 'left' ) probe.setEnd( caret.startContainer, caret.startOffset );
		else probe.setStart( caret.endContainer, caret.endOffset );
		return probe.toString().length === 0;
	}

	const text = all.getBoundingClientRect();
	const rect = caretRect( el, caret );
	if ( ! text.height || ! rect ) return true; // empty cell
	const lineHeight = parseFloat( doc.defaultView.getComputedStyle( el ).lineHeight ) || rect.height || 16;
	return dir === 'up'
		? rect.top - text.top < lineHeight / 2
		: text.bottom - rect.bottom < lineHeight / 2;
}

/**
 * Screen position of the caret. A collapsed range at the start of a line often
 * has no rectangle in Chrome, so measure the character next to it instead.
 */
function caretRect( el, caret ) {
	const direct = caret.getClientRects()[ 0 ];
	if ( direct?.height ) return direct;
	const doc    = el.ownerDocument;
	const walker = doc.createTreeWalker( el, 4 /* NodeFilter.SHOW_TEXT */ );
	let before = null;
	for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
		if ( ! node.length ) continue;
		// Which side of the caret is this text node on?
		const atEnd   = caret.comparePoint( node, node.length ); // 1 = after caret
		const atStart = caret.comparePoint( node, 0 );
		const probe   = doc.createRange();
		if ( atEnd >= 0 && atStart <= 0 ) {
			// Caret is in (or right at an edge of) this node: measure the next
			// char, or the previous one when the caret is at the node's end.
			let offset = node.length;
			if ( node === caret.startContainer ) offset = caret.startOffset;
			else if ( atStart === 0 ) offset = 0;
			if ( offset < node.length ) {
				probe.setStart( node, offset );
				probe.setEnd( node, offset + 1 );
			} else {
				probe.setStart( node, offset - 1 );
				probe.setEnd( node, offset );
			}
			return probe.getBoundingClientRect();
		}
		if ( atStart > 0 ) {
			// First text after the caret.
			probe.setStart( node, 0 );
			probe.setEnd( node, 1 );
			return probe.getBoundingClientRect();
		}
		before = node;
	}
	if ( before ) {
		const probe = doc.createRange();
		probe.setStart( before, before.length - 1 );
		probe.setEnd( before, before.length );
		return probe.getBoundingClientRect();
	}
	return null;
}

/** Number of characters RichText counts in a cell (line breaks count as one). */
function textLength( html ) {
	return create( { html: html || '' } ).text.length;
}

/** First screen: choose the table size. */
function TableSetup( { onCreate } ) {
	const [ rows, setRows ] = useState( 4 );
	const [ cols, setCols ] = useState( 3 );
	return (
		<Placeholder
			icon="editor-table"
			label={ __( 'WP Free Table', 'wp-free-charts' ) }
			instructions={ __( 'Choose a size to start. You can add or remove rows and columns at any time.', 'wp-free-charts' ) }
		>
			<form
				className="wfc-table-setup"
				onSubmit={ ( e ) => {
					e.preventDefault();
					onCreate( Math.max( 1, rows ), Math.max( 1, cols ) );
				} }
			>
				<TextControl
					type="number" min={ 1 } max={ 50 }
					label={ __( 'Columns', 'wp-free-charts' ) }
					value={ cols }
					onChange={ ( v ) => setCols( parseInt( v, 10 ) || 1 ) }
				/>
				<TextControl
					type="number" min={ 1 } max={ 200 }
					label={ __( 'Rows', 'wp-free-charts' ) }
					value={ rows }
					onChange={ ( v ) => setRows( parseInt( v, 10 ) || 1 ) }
				/>
				<Button variant="primary" type="submit">{ __( 'Create table', 'wp-free-charts' ) }</Button>
			</form>
		</Placeholder>
	);
}

export default function Edit( { attributes, setAttributes, isSelected, clientId } ) {
	const {
		cells, colWidths, hasHeaderRow, hasHeaderColumn, striped,
		headerBg, headerColor, stripeBg, borderColor, borderWidth, borderStyle,
		cellPadding, mobileLayout, minWidth, hasCaption, caption,
	} = attributes;

	const [ selection, setSelection ]   = useState( [] );
	const [ dragWidths, setDragWidths ] = useState( null );
	const anchorRef = useRef( null );
	const tableRef  = useRef( null );

	const [
		themePalette, defaultPalette, customPalette, fontSizes,
		themeFonts, defaultFonts, customFonts,
	] = useSettings(
		'color.palette.theme', 'color.palette.default', 'color.palette.custom', 'typography.fontSizes',
		'typography.fontFamilies.theme', 'typography.fontFamilies.default', 'typography.fontFamilies.custom'
	);
	const palette      = [ ...( themePalette || [] ), ...( defaultPalette || [] ), ...( customPalette || [] ) ];
	const fontFamilies = [ ...( themeFonts || [] ), ...( defaultFonts || [] ), ...( customFonts || [] ) ];

	// Moving the caret between cells goes through the editor's selection state
	// (each cell's RichText has identifier "cell-r-c"), so RichText places the caret
	// itself instead of overriding a caret we set by hand.
	const { selectionChange } = useDispatch( 'core/block-editor' );

	// Latest values for the native event listeners below (they're attached once).
	const latest = useRef( {} );
	latest.current = { cells, colWidths, setAttributes, setSelection, selectionChange, clientId };

	// Arrow-key navigation between cells and multi-cell paste from spreadsheets.
	// Native capture-phase listeners on the table run before the editor's own
	// handling (which would otherwise jump to the next block / paste into one cell).
	const hasTable = cells?.length > 0;
	useEffect( () => {
		const table = tableRef.current;
		if ( ! table ) return;
		const cellOf = ( target ) => {
			const node = target?.nodeType === 3 ? target.parentElement : target;
			const el   = node?.closest?.( '[data-cell]' );
			return el && table.contains( el ) ? el : null;
		};

		const onKeyDown = ( e ) => {
			const dir = ARROW_KEYS[ e.key ];
			if ( ! dir || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey ) return;
			const el = cellOf( e.target );
			if ( ! el || ! caretAtEdge( el, dir ) ) return;
			const target = neighbourCell( latest.current.cells, ...parseKey( el.dataset.cell ), dir );
			if ( ! target ) return; // table edge: let the editor move to the next block
			e.preventDefault();
			e.stopPropagation();
			// Like a spreadsheet: left/up land at the end of the cell, right/down at the start.
			const { cells: current, selectionChange: select, clientId: id } = latest.current;
			const offset = dir === 'left' || dir === 'up' ? textLength( current[ target[ 0 ] ][ target[ 1 ] ].content ) : 0;
			select( id, `cell-${ key( ...target ) }`, offset, offset );
		};

		const onPaste = ( e ) => {
			const el = cellOf( e.target );
			if ( ! el ) return;
			const text = e.clipboardData?.getData( 'text/plain' ) ?? '';
			const html = e.clipboardData?.getData( 'text/html' ) ?? '';
			// Spreadsheets put tabs between cells and an HTML <table> on the clipboard.
			if ( ! text.includes( '\t' ) && ! /<table/i.test( html ) ) return;
			const grid = parseClipboardGrid( text );
			if ( ! grid || ( grid.length === 1 && grid[ 0 ].length === 1 ) ) return;
			e.preventDefault();
			e.stopPropagation();

			const { cells: current, colWidths: widths } = latest.current;
			const [ r, c ]   = parseKey( el.dataset.cell );
			const { cells: next, addedCols } = pasteGrid( current, r, c, grid );
			let nextWidths   = widths;
			for ( let i = 0; i < addedCols; i++ ) {
				const at = dims( current ).cols + i;
				nextWidths = insertColumnWidth( nextWidths, at, at - 1 );
			}
			latest.current.setAttributes( { cells: next, colWidths: nextWidths } );
			const width = Math.max( ...grid.map( ( row ) => row.length ) );
			latest.current.setSelection( originsInRect( next, { r1: r, c1: c, r2: r + grid.length - 1, c2: c + width - 1 } ) );
		};

		table.addEventListener( 'keydown', onKeyDown, true );
		table.addEventListener( 'paste', onPaste, true );
		return () => {
			table.removeEventListener( 'keydown', onKeyDown, true );
			table.removeEventListener( 'paste', onPaste, true );
		};
	}, [ hasTable ] );

	const blockProps = useBlockProps( {
		className: `is-mobile-${ mobileLayout || 'scroll' } wfc-table--editor`,
	} );

	// Forget the cell selection when the block is deselected.
	useEffect( () => {
		if ( ! isSelected ) setSelection( [] );
	}, [ isSelected ] );

	if ( ! cells?.length ) {
		return (
			<div { ...blockProps }>
				<TableSetup onCreate={ ( r, c ) => setAttributes( { cells: createGrid( r, c ) } ) } />
			</div>
		);
	}

	const { rows, cols } = dims( cells );
	const headerRows     = hasHeaderRow ? getHeaderRowCount( cells ) : 0;

	// Ignore stale keys (e.g. after undo) that no longer point at a visible cell.
	const selected    = selection.filter( ( k ) => {
		const [ r, c ] = parseKey( k );
		return cells[ r ]?.[ c ] && ! cells[ r ][ c ].hidden;
	} );
	const selectedSet = new Set( selected );
	const bounds      = boundsOfKeys( cells, selected );
	const primary     = selected.length ? cells[ parseKey( selected[ 0 ] )[ 0 ] ][ parseKey( selected[ 0 ] )[ 1 ] ] : null;

	// ── Selection ────────────────────────────────────────────────────────────

	const selectRect = ( rect, additive ) => {
		const keys = originsInRect( cells, expandRect( cells, rect ) );
		setSelection( additive ? [ ...new Set( [ ...selected, ...keys ] ) ] : keys );
	};

	const onCellMouseDown = ( e, r, c ) => {
		const k = key( r, c );
		if ( e.shiftKey && anchorRef.current ) {
			// preventDefault stops the browser extending a text selection across cells.
			e.preventDefault();
			const [ ar, ac ] = anchorRef.current;
			selectRect( { r1: ar, c1: ac, r2: r, c2: c } );
			return;
		}
		if ( e.ctrlKey || e.metaKey ) {
			e.preventDefault();
			anchorRef.current = [ r, c ];
			setSelection( selectedSet.has( k ) ? selected.filter( ( x ) => x !== k ) : [ ...selected, k ] );
			return;
		}
		anchorRef.current = [ r, c ];
		setSelection( [ k ] );
	};

	// Keyboard focus (e.g. Tab) selects the focused cell.
	const onCellFocus = ( r, c ) => {
		if ( ! selectedSet.has( key( r, c ) ) ) {
			anchorRef.current = [ r, c ];
			setSelection( [ key( r, c ) ] );
		}
	};

	const onColumnHandle = ( e, c ) => {
		e.preventDefault();
		const additive = e.ctrlKey || e.metaKey;
		const from     = e.shiftKey && anchorRef.current ? anchorRef.current[ 1 ] : c;
		if ( ! e.shiftKey ) anchorRef.current = [ 0, c ];
		selectRect( { r1: 0, c1: from, r2: rows - 1, c2: c }, additive );
	};

	const onRowHandle = ( e, r ) => {
		e.preventDefault();
		const additive = e.ctrlKey || e.metaKey;
		const from     = e.shiftKey && anchorRef.current ? anchorRef.current[ 0 ] : r;
		if ( ! e.shiftKey ) anchorRef.current = [ r, 0 ];
		selectRect( { r1: from, c1: 0, r2: r, c2: cols - 1 }, additive );
	};

	const selectAll = ( e ) => {
		e.preventDefault();
		anchorRef.current = [ 0, 0 ];
		selectRect( { r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 } );
	};

	// ── Structure: rows, columns, merge ──────────────────────────────────────

	const insertRows = ( where ) => {
		const index = ! bounds ? rows : ( where === 'before' ? bounds.r1 : bounds.r2 + 1 );
		const ref   = ! bounds ? rows - 1 : ( where === 'before' ? bounds.r1 : bounds.r2 );
		setAttributes( { cells: insertRow( cells, index, ref ) } );
		setSelection( [] );
	};

	const insertColumns = ( where ) => {
		const index = ! bounds ? cols : ( where === 'before' ? bounds.c1 : bounds.c2 + 1 );
		const ref   = ! bounds ? cols - 1 : ( where === 'before' ? bounds.c1 : bounds.c2 );
		setAttributes( {
			cells:     insertColumn( cells, index, ref ),
			colWidths: insertColumnWidth( colWidths, index, ref ),
		} );
		setSelection( [] );
	};

	const canDeleteRows = !! bounds && bounds.r2 - bounds.r1 + 1 < rows;
	const canDeleteCols = !! bounds && bounds.c2 - bounds.c1 + 1 < cols;

	const deleteRows = () => {
		let next = cells;
		for ( let r = bounds.r2; r >= bounds.r1; r-- ) next = deleteRow( next, r );
		setAttributes( { cells: next } );
		setSelection( [] );
	};

	const deleteColumns = () => {
		let next   = cells;
		let widths = colWidths;
		for ( let c = bounds.c2; c >= bounds.c1; c-- ) {
			next   = deleteColumn( next, c );
			widths = deleteColumnWidth( widths, c );
		}
		setAttributes( { cells: next, colWidths: widths } );
		setSelection( [] );
	};

	// Only merge when the selection exactly fills a rectangle (like Word).
	const canMerge = selected.length > 1 && !! bounds &&
		originsInRect( cells, expandRect( cells, bounds ) ).every( ( k ) => selectedSet.has( k ) );
	const canSplit = selected.some( ( k ) => {
		const { rs, cs } = spanOf( cells[ parseKey( k )[ 0 ] ][ parseKey( k )[ 1 ] ] );
		return rs > 1 || cs > 1;
	} );

	const merge = () => {
		const rect = expandRect( cells, bounds );
		setAttributes( { cells: mergeCells( cells, rect ) } );
		setSelection( [ key( rect.r1, rect.c1 ) ] );
	};

	const split = () => {
		let next = cells;
		for ( const k of selected ) next = splitCell( next, ...parseKey( k ) );
		setAttributes( { cells: next } );
	};

	// ── Cell formatting ──────────────────────────────────────────────────────

	const applyToSelection = ( patch ) => setAttributes( { cells: updateCells( cells, selected, patch ) } );

	const setCellColor = ( prop ) => ( value ) =>
		applyToSelection( { [ prop ]: value, [ `${ prop }Slug` ]: findColorSlug( palette, value ) } );

	const setTableColor = ( prop ) => ( value ) =>
		setAttributes( { [ prop ]: value || '', [ `${ prop }Slug` ]: findColorSlug( palette, value ) || '' } );

	const setCellFontSize = ( value ) => {
		const preset = ( fontSizes || [] ).find( ( f ) => f.size === value );
		applyToSelection( { fontSize: value, fontSizeSlug: preset?.slug } );
	};

	// ── Column resizing (drag the grip between two column letters) ───────────

	const onResizeStart = ( e, c ) => {
		e.preventDefault();
		e.stopPropagation();
		const doc     = e.currentTarget.ownerDocument; // the editor canvas is an iframe
		const handles = [ ...tableRef.current.querySelectorAll( '.wfc-col-handle' ) ];
		const px      = handles.map( ( h ) => h.getBoundingClientRect().width );
		const total   = px.reduce( ( a, b ) => a + b, 0 ) || 1;
		const start   = colWidths.length === cols ? [ ...colWidths ] : normalizeWidths( px );
		const startX  = e.clientX;
		const pair    = start[ c ] + start[ c + 1 ];
		// Don't let a column get narrower than ~48px (or 3%), or words start breaking mid-word.
		const minPct  = Math.min( Math.max( ( 48 / total ) * 100, 3 ), pair / 2 );
		let current   = null;

		const onMove = ( ev ) => {
			const delta = ( ( ev.clientX - startX ) / total ) * 100;
			const left  = Math.min( Math.max( start[ c ] + delta, minPct ), pair - minPct );
			current = [ ...start ];
			current[ c ]     = Math.round( left * 100 ) / 100;
			current[ c + 1 ] = Math.round( ( pair - left ) * 100 ) / 100;
			setDragWidths( current );
		};
		const onUp = () => {
			doc.removeEventListener( 'mousemove', onMove );
			doc.removeEventListener( 'mouseup', onUp );
			setDragWidths( null );
			if ( current ) setAttributes( { colWidths: current } );
		};
		doc.addEventListener( 'mousemove', onMove );
		doc.addEventListener( 'mouseup', onUp );
	};

	const widths = dragWidths || colWidths;

	// ── Rendering ────────────────────────────────────────────────────────────

	const renderCell = ( cell, r, c ) => {
		if ( cell.hidden ) return null;
		const inHead      = r < headerRows;
		const isRowHeader = ! inHead && hasHeaderColumn && c === 0;
		const k           = key( r, c );
		return (
			<RichText
				key={ c }
				tagName={ inHead || isRowHeader ? 'th' : 'td' }
				className={ selectedSet.has( k ) ? 'is-cell-selected' : undefined }
				value={ cell.content }
				onChange={ ( content ) => setAttributes( { cells: updateCells( cells, [ k ], { content } ) } ) }
				allowedFormats={ CELL_FORMATS }
				colSpan={ cell.colspan > 1 ? cell.colspan : undefined }
				rowSpan={ cell.rowspan > 1 ? cell.rowspan : undefined }
				style={ cellStyle( cell ) }
				onMouseDown={ ( e ) => onCellMouseDown( e, r, c ) }
				onFocus={ () => onCellFocus( r, c ) }
				identifier={ `cell-${ k }` }
				data-cell={ k }
				aria-label={ sprintf( __( 'Cell %s', 'wp-free-charts' ), `${ colLetter( c ) }${ r + 1 }` ) }
			/>
		);
	};

	const renderRow = ( row, r ) => (
		<tr key={ r }>
			<td className="wfc-handle wfc-row-handle" contentEditable={ false }>
				<button type="button" tabIndex={ -1 } onMouseDown={ ( e ) => onRowHandle( e, r ) }
					aria-label={ sprintf( __( 'Select row %d', 'wp-free-charts' ), r + 1 ) }>
					{ r + 1 }
				</button>
			</td>
			{ row.map( ( cell, c ) => renderCell( cell, r, c ) ) }
		</tr>
	);

	const handleRow = (
		<tr className="wfc-col-handles">
			<td className="wfc-handle wfc-corner-handle" contentEditable={ false }>
				<button type="button" tabIndex={ -1 } onMouseDown={ selectAll } aria-label={ __( 'Select all cells', 'wp-free-charts' ) } />
			</td>
			{ Array.from( { length: cols }, ( _, c ) => (
				<td key={ c } className="wfc-handle wfc-col-handle" contentEditable={ false }>
					<button type="button" tabIndex={ -1 } onMouseDown={ ( e ) => onColumnHandle( e, c ) }
						aria-label={ sprintf( __( 'Select column %s', 'wp-free-charts' ), colLetter( c ) ) }>
						{ colLetter( c ) }
					</button>
					{ c < cols - 1 && (
						<span
							className="wfc-col-resizer"
							onMouseDown={ ( e ) => onResizeStart( e, c ) }
							title={ __( 'Drag to resize columns', 'wp-free-charts' ) }
						/>
					) }
				</td>
			) ) }
		</tr>
	);

	const selectionCount = selected.length;

	return (
		<>
			<BlockControls group="other">
				<ToolbarGroup>
					<ToolbarDropdownMenu
						icon="editor-table"
						label={ __( 'Rows & columns', 'wp-free-charts' ) }
						controls={ [
							{ icon: 'table-row-before', title: __( 'Insert row above', 'wp-free-charts' ),   onClick: () => insertRows( 'before' ) },
							{ icon: 'table-row-after',  title: __( 'Insert row below', 'wp-free-charts' ),   onClick: () => insertRows( 'after' ) },
							{ icon: 'table-col-before', title: __( 'Insert column left', 'wp-free-charts' ), onClick: () => insertColumns( 'before' ) },
							{ icon: 'table-col-after',  title: __( 'Insert column right', 'wp-free-charts' ), onClick: () => insertColumns( 'after' ) },
							{ icon: 'table-row-delete', title: __( 'Delete row', 'wp-free-charts' ),    onClick: deleteRows,    isDisabled: ! canDeleteRows },
							{ icon: 'table-col-delete', title: __( 'Delete column', 'wp-free-charts' ), onClick: deleteColumns, isDisabled: ! canDeleteCols },
						] }
					/>
					<ToolbarButton onClick={ merge } disabled={ ! canMerge }>{ __( 'Merge', 'wp-free-charts' ) }</ToolbarButton>
					<ToolbarButton onClick={ split } disabled={ ! canSplit }>{ __( 'Split', 'wp-free-charts' ) }</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={ __( 'Selected cells', 'wp-free-charts' ) }>
					{ ! selectionCount ? (
						<p className="wfc-hint">
							{ __( 'Click a cell to select it. Shift+click selects a range, Ctrl+click (Cmd on Mac) adds cells. Click a column letter or row number to select the whole column or row.', 'wp-free-charts' ) }
						</p>
					) : (
						<>
							<p className="wfc-hint">
								{ sprintf( _n( '%d cell selected.', '%d cells selected.', selectionCount, 'wp-free-charts' ), selectionCount ) }
							</p>
							<SelectControl
								label={ __( 'Horizontal alignment', 'wp-free-charts' ) }
								value={ primary?.align || '' }
								options={ [
									{ label: __( 'Default', 'wp-free-charts' ), value: '' },
									{ label: __( 'Left', 'wp-free-charts' ),    value: 'left' },
									{ label: __( 'Centre', 'wp-free-charts' ),  value: 'center' },
									{ label: __( 'Right', 'wp-free-charts' ),   value: 'right' },
								] }
								onChange={ ( v ) => applyToSelection( { align: v } ) }
							/>
							<SelectControl
								label={ __( 'Vertical alignment', 'wp-free-charts' ) }
								value={ primary?.valign || '' }
								options={ [
									{ label: __( 'Default (top)', 'wp-free-charts' ), value: '' },
									{ label: __( 'Middle', 'wp-free-charts' ),        value: 'middle' },
									{ label: __( 'Bottom', 'wp-free-charts' ),        value: 'bottom' },
								] }
								onChange={ ( v ) => applyToSelection( { valign: v } ) }
							/>
							<div className="wfc-button-row">
								<Button variant="secondary" size="small" onClick={ merge } disabled={ ! canMerge }>{ __( 'Merge cells', 'wp-free-charts' ) }</Button>
								<Button variant="secondary" size="small" onClick={ split } disabled={ ! canSplit }>{ __( 'Split cell', 'wp-free-charts' ) }</Button>
								<Button variant="tertiary" size="small" onClick={ () => setAttributes( { cells: clearFormatting( cells, selected ) } ) }>
									{ __( 'Clear formatting', 'wp-free-charts' ) }
								</Button>
							</div>
						</>
					) }
				</PanelBody>

				{ selectionCount > 0 && (
					<PanelBody title={ __( 'Selected cell text', 'wp-free-charts' ) }>
						{ fontFamilies.length > 0 && (
							<SelectControl
								label={ __( 'Font', 'wp-free-charts' ) }
								value={ primary?.fontFamilySlug || '' }
								options={ [
									{ label: __( 'Default', 'wp-free-charts' ), value: '' },
									...fontFamilies.map( ( f ) => ( { label: f.name || f.slug, value: f.slug } ) ),
								] }
								onChange={ ( slug ) => {
									const font = fontFamilies.find( ( f ) => f.slug === slug );
									applyToSelection( { fontFamily: font?.fontFamily, fontFamilySlug: font?.slug } );
								} }
							/>
						) }
						<FontSizePicker
							fontSizes={ fontSizes }
							value={ primary?.fontSize }
							onChange={ setCellFontSize }
							withReset
						/>
						{ FontAppearanceControl ? (
							<FontAppearanceControl
								value={ {
									fontWeight: primary?.fontWeight || ( primary?.bold ? '700' : undefined ),
									fontStyle:  primary?.fontStyle,
								} }
								// Only offer the weights/styles the chosen theme font actually has.
								fontFamilyFaces={ fontFamilies.find( ( f ) => f.slug === primary?.fontFamilySlug )?.fontFace }
								onChange={ ( { fontWeight, fontStyle } ) =>
									applyToSelection( { fontWeight, fontStyle, bold: undefined } ) }
								hasFontStyles
								hasFontWeights
								__nextHasNoMarginBottom
							/>
						) : (
							<ToggleControl
								label={ __( 'Bold', 'wp-free-charts' ) }
								checked={ !! primary?.bold }
								onChange={ ( v ) => applyToSelection( { bold: v } ) }
							/>
						) }
						{ LineHeightControl && (
							<LineHeightControl
								value={ primary?.lineHeight }
								onChange={ ( v ) => applyToSelection( { lineHeight: v } ) }
								__nextHasNoMarginBottom
								__unstableInputWidth="100%"
							/>
						) }
						{ LetterSpacingControl && (
							<LetterSpacingControl
								value={ primary?.letterSpacing }
								onChange={ ( v ) => applyToSelection( { letterSpacing: v } ) }
								__unstableInputWidth="100%"
							/>
						) }
						{ TextTransformControl && (
							<TextTransformControl
								value={ primary?.textTransform }
								onChange={ ( v ) => applyToSelection( { textTransform: v === primary?.textTransform ? undefined : v } ) }
							/>
						) }
						{ TextDecorationControl && (
							<TextDecorationControl
								value={ primary?.textDecoration }
								onChange={ ( v ) => applyToSelection( { textDecoration: v === primary?.textDecoration ? undefined : v } ) }
							/>
						) }
					</PanelBody>
				) }

				{ selectionCount > 0 && (
					<PanelColorSettings
						title={ __( 'Selected cell colours', 'wp-free-charts' ) }
						colorSettings={ [
							{ label: __( 'Background', 'wp-free-charts' ), value: primary?.bg,    onChange: setCellColor( 'bg' ) },
							{ label: __( 'Text', 'wp-free-charts' ),       value: primary?.color, onChange: setCellColor( 'color' ) },
						] }
					/>
				) }

				<PanelBody title={ __( 'Table', 'wp-free-charts' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Header row', 'wp-free-charts' ) }
						help={ __( 'Styles the first row as column headings.', 'wp-free-charts' ) }
						checked={ hasHeaderRow }
						onChange={ ( v ) => setAttributes( { hasHeaderRow: v } ) }
					/>
					<ToggleControl
						label={ __( 'First column as row headings', 'wp-free-charts' ) }
						checked={ hasHeaderColumn }
						onChange={ ( v ) => setAttributes( { hasHeaderColumn: v } ) }
					/>
					<ToggleControl
						label={ __( 'Striped rows', 'wp-free-charts' ) }
						checked={ striped }
						onChange={ ( v ) => setAttributes( { striped: v } ) }
					/>
					<ToggleControl
						label={ __( 'Caption', 'wp-free-charts' ) }
						checked={ hasCaption }
						onChange={ ( v ) => setAttributes( { hasCaption: v } ) }
					/>
				</PanelBody>

				<PanelColorSettings
					title={ __( 'Header, stripe & border colours', 'wp-free-charts' ) }
					initialOpen={ false }
					colorSettings={ [
						{ label: __( 'Header background', 'wp-free-charts' ), value: headerBg,    onChange: setTableColor( 'headerBg' ) },
						{ label: __( 'Header text', 'wp-free-charts' ),       value: headerColor, onChange: setTableColor( 'headerColor' ) },
						{ label: __( 'Stripe background', 'wp-free-charts' ), value: stripeBg,    onChange: setTableColor( 'stripeBg' ) },
						{ label: __( 'Border', 'wp-free-charts' ),            value: borderColor, onChange: setTableColor( 'borderColor' ) },
					] }
				/>

				<PanelBody title={ __( 'Borders & spacing', 'wp-free-charts' ) } initialOpen={ false }>
					<UnitControl
						label={ __( 'Border width', 'wp-free-charts' ) }
						value={ borderWidth }
						min={ 0 }
						units={ BORDER_UNITS }
						onChange={ ( v ) => setAttributes( { borderWidth: v || '0px' } ) }
					/>
					<SelectControl
						label={ __( 'Border style', 'wp-free-charts' ) }
						value={ borderStyle }
						options={ [
							{ label: __( 'Solid', 'wp-free-charts' ),  value: 'solid' },
							{ label: __( 'Dashed', 'wp-free-charts' ), value: 'dashed' },
							{ label: __( 'Dotted', 'wp-free-charts' ), value: 'dotted' },
							{ label: __( 'None', 'wp-free-charts' ),   value: 'none' },
						] }
						onChange={ ( v ) => setAttributes( { borderStyle: v } ) }
					/>
					{ /* Uses the theme's spacing scale (same presets as core blocks' padding) where available. */ }
					{ SpacingSizesControl ? (
						<SpacingSizesControl
							label={ __( 'Cell padding', 'wp-free-charts' ) }
							values={ cellPadding }
							onChange={ ( v ) => setAttributes( { cellPadding: v || {} } ) }
							sides={ [ 'top', 'right', 'bottom', 'left' ] }
							splitOnAxis
							allowReset
							minimumCustomValue={ 0 }
						/>
					) : (
						<BoxControl
							label={ __( 'Cell padding', 'wp-free-charts' ) }
							values={ cellPadding }
							onChange={ ( v ) => setAttributes( { cellPadding: v || {} } ) }
						/>
					) }
					{ colWidths.length > 0 && (
						<Button variant="secondary" size="small" onClick={ () => setAttributes( { colWidths: [] } ) }>
							{ __( 'Reset column widths', 'wp-free-charts' ) }
						</Button>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Responsive', 'wp-free-charts' ) } initialOpen={ false }>
					<SelectControl
						label={ __( 'On narrow screens', 'wp-free-charts' ) }
						value={ mobileLayout }
						options={ [
							{ label: __( 'Scroll sideways', 'wp-free-charts' ),     value: 'scroll' },
							{ label: __( 'Stack rows as cards', 'wp-free-charts' ), value: 'stack' },
						] }
						help={ mobileLayout === 'stack'
							? __( 'When the table has less than 600px of space, each row becomes a card and every cell is labelled with its column heading (needs a header row). The editor always shows the normal grid.', 'wp-free-charts' )
							: __( 'The table fits its container. Set a minimum width below to stop columns getting too narrow; the table then scrolls sideways instead.', 'wp-free-charts' ) }
						onChange={ ( v ) => setAttributes( { mobileLayout: v } ) }
					/>
					{ mobileLayout !== 'stack' && (
						<UnitControl
							label={ __( 'Minimum table width', 'wp-free-charts' ) }
							value={ minWidth }
							units={ MIN_WIDTH_UNITS }
							min={ 0 }
							onChange={ ( v ) => setAttributes( { minWidth: v || '' } ) }
						/>
					) }
				</PanelBody>
			</InspectorControls>

			<figure { ...blockProps }>
				<div className="wfc-table__scroll">
					<table ref={ tableRef } className={ tableClassName( { striped, colWidths: widths } ) } style={ tableStyle( attributes ) }>
						<colgroup>
							<col className="wfc-handle-col" />
							{ Array.from( { length: cols }, ( _, c ) => (
								<col key={ c } style={ widths.length ? { width: `${ widths[ c ] }%` } : undefined } />
							) ) }
						</colgroup>
						<thead>
							{ handleRow }
							{ cells.slice( 0, headerRows ).map( ( row, r ) => renderRow( row, r ) ) }
						</thead>
						<tbody>
							{ cells.slice( headerRows ).map( ( row, i ) => renderRow( row, i + headerRows ) ) }
						</tbody>
					</table>
				</div>
				{ hasCaption && (
					<RichText
						tagName="figcaption"
						className="wfc-table__caption"
						value={ caption }
						onChange={ ( v ) => setAttributes( { caption: v } ) }
						placeholder={ __( 'Add a caption', 'wp-free-charts' ) }
					/>
				) }
			</figure>
		</>
	);
}
