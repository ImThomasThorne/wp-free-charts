import { useState, useRef, useCallback } from '@wordpress/element';
import { Modal, Button, Notice, Flex, FlexItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

function parseNumber( val ) {
	if ( val === '' || val === null || val === undefined ) return '';
	const n = parseFloat( String( val ).replace( /,/g, '' ) );
	return isNaN( n ) ? val : n;
}

export default function DataSpreadsheet( { tableData, chartType, onSave, onClose } ) {
	const [ rows, setRows ]           = useState( () => tableData.map( ( r ) => [ ...r ] ) );
	const [ selected, setSelected ]   = useState( [ 1, 1 ] );
	const [ notice, setNotice ]       = useState( null );
	const tableRef                    = useRef( null );

	const isPieType  = [ 'pie', 'doughnut', 'polarArea' ].includes( chartType );
	const isScatter  = chartType === 'scatter';
	const numCols    = rows[ 0 ]?.length ?? 2;
	const numRows    = rows.length;

	const flash = ( msg, type = 'success' ) => {
		setNotice( { msg, type } );
		setTimeout( () => setNotice( null ), 3000 );
	};

	const updateCell = useCallback( ( r, c, value ) => {
		setRows( ( prev ) => {
			const next = prev.map( ( row ) => [ ...row ] );
			next[ r ][ c ] = r > 0 && c > 0 ? parseNumber( value ) : value;
			return next;
		} );
	}, [] );

	const addRow = useCallback( () => {
		setRows( ( prev ) => {
			const n = prev[ 0 ]?.length ?? 2;
			const newRow = Array( n ).fill( '' );
			newRow[ 0 ] = `Label ${ prev.length }`;
			for ( let i = 1; i < n; i++ ) newRow[ i ] = 0;
			return [ ...prev, newRow ];
		} );
	}, [] );

	const deleteLastRow = useCallback( () => {
		setRows( ( prev ) => prev.length > 2 ? prev.slice( 0, -1 ) : prev );
	}, [] );

	const addColumn = useCallback( () => {
		if ( isPieType ) return;
		setRows( ( prev ) => {
			const dsCount = ( prev[ 0 ]?.length ?? 1 ) - 1;
			return prev.map( ( row, i ) => {
				if ( i === 0 ) return [ ...row, isScatter ? `Series ${ dsCount + 1 } X` : `Dataset ${ dsCount + 1 }` ];
				return [ ...row, 0 ];
			} );
		} );
	}, [ isPieType, isScatter ] );

	const deleteLastColumn = useCallback( () => {
		setRows( ( prev ) => {
			if ( ! prev[ 0 ] || prev[ 0 ].length <= 2 ) return prev;
			return prev.map( ( row ) => row.slice( 0, -1 ) );
		} );
	}, [] );

	const handleKeyDown = ( e, r, c ) => {
		if ( e.key === 'Tab' ) {
			e.preventDefault();
			if ( e.shiftKey ) {
				if ( c > 0 ) setSelected( [ r, c - 1 ] );
				else if ( r > 0 ) setSelected( [ r - 1, numCols - 1 ] );
			} else {
				if ( c < numCols - 1 ) setSelected( [ r, c + 1 ] );
				else if ( r < numRows - 1 ) setSelected( [ r + 1, 0 ] );
			}
		} else if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			if ( r < numRows - 1 ) {
				setSelected( [ r + 1, c ] );
			} else {
				addRow();
				setTimeout( () => setSelected( [ r + 1, c ] ), 20 );
			}
		} else if ( e.key === 'Escape' ) {
			e.preventDefault();
			setSelected( null );
		} else if ( e.key === 'ArrowUp'    && r > 0          ) { e.preventDefault(); setSelected( [ r - 1, c ] ); }
		else if    ( e.key === 'ArrowDown'  && r < numRows - 1) { e.preventDefault(); setSelected( [ r + 1, c ] ); }
		else if    ( e.key === 'ArrowLeft'  && c > 0          ) { e.preventDefault(); setSelected( [ r, c - 1 ] ); }
		else if    ( e.key === 'ArrowRight' && c < numCols - 1) { e.preventDefault(); setSelected( [ r, c + 1 ] ); }
	};

	const handlePaste = ( e ) => {
		e.preventDefault();
		const raw  = e.clipboardData.getData( 'text/plain' );
		const grid = raw.trim().split( /\r?\n/ ).map( ( line ) => line.split( '\t' ) );

		if ( ! grid.length ) return;

		// Detect if first row looks like headers (non-numeric first cell)
		const firstRowIsHeader = isNaN( parseFloat( grid[ 0 ][ 1 ] ) );
		const dataRows         = firstRowIsHeader ? grid.slice( 1 ) : grid;
		const datasetNames     = firstRowIsHeader
			? grid[ 0 ].slice( 1 )
			: grid[ 0 ].slice( 1 ).map( ( _, i ) => `Dataset ${ i + 1 }` );

		const maxCols = Math.max( ...dataRows.map( ( r ) => r.length ) );
		const header  = [ '', ...datasetNames.slice( 0, maxCols - 1 ) ];

		const built = [ header ];
		dataRows.forEach( ( row ) => {
			const mapped = row.map( ( cell, ci ) => {
				if ( ci === 0 ) return cell;
				const n = parseFloat( cell.replace( /,/g, '' ) );
				return isNaN( n ) ? cell : n;
			} );
			built.push( mapped );
		} );

		setRows( built );
		flash( __( `Pasted ${ dataRows.length } rows successfully. Review and click Apply.`, 'wp-free-charts' ) );
	};

	const exportCSV = () => {
		const csv = rows.map( ( row ) =>
			row.map( ( c ) => ( typeof c === 'string' && /[,"\n]/.test( c ) ? `"${ c.replace( /"/g, '""' ) }"` : c ) ).join( ',' )
		).join( '\n' );
		const url = URL.createObjectURL( new Blob( [ csv ], { type: 'text/csv' } ) );
		const a   = Object.assign( document.createElement( 'a' ), { href: url, download: 'chart-data.csv' } );
		a.click();
		URL.revokeObjectURL( url );
	};

	const resetData = () => {
		setRows( [
			[ '', 'Dataset 1' ],
			[ 'Label 1', 0 ],
			[ 'Label 2', 0 ],
			[ 'Label 3', 0 ],
		] );
		flash( __( 'Data reset.', 'wp-free-charts' ), 'warning' );
	};

	const hint = isPieType
		? __( 'First column = slice label, second column = numeric value. Each row is one slice.', 'wp-free-charts' )
		: isScatter
		? __( 'Columns come in X/Y pairs after the label column. Each pair = one scatter series.', 'wp-free-charts' )
		: __( 'Row 1 = dataset names. First column = category label (X axis). You can paste directly from Excel or Google Sheets.', 'wp-free-charts' );

	return (
		<Modal
			title={ __( 'Edit Chart Data', 'wp-free-charts' ) }
			onRequestClose={ onClose }
			className="wfc-data-modal"
		>
			<div className="wfc-spreadsheet-wrapper" onPaste={ handlePaste }>
				{ notice && (
					<Notice status={ notice.type } isDismissible={ false } className="wfc-paste-notice">
						{ notice.msg }
					</Notice>
				) }

				<p className="wfc-spreadsheet-hint">{ hint }</p>

				<div className="wfc-spreadsheet-scroll">
					<table className="wfc-spreadsheet-table" ref={ tableRef }>
						<tbody>
							{ rows.map( ( row, r ) => (
								<tr key={ r } className={ r === 0 ? 'wfc-header-row' : '' }>
									<td className="wfc-row-num">{ r === 0 ? '#' : r }</td>

									{ row.map( ( cell, c ) => {
										const isHeader   = r === 0 || c === 0;
										const isSel      = selected && selected[ 0 ] === r && selected[ 1 ] === c;
										const isNumInput = r > 0 && c > 0;

										return (
											<td
												key={ c }
												className={ [
													'wfc-cell',
													isHeader ? 'wfc-cell--header' : 'wfc-cell--data',
													isSel    ? 'wfc-cell--selected' : '',
												].join( ' ' ) }
												onClick={ () => setSelected( [ r, c ] ) }
											>
												{ isSel ? (
													<input
														type={ isNumInput ? 'number' : 'text' }
														step="any"
														className="wfc-cell-input"
														value={ cell }
														onChange={ ( e ) => updateCell( r, c, e.target.value ) }
														onKeyDown={ ( e ) => handleKeyDown( e, r, c ) }
														autoFocus
													/>
												) : (
													<span className="wfc-cell-display">
														{ cell === '' || cell === null || cell === undefined ? ' ' : String( cell ) }
													</span>
												) }
											</td>
										);
									} ) }

									{ r === 0 && (
										<td className="wfc-cell-actions-col">
											<Button
												size="small"
												variant="tertiary"
												onClick={ addColumn }
												disabled={ isPieType }
												title={ __( 'Add column', 'wp-free-charts' ) }
											>+Col</Button>
											<Button
												size="small"
												variant="tertiary"
												isDestructive
												onClick={ deleteLastColumn }
												disabled={ ( rows[ 0 ]?.length ?? 2 ) <= 2 }
												title={ __( 'Delete last column', 'wp-free-charts' ) }
											>−Col</Button>
										</td>
									) }
									{ r > 0 && <td className="wfc-cell-actions-col" /> }
								</tr>
							) ) }
						</tbody>
					</table>
				</div>

				<Flex gap={ 2 } wrap className="wfc-row-controls">
					<FlexItem>
						<Button size="small" variant="secondary" onClick={ addRow }>
							{ __( '+ Add Row', 'wp-free-charts' ) }
						</Button>
					</FlexItem>
					<FlexItem>
						<Button size="small" variant="secondary" isDestructive onClick={ deleteLastRow } disabled={ numRows <= 2 }>
							{ __( '− Delete Last Row', 'wp-free-charts' ) }
						</Button>
					</FlexItem>
					<FlexItem>
						<Button size="small" variant="tertiary" onClick={ exportCSV }>
							{ __( '↓ Export CSV', 'wp-free-charts' ) }
						</Button>
					</FlexItem>
					<FlexItem>
						<Button size="small" variant="tertiary" isDestructive onClick={ resetData }>
							{ __( 'Reset', 'wp-free-charts' ) }
						</Button>
					</FlexItem>
				</Flex>

				<Flex justify="flex-end" gap={ 2 } className="wfc-modal-footer">
					<Button variant="tertiary" onClick={ onClose }>
						{ __( 'Cancel', 'wp-free-charts' ) }
					</Button>
					<Button variant="primary" onClick={ () => onSave( rows ) }>
						{ __( 'Apply Changes', 'wp-free-charts' ) }
					</Button>
				</Flex>
			</div>
		</Modal>
	);
}
