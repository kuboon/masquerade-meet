import { useEffect } from 'react'
import { useUnmount } from 'react-use'
import type { ClientMessage, User } from '~/types/Messages'

import type PartySocket from 'partysocket'
import type { PartyTracks } from 'partytracks/client'
import { useObservableAsValue } from 'partytracks/react'
import type { RoomContextType } from './useRoomContext'
import type { UserMedia } from './useUserMedia'

interface Config {
	userMedia: UserMedia
	partyTracks: PartyTracks
	identity?: User
	websocket: PartySocket
	pushedTracks: RoomContextType['pushedTracks']
	raisedHand: boolean
	speaking: boolean
}

export default function useBroadcastStatus({
	userMedia,
	identity,
	websocket,
	partyTracks,
	pushedTracks,
	raisedHand,
	speaking,
}: Config) {
	const {
		audioEnabled,
		videoEnabled,
		screenShareEnabled,
		audioUnavailableReason,
	} = userMedia
	const { audio, video, screenshare } = pushedTracks
	const { sessionId } = useObservableAsValue(partyTracks.session$) ?? {}
	const audioUnavailable = audioUnavailableReason !== undefined

	const id = identity?.id
	const name = identity?.name
	// Identity fields are server-owned; they are echoed back only to satisfy the
	// message shape. The Durable Object ignores them on userUpdate.
	const characterId = identity?.characterId
	const ready = identity?.ready ?? false
	useEffect(() => {
		if (id && name) {
			const user: User = {
				id,
				name,
				characterId,
				ready,
				joined: true,
				raisedHand,
				speaking,
				transceiverSessionId: sessionId,
				tracks: {
					audioEnabled,
					audioUnavailable,
					videoEnabled,
					screenShareEnabled,
					video,
					audio,
					screenshare,
				},
			}

			function sendUserUpdate() {
				websocket.send(
					JSON.stringify({
						type: 'userUpdate',
						user,
					} satisfies ClientMessage)
				)
			}

			// let's send our userUpdate right away
			sendUserUpdate()

			// anytime we reconnect, we need to resend our userUpdate
			websocket.addEventListener('open', sendUserUpdate)

			return () => websocket.removeEventListener('open', sendUserUpdate)
		}
	}, [
		id,
		name,
		websocket,
		sessionId,
		audio,
		video,
		screenshare,
		audioEnabled,
		videoEnabled,
		screenShareEnabled,
		raisedHand,
		speaking,
		audioUnavailableReason,
		audioUnavailable,
		characterId,
		ready,
	])

	useUnmount(() => {
		if (id && name) {
			websocket.send(
				JSON.stringify({
					type: 'userUpdate',
					user: {
						id,
						name,
						characterId,
						ready,
						joined: false,
						raisedHand,
						speaking,
						transceiverSessionId: sessionId,
						tracks: {
							audioUnavailable,
						},
					},
				} satisfies ClientMessage)
			)
		}
	})
}
