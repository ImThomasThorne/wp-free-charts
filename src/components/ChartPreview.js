import { useRef, useEffect } from '@wordpress/element';
import { Chart, registerables } from 'chart.js';

Chart.register( ...registerables );

export default function ChartPreview( { chartConfig, height } ) {
	const canvasRef = useRef( null );
	const chartRef  = useRef( null );
	const configKey = JSON.stringify( chartConfig );

	useEffect( () => {
		if ( ! canvasRef.current ) return;

		if ( chartRef.current ) {
			chartRef.current.destroy();
			chartRef.current = null;
		}

		try {
			chartRef.current = new Chart( canvasRef.current, chartConfig );
		} catch ( err ) {
			console.warn( 'WP Free Charts preview error:', err );
		}

		return () => {
			if ( chartRef.current ) {
				chartRef.current.destroy();
				chartRef.current = null;
			}
		};
	}, [ configKey ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const heightStyle = typeof height === 'number' ? `${ height }px` : height;

	return (
		<div style={ { position: 'relative', width: '100%', height: heightStyle } }>
			<canvas ref={ canvasRef } />
		</div>
	);
}
