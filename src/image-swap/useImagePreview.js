/**
 * Editor preview for Image Swap: asks the server (REST route in
 * includes/image-swap.php, the same lookup as the front end) which image each
 * slot gives for this post, or why it gives none.
 *
 * Lookups from every block are collected for a moment and sent as ONE request
 * (a Query Loop shows many blocks; one request each could trip shared hosts'
 * limits on simultaneous requests).
 */
import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const cache   = new Map(); // key -> result (or a promise while in flight)
const pending = new Map(); // key -> { lookup, resolve }
let timer     = null;

function flush() {
	timer = null;
	const batch = [ ...pending.entries() ].slice( 0, 100 );
	batch.forEach( ( [ key ] ) => pending.delete( key ) );
	if ( pending.size ) timer = setTimeout( flush, 0 );

	apiFetch( {
		path: '/wp-free-charts/v1/image-swap',
		method: 'POST',
		data: { lookups: batch.map( ( [ , p ] ) => p.lookup ) },
	} )
		.then( ( results ) => batch.forEach( ( [ key, p ], i ) => {
			const res = results?.[ i ] ?? { error: 'request_failed' };
			cache.set( key, res );
			p.resolve( res );
		} ) )
		.catch( ( err ) => batch.forEach( ( [ key, p ] ) => {
			cache.delete( key ); // Try again next time.
			p.resolve( { error: 'request_failed', message: err?.message } );
		} ) );
}

function lookup( key, data ) {
	if ( cache.has( key ) ) return Promise.resolve( cache.get( key ) );
	const promise = new Promise( ( resolve ) => {
		pending.set( key, { lookup: data, resolve } );
		clearTimeout( timer );
		// Wait for typing to pause and for other blocks to queue theirs.
		timer = setTimeout( flush, 400 );
	} );
	cache.set( key, promise );
	return promise;
}

/** The post the block shows: postId from context (Query Loop), else the post being edited. */
export function usePostId( contextId ) {
	// In the Site Editor this is a template id (a string), which has no fields.
	const editedId = useSelect( ( select ) => select( 'core/editor' )?.getCurrentPostId?.(), [] );
	return Number.isInteger( contextId ) ? contextId : ( Number.isInteger( editedId ) ? editedId : 0 );
}

/**
 * @param {Object|null} slot   { source, field, from, mediaId } or null to skip.
 * @param {number}      postId
 * @param {string}      size   Image size slug.
 * @return {{ loading?: boolean, id?: number, url?: string, alt?: string, error?: string, field_type?: string, message?: string }|null}
 */
export default function useImagePreview( slot, postId, size ) {
	const key = slot ? [ slot.source, slot.from, postId, slot.field, slot.mediaId, size ].join( '|' ) : '';
	const known = key && cache.get( key );
	const [ result, setResult ] = useState( known && ! ( known instanceof Promise ) ? known : null );

	useEffect( () => {
		if ( ! key ) {
			setResult( null );
			return;
		}
		let stale = false;
		const hit = cache.get( key );
		setResult( hit && ! ( hit instanceof Promise ) ? hit : { loading: true } );
		lookup( key, { ...slot, post_id: postId, size } ).then( ( res ) => {
			if ( ! stale ) setResult( res );
		} );
		return () => {
			stale = true;
		};
	}, [ key ] );

	return result;
}
