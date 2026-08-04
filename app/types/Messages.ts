import { type ApiHistoryEntry } from 'partytracks/client'
import type { TrackObject } from '~/utils/callsTypes'

/**
 * lobby      - everyone is picking a character and getting ready
 * masquerade - the meeting is running, everybody is disguised
 * revealing  - the host pulled the trigger, countdown is running
 * revealed   - masks are off
 */
export type RoomPhase = 'lobby' | 'masquerade' | 'revealing' | 'revealed'

export type User = {
	id: string
	/**
	 * The name everyone is allowed to see. While the room is masked this is
	 * the character's name — the real name never leaves the Durable Object
	 * until the reveal, so the disguise survives a peek at devtools.
	 */
	name: string
	characterId?: string
	ready: boolean
	transceiverSessionId?: string
	raisedHand: boolean
	speaking: boolean
	joined: boolean
	tracks: {
		audio?: string
		audioEnabled?: boolean
		audioUnavailable: boolean
		video?: string
		videoEnabled?: boolean
		screenshare?: string
		screenShareEnabled?: boolean
	}
}

/** The shape kept in Durable Object storage. Never broadcast as-is. */
export type StoredUser = User & { realName: string }

export type MasqueradeState = {
	phase: RoomPhase
	hostId?: string
	/**
	 * When the masks come off, on the Durable Object's clock. Compare against
	 * `serverNow` from the same message rather than against `Date.now()` so
	 * that a skewed client clock cannot desynchronise the countdown.
	 */
	revealAt?: number
	serverNow: number
	/**
	 * Which roster this room is hiding behind. Decided by whoever opened the
	 * room and fixed from then on — everybody has to be wearing faces from the
	 * same set. Read it through `getCharacterSet`, which tolerates a value from
	 * a Durable Object that predates this field.
	 */
	characterSetId: string
}

export type RoomState = {
	meetingId?: string
	users: User[]
	masquerade: MasqueradeState
	ai: {
		enabled: boolean
		controllingUser?: string
		error?: string
		connectionPending?: boolean
	}
}

export type ServerMessage =
	| {
			type: 'roomState'
			state: RoomState
	  }
	| {
			type: 'error'
			error?: string
	  }
	| {
			type: 'directMessage'
			from: string
			message: string
	  }
	| {
			type: 'muteMic'
	  }
	| {
			type: 'partyserver-pong'
	  }
	| {
			type: 'e2eeMlsMessage'
			payload: string
	  }
	| {
			type: 'userLeftNotification'
			id: string
	  }

export type ClientMessage =
	| {
			type: 'userUpdate'
			user: User
	  }
	| {
			type: 'directMessage'
			to: string
			message: string
	  }
	| {
			type: 'muteUser'
			id: string
	  }
	| {
			type: 'userLeft'
	  }
	| {
			type: 'partyserver-ping'
	  }
	| {
			type: 'heartbeat'
	  }
	| {
			type: 'setDisplayName'
			/** the real name, shown to everyone only once the masks come off */
			name: string
	  }
	| {
			type: 'selectCharacter'
			characterId: string
	  }
	| {
			type: 'setReady'
			ready: boolean
	  }
	| {
			type: 'startMeeting'
	  }
	| {
			type: 'startReveal'
	  }
	| {
			type: 'enableAi'
			instructions?: string
			voice?: string
	  }
	| {
			type: 'disableAi'
	  }
	| {
			type: 'requestAiControl'
			track: TrackObject
	  }
	| {
			type: 'relenquishAiControl'
	  }
	| {
			type: 'callsApiHistoryEntry'
			entry: ApiHistoryEntry
			sessionId?: string
	  }
	| {
			type: 'e2eeMlsMessage'
			payload: string
	  }
