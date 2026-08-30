import { type ApiHistoryEntry } from 'partytracks/client'
import type { TrackObject } from '~/utils/callsTypes'
import type { CharacterSet } from '~/utils/characters'

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
	/**
	 * Whether `characterId` is settled rather than merely wished for.
	 *
	 * In the lobby a character starts out as a wish that anybody may share.
	 * Confirming takes it: from then on nobody else may pick it, and the
	 * person who took it cannot change their mind. Everyone is confirmed once
	 * the meeting begins, because the draw settles whatever is left.
	 *
	 * It is broadcast because the picker has to grey out what is gone, and it
	 * gives nothing away that `characterId` does not already: in the lobby
	 * nobody has a name to attach a character to.
	 */
	characterConfirmed?: boolean
	/**
	 * The role card they are holding — 人狼, 占い師, whatever the host typed.
	 *
	 * Absent from the broadcast until the reveal, and then present for
	 * everybody, exactly like the real name. Before that a participant learns
	 * their own card from a `roleCard` message addressed to them alone, so the
	 * shared room state never contains anybody's card at all: there is nothing
	 * to strip and nothing to find in devtools.
	 *
	 * The Durable Object keeps cards under their own storage keys rather than
	 * in the participant record, so this field is only ever filled in on the
	 * way out. A card has to outlive the seat — a reload deletes the record —
	 * and it must not be somewhere a spread can pick it up by accident.
	 */
	role?: string
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
	 * Why this room is not wearing the set it was opened with.
	 *
	 * Only ever set when the room was pointed at somebody else's roster and
	 * could not use it — the site was down, or the file did not pass. The room
	 * carries on with the built-in faces; this is here so the person who chose
	 * it is told, rather than quietly handed something else.
	 */
	characterSetProblem?: string
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
	/**
	 * The role cards this room is playing with, in the order the host typed
	 * them. Public: which cards are in the game is what everybody has to
	 * agree on, and only who holds them is a secret.
	 *
	 * Empty when the host never set any up, which is every room that is not
	 * playing a game — the whole feature is invisible then.
	 */
	roleDeck?: string[]
	/**
	 * Whoever is running the game rather than playing it: no card, and no
	 * disguise on their voice, because a narrator nobody can understand is no
	 * use. Only the host can be this, and only by saying so.
	 */
	gameMasterId?: string
	/**
	 * When the meeting begins, on the Durable Object's clock — set the moment
	 * the host says go, cleared when it fires. Compare against `serverNow`
	 * from the same message rather than against `Date.now()`.
	 *
	 * A deadline rather than a request for permission: whatever anybody has
	 * not settled by then is settled for them.
	 */
	startAt?: number
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
			/**
			 * Somebody else took that character first. Sent only to whoever
			 * lost the race — everybody learns the character is gone from the
			 * room state, but only the loser needs telling why their button
			 * did nothing.
			 */
			type: 'characterUnavailable'
			characterId: string
	  }
	| {
			/**
			 * What this connection is holding, sent to that connection alone.
			 *
			 * A whole message of its own rather than a field on the room state,
			 * because the room state is one string broadcast to everybody: a
			 * card that lives in it is a card that has already left the room.
			 *
			 * Absent `role` means no card — the game master, a latecomer who
			 * missed the deal, or a room playing no game at all.
			 */
			type: 'roleCard'
			role?: string
			/**
			 * The whole deal, by connection id. Sent only to the game master,
			 * who dealt it and has to run the game from it.
			 */
			deal?: Record<string, string>
	  }
	| {
			/**
			 * The roster this room borrowed from somebody else's site, sent to
			 * each connection as it arrives and never again.
			 *
			 * Not part of the room state, which goes out to everybody every
			 * fifteen seconds: a roster in there would be paid for on every
			 * heartbeat for the length of the meeting. It arrives ahead of the
			 * first room state on the same socket, so `masquerade.characterSetId`
			 * never names a roster the client does not yet have.
			 *
			 * Absent entirely for a room using one of the built-in sets, whose
			 * roster is already in the client's bundle. `set.id` is the address
			 * it was fetched from, and matching it against `characterSetId` is
			 * what tells the client this is the set the room means.
			 */
			type: 'characterSet'
			set: CharacterSet
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
			/** take the selected character, if nobody has taken it first */
			type: 'confirmCharacter'
	  }
	| {
			/** host only, lobby only — the deck as typed, spaces and all */
			type: 'setRoleDeck'
			text: string
	  }
	| {
			/** host only, lobby only — whether they are dealing instead of playing */
			type: 'setGameMaster'
			isGameMaster: boolean
	  }
	| {
			type: 'startMeeting'
			/**
			 * The game master's answer to "who gets what", by connection id, for
			 * the players they bothered to decide about. It travels with the
			 * start rather than being set up in advance so that what the game
			 * master is looking at when they press the button is what the room
			 * will deal — and so that it is never anywhere the room can
			 * broadcast it from. Ignored from anybody who is not the game
			 * master.
			 */
			rolePlan?: Record<string, string>
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
