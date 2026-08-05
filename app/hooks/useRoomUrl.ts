import { useParams } from '@remix-run/react'
import invariant from 'tiny-invariant'

/**
 * The link to hand out. Nothing but the room.
 *
 * Whatever is in the address bar — `?set=` from creating the room, anything
 * a browser or a chat client has stuck on the end — has no business in an
 * invitation. The room settled which characters it wears the moment it
 * opened and keeps that in its own storage; a query string on a guest's
 * link is ignored, so all it can do is make the link look like it means
 * something.
 */
export function useRoomUrl() {
	const { roomName } = useParams()
	invariant(roomName)
	if (typeof window === 'undefined') return ''
	return new URL(roomName, window.location.origin).toString()
}
