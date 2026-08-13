import { useOutletContext } from '@remix-run/react'
import type { PartyTracks } from 'partytracks/client'
import type { Dispatch, SetStateAction } from 'react'
import type { UserMedia } from '~/hooks/useUserMedia'
import type { Masquerade } from './useMasquerade'
import type useRoom from './useRoom'
import type { useRoomHistory } from './useRoomHistory'

export type RoomContextType = {
	traceLink?: string
	feedbackEnabled: boolean
	userDirectoryUrl?: string
	masquerade: Masquerade
	joined: boolean
	setJoined: Dispatch<SetStateAction<boolean>>
	pinnedTileIds: string[]
	setPinnedTileIds: Dispatch<SetStateAction<string[]>>
	/**
	 * Whether the host has asked to be heard, as themselves, while the room
	 * waits. Off until they say so: it spends their own reveal, and it is the
	 * only way an unprocessed microphone leaves this browser before the end.
	 *
	 * Lives up here because the lobby offers the switch and the room layout
	 * owns the audio graph that answers to it.
	 */
	speakingInLobby: boolean
	setSpeakingInLobby: Dispatch<SetStateAction<boolean>>
	showDebugInfo: boolean
	setShowDebugInfo: Dispatch<SetStateAction<boolean>>
	audioOnlyMode: boolean
	setAudioOnlyMode: Dispatch<SetStateAction<boolean>>
	dataSaverMode: boolean
	setDataSaverMode: Dispatch<SetStateAction<boolean>>
	userMedia: UserMedia
	partyTracks: PartyTracks
	iceConnectionState: RTCIceConnectionState
	room: ReturnType<typeof useRoom>
	roomHistory: ReturnType<typeof useRoomHistory>
	simulcastEnabled: boolean
	e2eeSafetyNumber?: string
	e2eeOnJoin: (firstUser: boolean) => void
	pushedTracks: {
		video?: string
		audio?: string
		screenshare?: string
	}
}

export function useRoomContext() {
	return useOutletContext<RoomContextType>()
}
