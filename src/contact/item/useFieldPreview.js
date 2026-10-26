/**
 * Editor preview for contact items that read a custom field: asks the server
 * (REST route in includes/contact-fields.php, the same lookup as the front end)
 * what the field gives for this post, or why it gives nothing.
 */
import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

// One request per field/source/post per page load, shared by every item.
const cache = new Map();

/**
 * @param {boolean} enabled   Only look up when the item reads a field.
 * @param {string}  field     Field name.
 * @param {string}  fieldFrom 'post' | 'option' | 'author'.
 * @param {number}  contextId postId from block context (Query Loop), if any.
 * @return {{ loading: boolean, value?: string, error?: string, field_type?: string, suggest?: string[], postId: number }|null}
 */
export default function useFieldPreview( enabled, field, fieldFrom, contextId ) {
	// The post being edited. In the Site Editor this is a template id (a
	// string), which has no fields, so it counts as "no post".
	const editedId = useSelect( ( select ) => select( 'core/editor' )?.getCurrentPostId?.(), [] );
	const postId   = Number.isInteger( contextId ) ? contextId : ( Number.isInteger( editedId ) ? editedId : 0 );

	const key = enabled && field ? `${ fieldFrom }|${ postId }|${ field }` : '';
	const [ result, setResult ] = useState( () => ( key && cache.has( key ) ? cache.get( key ) : null ) );

	useEffect( () => {
		if ( ! key ) {
			setResult( null );
			return;
		}
		if ( cache.has( key ) ) {
			setResult( cache.get( key ) );
			return;
		}
		let stale = false;
		setResult( { loading: true } );
		// Wait for typing to pause before asking.
		const timer = setTimeout( () => {
			apiFetch( { path: addQueryArgs( '/wp-free-charts/v1/contact-field', { field, from: fieldFrom, post_id: postId } ) } )
				.then( ( res ) => {
					cache.set( key, res );
					if ( ! stale ) setResult( res );
				} )
				.catch( ( err ) => {
					if ( ! stale ) setResult( { error: 'request_failed', message: err?.message } );
				} );
		}, 400 );
		return () => {
			stale = true;
			clearTimeout( timer );
		};
	}, [ key ] );

	return result ? { ...result, postId } : null;
}
