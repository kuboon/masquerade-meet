import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientMessage, RoomState, ServerMessage } from '~/types/Messages'
import { defaultCharacterSetId } from '~/utils/characterSets'

import { nanoid } from 'nanoid'
import usePartySocket from 'partysocket/react'
import type { UserMedia } from './useUserMedia'

/**
 * A connection id that survives a page reload.
 *
 * The Durable Object keys a participant's character, ready state and host
 * role by connection id, so without this a refresh mid-meeting would hand the
 * user a brand new character — and everyone else would watch a stranger walk
 * in. sessionStorage keeps it per tab, so opening a second tab still gets a
 * separate seat at the table.
 */
function useStableConnectionId(roomName: string) {
	return useMemo(() => {
		if (typeof window === 'undefined') return undefined
		const key = `masquerade-connection-id:${roomName}`
		let id = window.sessionStorage.getItem(key)
		if (!id) {
			id = nanoid(10)
			window.sessionStorage.setItem(key, id)
		}
		return id
	}, [roomName])
}

function roomStateFingerprint(state: RoomState) {
	return JSON.stringify({
		...state,
		masquerade: { ...state.masquerade, serverNow: 0 },
	})
}

export default function useRoom({
	roomName,
	userMedia,
	characterSetId,
}: {
	roomName: string
	userMedia: UserMedia
	/**
	 * The set asked for in the room URL. Only honoured when this connection is
	 * the one that creates the room; afterwards the room's own choice wins.
	 */
	characterSetId?: string
}) {
	const [roomState, setRoomState] = useState<RoomState>({
		users: [],
		masquerade: {
			phase: 'lobby',
			serverNow: Date.now(),
			characterSetId: defaultCharacterSetId,
		},
		ai: { enabled: false },
	})

	const userLeftFunctionRef = useRef(() => {})

	useEffect(() => {
		return () => userLeftFunctionRef.current()
	}, [])

	const connectionId = useStableConnectionId(roomName)

	const websocket = usePartySocket({
		id: connectionId,
		party: 'rooms',
		room: roomName,
		// Read by the Durable Object only when it is opening a brand new room.
		query: characterSetId ? { set: characterSetId } : {},
		onMessage: (e) => {
			const message = JSON.parse(e.data) as ServerMessage
			switch (message.type) {
				case 'roomState':
					// prevent updating state if nothing has changed. serverNow
					// ticks on every broadcast, so it is excluded from the
					// comparison — otherwise the 15s heartbeat would re-render
					// the whole room for nothing.
					if (
						roomStateFingerprint(message.state) ===
						roomStateFingerprint(roomState)
					)
						break
					setRoomState(message.state)
					break
				case 'error':
					console.error('Received error message from WebSocket')
					console.error(message.error)
					break
				case 'directMessage':
					break
				case 'chatMessage':
					// Kept by useTextChat, which is mounted inside the meeting so
					// that the log cannot outlive it.
					break
				case 'muteMic':
					userMedia.turnMicOff()
					break
				case 'partyserver-pong':
				case 'e2eeMlsMessage':
				case 'userLeftNotification':
					// do nothing
					break
				default:
					message satisfies never
					break
			}
		},
	})

	userLeftFunctionRef.current = () =>
		websocket.send(JSON.stringify({ type: 'userLeft' } satisfies ClientMessage))

	useEffect(() => {
		function onBeforeUnload() {
			userLeftFunctionRef.current()
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
		}
	}, [websocket])

	// setup a heartbeat
	useEffect(() => {
		const interval = setInterval(() => {
			websocket.send(
				JSON.stringify({ type: 'heartbeat' } satisfies ClientMessage)
			)
		}, 5_000)

		return () => clearInterval(interval)
	}, [websocket])

	const identity = useMemo(
		() => roomState.users.find((u) => u.id === websocket.id),
		[roomState.users, websocket.id]
	)

	const otherUsers = useMemo(
		() => roomState.users.filter((u) => u.id !== websocket.id && u.joined),
		[roomState.users, websocket.id]
	)

	const send = useCallback(
		(message: ClientMessage) => websocket.send(JSON.stringify(message)),
		[websocket]
	)

	return {
		identity,
		otherUsers,
		websocket,
		roomState,
		send,
	}
}
