import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClientMessage, RoomState, ServerMessage } from '~/types/Messages'
import { defaultCharacterSetId } from '~/utils/characterSets'
import type { CharacterSet } from '~/utils/characters'
import {
	rememberCharacter,
	rememberedCharacter,
} from '~/utils/rememberedCharacter'

import { nanoid } from 'nanoid'
import usePartySocket from 'partysocket/react'
import type { UserMedia } from './useUserMedia'

/**
 * A connection id that survives a page reload.
 *
 * The Durable Object keys a participant's character, seat and host role by
 * connection id, so without this a refresh mid-meeting would hand the
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

	// Read once, on the way in. The socket's memo key includes the query, so a
	// value that changed as the room went along would reconnect the socket.
	const query = useMemo(() => {
		const wanted = rememberedCharacter(roomName)
		return {
			// Read by the Durable Object only when it is opening a brand new room.
			...(characterSetId ? { set: characterSetId } : {}),
			// Asked for on the way in rather than corrected afterwards, so that
			// nobody watches a returning participant change face.
			...(wanted ? { want: wanted } : {}),
		}
	}, [roomName, characterSetId])

	// The roster this room borrowed from somebody else's site, if it did.
	// Sent to this connection once, ahead of the first room state, and kept
	// out of the room state for the same reason the role card is: it does not
	// belong in something rebroadcast every fifteen seconds.
	const [externalCharacterSet, setExternalCharacterSet] =
		useState<CharacterSet>()

	// The character somebody reached for a moment too late, until they pick
	// another. Kept here rather than in the room state because it happened to
	// one person, not to the room.
	const [lostCharacter, setLostCharacter] = useState<string>()

	// The role card this browser is holding, and — if this browser is the
	// game master's — everybody's. Addressed to this connection alone, which
	// is why it arrives on its own rather than as part of the room state.
	const [roleCard, setRoleCard] = useState<{
		role?: string
		deal?: Record<string, string>
	}>({})

	const websocket = usePartySocket({
		id: connectionId,
		party: 'rooms',
		room: roomName,
		query,
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
				case 'characterUnavailable':
					// Only the loser of a race hears this, and only they need to:
					// everybody else watches the character go in the room state.
					setLostCharacter(message.characterId)
					break
				case 'characterSet':
					setExternalCharacterSet(message.set)
					break
				case 'roleCard':
					// Replaced wholesale rather than merged: an empty hand after a
					// restart arrives as a message with nothing in it, and merging
					// would leave the old card sitting there.
					setRoleCard({ role: message.role, deal: message.deal })
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

	// Whatever face this browser is wearing right now, so that it can ask for
	// the same one back. Written on every change rather than only on picking:
	// the draw at the start of a meeting can hand out a different character
	// than the one that was wished for, and that is the one to come back as.
	const characterId = identity?.characterId
	useEffect(() => {
		if (characterId) rememberCharacter(roomName, characterId)
	}, [roomName, characterId])

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
		/**
		 * The roster the room borrowed, if it borrowed one. Undefined for a
		 * room wearing one of the built-in sets — every client already has
		 * those, and resolving the id is enough.
		 */
		externalCharacterSet,
		lostCharacter,
		clearLostCharacter: useCallback(() => setLostCharacter(undefined), []),
		/** the card this connection is holding, if the room has dealt any */
		myRole: roleCard.role,
		/** every card in play, sent to the game master and to nobody else */
		roleDeal: roleCard.deal,
	}
}
