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
export type StoredUser = User & {
	realName: string
	/**
	 * When this connection was first seen in the room, on the room's clock. It
	 * decides who picks up the host controls if the host disappears, and it
	 * outlives the seat — the room keeps it separately, so a reload does not
	 * send somebody to the back of the queue.
	 *
	 * Optional because rooms that predate it have seats without one, and kept
	 * out of the broadcast: nobody needs to know who arrived when, and while
	 * the room is masked that is one more thing to match a person against.
	 */
	joinedAt?: number
}

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
	/**
	 * Where everyone sits, by connection id, decided once when the meeting
	 * starts and the same for everybody — a tile that moves is a tile you have
	 * to find again, and in a game of who-is-who that is half the information
	 * on the screen.
	 *
	 * Shuffled rather than in arrival order, which would put on the wire the
	 * one thing `joinedAt` is deliberately kept off it for.
	 *
	 * A seat outlives whoever is in it: somebody who drops out leaves an empty
	 * frame and gets it back when they return, rather than everyone else
	 * shuffling along. Optional only for rooms that predate it.
	 */
	seats?: string[]
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
	| {
			type: 'chatMessage'
			/** unique per room, so the log can be keyed and de-duplicated */
			id: string
			/**
			 * The sender's connection id — deliberately not their name. Turning
			 * an id into a name is the roster's job, and the roster serves
			 * character names until the reveal and real ones after it, so the
			 * log unmasks along with everything else and no real name is ever
			 * on the wire early.
			 */
			from: string
			body: string
			/** the Durable Object's clock, so everyone orders the log alike */
			at: number
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
			type: 'restartMeeting'
	  }
	| {
			/** host only, and only a seat nobody is sitting in */
			type: 'removeSeat'
			seatId: string
	  }
	| {
			type: 'chatMessage'
			body: string
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
