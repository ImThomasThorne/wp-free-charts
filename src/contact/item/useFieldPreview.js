/**
 * Editor preview for contact items that read a custom field: asks the server
 * (REST route in includes/contact-fields.php, the same lookup as the front end)
 * what the field gives for this post, or why it gives nothing.
 *
 * Lookups from every item are collected for a moment and sent as ONE request.
 * One request per item fired a burst on editor load, which can trip shared
 * hosts' limits on simultaneous requests (and break a save that lands in it).
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
		path: '/wp-free-charts/v1/contact-fields',
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
		// Wait for typing to pause and for other items to queue theirs.
		timer = setTimeout( flush, 400 );
	} );
	cache.set( key, promise );
	return promise;
}

/**
 * @param {boolean} enabled   Only look up when the item reads a field.
 * @param {string}  field     Field name.
 * @param {string}  fieldFrom 'post' | 'option' | 'author'.
 * @param {number}  contextId postId from block context (Query Loop), if any.
 * @return {{ loading?: boolean, value?: string, error?: string, field_type?: string, suggest?: string[], message?: string, postId: number }|null}
 */
export default function useFieldPreview( enabled, field, fieldFrom, contextId ) {
	// The post being edited. In the Site Editor this is a template id (a
	// string), which has no fields, so it counts as "no post".
	const editedId = useSelect( ( select ) => select( 'core/editor' )?.getCurrentPostId?.(), [] );
	const postId   = Number.isInteger( contextId ) ? contextId : ( Number.isInteger( editedId ) ? editedId : 0 );

	const key = enabled && field ? `${ fieldFrom }|${ postId }|${ field }` : '';
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
		lookup( key, { field, from: fieldFrom, post_id: postId } ).then( ( res ) => {
			if ( ! stale ) setResult( res );
		} );
		return () => {
			stale = true;
		};
	}, [ key ] );

	return result ? { ...result, postId } : null;
}
