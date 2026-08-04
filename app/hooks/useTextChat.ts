import type PartySocket from 'partysocket'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, ServerMessage, User } from '~/types/Messages'
import type { ChatMessage } from '~/utils/textChat'

/**
 * A meeting's worth of chat, and no more.
 *
 * Nothing is stored on the server, so the log lives exactly as long as the
 * component holding this hook. Mounting it inside the meeting rather than
 * alongside the room is deliberate: leaving for the lobby — which is where
 * "最初から" puts everyone — takes the log with it, and it has to go. Names
 * are resolved from the roster at render time, and after a restart everyone
 * is wearing somebody else's face, so a surviving log would quietly
 * re-attribute the last round's lines to the wrong people.
 */
export default function useTextChat({
	websocket,
	users,
}: {
	websocket: PartySocket
	users: User[]
}) {
	const [messages, setMessages] = useState<ChatMessage[]>([])

	// The listener is registered once per socket; without this it would read
	// the roster as it was at that moment for the rest of the meeting.
	const usersRef = useRef(users)
	usersRef.current = users

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const message = JSON.parse(event.data) as ServerMessage
			if (message.type !== 'chatMessage') return
			const { id, from, body, at } = message
			setMessages((previous) => [
				...previous,
				{
					id,
					from,
					body,
					at,
					nameWhenSent:
						usersRef.current.find((u) => u.id === from)?.name ?? '???',
				},
			])
		}
		websocket.addEventListener('message', onMessage)
		return () => websocket.removeEventListener('message', onMessage)
	}, [websocket])

	const sendChatMessage = useCallback(
		(body: string) => {
			// The room does the trimming and the length limit; sending an empty
			// line would just be a round trip to nowhere.
			if (body.trim() === '') return
			websocket.send(
				JSON.stringify({ type: 'chatMessage', body } satisfies ClientMessage)
			)
		},
		[websocket]
	)

	return { messages, sendChatMessage }
}
