import type { Env } from '~/types/Env'
import type {
	ClientMessage,
	MasqueradeState,
	RoomPhase,
	ServerMessage,
	StoredUser,
	User,
} from '~/types/Messages'
import { assertError } from '~/utils/assertError'
import assertNever from '~/utils/assertNever'
import {
	defaultCharacterSetId,
	getCharacter,
	getCharacterSet,
	isCharacterSetId,
} from '~/utils/characterSets'
import type { CharacterSet } from '~/utils/characters'
import getUsername from '~/utils/getUsername.server'
import {
	assignCharacters,
	canRestartMeeting,
	canStartMeeting,
	nextHost,
	restartParticipant,
	shuffled,
	startCountdownMs,
} from '~/utils/masquerade'

import { eq, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import {
	Server,
	type Connection,
	type ConnectionContext,
	type WSMessage,
} from 'partyserver'
import { getDb, Meetings } from 'schema'
import invariant from 'tiny-invariant'
import { log } from '~/utils/logging'
import {
	CallsNewSession,
	CallsSession,
	checkNewTracksResponse,
	requestOpenAIService,
	type SessionDescription,
} from '~/utils/openai.server'

const alarmInterval = 15_000
const defaultOpenAIModelID = 'gpt-4o-realtime-preview-2024-10-01'

/** How long the "masks come off in..." countdown runs for. */
export const revealCountdownMs = 5_000

const PHASE_KEY = 'masquerade:phase'
const REVEAL_AT_KEY = 'masquerade:revealAt'
const HOST_KEY = 'masquerade:hostId'
const CHARACTER_SET_KEY = 'masquerade:characterSetId'
const SEATS_KEY = 'masquerade:seats'
const START_AT_KEY = 'masquerade:startAt'

/** Long enough for a real name, short enough not to break the tiles. */
const MAX_NAME_LENGTH = 40

/** Long enough to say something, short enough not to be a payload. */
const MAX_CHAT_LENGTH = 500

/**
 * The ChatRoom Durable Object Class
 *
 * ChatRoom implements a Durable Object that coordinates an
 * individual chat room. Participants connect to the room using
 * WebSockets, and the room broadcasts messages from each participant
 * to all others.
 */
export class ChatRoom extends Server<Env> {
	env: Env
	db: DrizzleD1Database<Record<string, never>> | null

	// static options = { hibernate: true }

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.env = env
		this.db = getDb(this)
	}

	// a small typesafe wrapper around connection.send
	sendMessage<M extends ServerMessage>(connection: Connection, message: M) {
		connection.send(JSON.stringify(message))
	}

	async onStart(): Promise<void> {
		const meetingId = await this.getMeetingId()
		log({ eventName: 'onStart', meetingId })
		this.db = getDb(this)
		// TODO: make this a part of partyserver
		// this.ctx.setWebSocketAutoResponse(
		// 	new WebSocketRequestResponsePair(
		// 		JSON.stringify({ type: 'partyserver-ping' }),
		// 		JSON.stringify({ type: 'partyserver-pong' })
		// 	)
		// )
	}

	async onConnect(
		connection: Connection<User>,
		ctx: ConnectionContext
	): Promise<void> {
		// let's start the periodic alarm if it's not already started
		if (!(await this.ctx.storage.getAlarm())) {
			// start the alarm to broadcast state every 30 seconds
			this.ctx.storage.setAlarm(Date.now() + alarmInterval)
		}

		// May be null. The name is asked for in the lobby, and the meeting
		// leaves behind anybody without one, so a seat starts out anonymous
		// rather than refused.
		const username = (await getUsername(ctx.request)) ?? ''

		const characterSet = getCharacterSet(await this.resolveCharacterSetId(ctx))

		const joinedAt = await this.firstSeenAt(connection.id)

		let user = await this.ctx.storage.get<StoredUser>(
			`session-${connection.id}`
		)
		const foundInStorage = user !== undefined
		if (user !== undefined) {
			user = { ...user, joinedAt }
		} else {
			user = {
				id: connection.id,
				joinedAt,
				// The real name is kept apart from the broadcast name and only
				// surfaces once the room has been revealed.
				realName: username,
				name: username,
				characterId: await this.pickCharacterPreference(
					characterSet,
					new URL(ctx.request.url).searchParams.get('want')
				),
				characterConfirmed: false,
				joined: false,
				raisedHand: false,
				speaking: false,
				tracks: {
					audioEnabled: false,
					audioUnavailable: false,
					videoEnabled: false,
					screenShareEnabled: false,
				},
			}
		}

		// store the user's data in storage
		await this.ctx.storage.put(`session-${connection.id}`, user)
		// Somebody walking into a meeting already in progress needs a seat of
		// their own. Everyone else is seated when the meeting starts.
		if ((await this.getMasqueradeState()).phase !== 'lobby') {
			await this.takeSeat(connection.id)
		}
		// the first person through the door runs the room
		if ((await this.ctx.storage.get<string>(HOST_KEY)) === undefined) {
			await this.ctx.storage.put(HOST_KEY, connection.id)
		}
		await this.ctx.storage.put(`heartbeat-${connection.id}`, Date.now())
		await this.trackPeakUserCount()
		await this.broadcastRoomState()
		const meetingId = await this.getMeetingId()
		log({
			eventName: 'onConnect',
			meetingId,
			foundInStorage,
			connectionId: connection.id,
		})
	}

	async trackPeakUserCount() {
		let meetingId = await this.getMeetingId()
		const meeting = meetingId
			? await this.getMeeting(meetingId)
			: await this.createMeeting()
		await this.cleanupOldConnections()
		if (this.db) {
			if (!meeting) return
			if (meeting.ended !== null) {
				await this.db
					.update(Meetings)
					.set({ ended: null })
					.where(eq(Meetings.id, meeting.id))
			}

			const previousCount = meeting.peakUserCount
			const userCount = (await this.getUsers()).size
			if (userCount > previousCount) {
				await this.db
					.update(Meetings)
					.set({
						peakUserCount: userCount,
					})
					.where(eq(Meetings.id, meeting.id))
			}
		}
		return meetingId
	}

	async getMeetingId() {
		return this.ctx.storage.get<string>('meetingId')
	}

	async createMeeting() {
		const meetingId = crypto.randomUUID()
		await this.ctx.storage.put('meetingId', meetingId)
		log({ eventName: 'startingMeeting', meetingId })
		if (this.db) {
			return this.db
				.insert(Meetings)
				.values({
					id: meetingId,
					peakUserCount: 1,
				})
				.returning()
				.then(([m]) => m)
		}
	}

	async getMeeting(meetingId: string) {
		if (!this.db) return null
		const [meeting] = await this.db
			.select()
			.from(Meetings)
			.where(eq(Meetings.id, meetingId))

		return meeting
	}

	async broadcastMessage(
		message: ServerMessage,
		excludedConnection?: Connection
	) {
		let didSomeoneQuit = false
		const meetingId = await this.getMeetingId()
		const messageAsString = JSON.stringify(message)

		for (const connection of this.getConnections()) {
			try {
				if (excludedConnection && connection === excludedConnection) continue
				connection.send(messageAsString)
			} catch (err) {
				connection.close(1011, 'Failed to broadcast state')
				log({
					eventName: 'errorBroadcastingToUser',
					meetingId,
					connectionId: connection.id,
				})
				await this.ctx.storage.delete(`session-${connection.id}`)
				didSomeoneQuit = true
			}
		}

		if (didSomeoneQuit) {
			// broadcast again to remove the user who quit
			await this.broadcastRoomState()
		}
	}

	/**
	 * Reads the masquerade state, promoting `revealing` to `revealed` once the
	 * countdown has elapsed. Doing this lazily means a client that joins or
	 * reconnects during the countdown always lands in the right phase, even if
	 * the alarm hasn't fired yet.
	 */
	async getMasqueradeState(): Promise<MasqueradeState> {
		let phase = (await this.ctx.storage.get<RoomPhase>(PHASE_KEY)) ?? 'lobby'
		const revealAt = await this.ctx.storage.get<number>(REVEAL_AT_KEY)
		let startAt = await this.ctx.storage.get<number>(START_AT_KEY)
		const now = Date.now()

		if (phase === 'revealing' && revealAt !== undefined && now >= revealAt) {
			phase = 'revealed'
			await this.ctx.storage.put(PHASE_KEY, phase)
		}

		// Same lazily as the reveal: whoever reads the room next brings it up
		// to date, so a client that connects or reconnects across the deadline
		// lands in the right place even if the alarm has not fired yet.
		if (phase === 'lobby' && startAt !== undefined && now >= startAt) {
			await this.beginMeeting()
			phase = 'masquerade'
			startAt = undefined
		}

		return {
			phase,
			hostId: await this.ctx.storage.get<string>(HOST_KEY),
			revealAt,
			serverNow: now,
			characterSetId:
				(await this.ctx.storage.get<string>(CHARACTER_SET_KEY)) ??
				defaultCharacterSetId,
			seats: await this.getSeats(),
			startAt,
		}
	}

	/**
	 * Turns the lobby into a meeting, on the deadline the host set.
	 *
	 * Whatever anybody has not settled by now is settled for them: a wish that
	 * clashed, or no wish at all, becomes whichever face is still going. The
	 * one thing that cannot be decided on somebody's behalf is the name they
	 * will be unmasked as, so anybody without one is left in the lobby — they
	 * are not thrown out, and typing a name walks them in.
	 */
	private async beginMeeting() {
		const meetingId = await this.getMeetingId()
		const everyone = [...(await this.getUsers()).values()]
		const joining = everyone.filter((user) => user.realName !== '')
		const characterSet = getCharacterSet(
			await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
		)

		const assigned = assignCharacters(
			joining,
			characterSet.characters.map((c) => c.id)
		)
		for (const user of joining) {
			await this.ctx.storage.put(`session-${user.id}`, {
				...user,
				characterId: assigned.get(user.id) ?? user.characterId,
				// Whatever anybody was still only wishing for is theirs now: the
				// draw is the last word, and there is nothing left to change.
				characterConfirmed: true,
			} satisfies StoredUser)
		}

		// Where everybody sits, settled once so that every screen in the room
		// looks the same. Shuffled, because seating people in the order they
		// arrived would tell the room something it is not supposed to know.
		await this.ctx.storage.put(SEATS_KEY, shuffled(joining.map((u) => u.id)))
		await this.ctx.storage.put(PHASE_KEY, 'masquerade' satisfies RoomPhase)
		await this.ctx.storage.delete(START_AT_KEY)
		log({
			eventName: 'meetingStarted',
			meetingId,
			users: joining.length,
		})
	}

	async getSeats(): Promise<string[]> {
		return (await this.ctx.storage.get<string[]>(SEATS_KEY)) ?? []
	}

	/**
	 * Puts a latecomer at the end of the seating chart.
	 *
	 * Only appends, never reorders: a returning participant is recognised by
	 * the same connection id and finds their old seat still there, which is
	 * the point of seating people at all.
	 */
	private async takeSeat(connectionId: string) {
		const seats = await this.getSeats()
		if (seats.includes(connectionId)) return
		await this.ctx.storage.put(SEATS_KEY, [...seats, connectionId])
	}

	/**
	 * Settles which set of faces this room wears, once and for all.
	 *
	 * Only the connection that opens the room has a say. A room that already
	 * has people in it has already handed out characters from some roster, so
	 * a latecomer editing `?set=` in the URL must not be able to swap
	 * everyone's faces out from under them — including in a room that predates
	 * this field and therefore has nothing pinned.
	 */
	private async resolveCharacterSetId(ctx: ConnectionContext): Promise<string> {
		const pinned = await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
		if (pinned !== undefined) return pinned

		const firstThroughTheDoor = (await this.getUsers()).size === 0
		const requested = firstThroughTheDoor
			? new URL(ctx.request.url).searchParams.get('set')
			: null
		const id = isCharacterSetId(requested) ? requested : defaultCharacterSetId
		await this.ctx.storage.put(CHARACTER_SET_KEY, id)
		return id
	}

	/**
	 * When this connection was first seen in this room, ever.
	 *
	 * Kept apart from the seat and outlived by nothing: a seat is cleared the
	 * moment its page goes away, so an owner who reloads out of trouble would
	 * otherwise come back as the newest arrival and lose their place in line
	 * for the host controls for good. This way the controls come back to them
	 * when whoever picked them up in the meantime leaves.
	 *
	 * The room decides this, rather than taking the client's word for it —
	 * otherwise anybody could claim to have been here since the beginning and
	 * put themselves next in line. It goes away with the meeting.
	 */
	private async firstSeenAt(connectionId: string): Promise<number> {
		const key = `firstSeen-${connectionId}`
		const seen = await this.ctx.storage.get<number>(key)
		if (seen !== undefined) return seen
		const now = Date.now()
		await this.ctx.storage.put(key, now)
		return now
	}

	/**
	 * The characters nobody else may pick, because somebody took them.
	 *
	 * Distinct from `getTakenCharacterIds`, which counts wishes too: in the
	 * lobby several people may want the same face, and only confirming makes
	 * it theirs.
	 */
	async getConfirmedCharacterIds(excludeConnectionId?: string) {
		const confirmed = new Set<string>()
		for (const [key, user] of await this.getUsers()) {
			if (key === `session-${excludeConnectionId}`) continue
			if (user.characterConfirmed && user.characterId) {
				confirmed.add(user.characterId)
			}
		}
		return confirmed
	}

	/** Every character spoken for, wished for or taken. */
	async getTakenCharacterIds(excludeConnectionId?: string) {
		const taken = new Set<string>()
		for (const [key, user] of await this.getUsers()) {
			if (key === `session-${excludeConnectionId}`) continue
			if (user.characterId) taken.add(user.characterId)
		}
		return taken
	}

	/**
	 * The character a new arrival starts out wearing.
	 *
	 * `wanted` is a returning participant asking for the face they had before
	 * — a reload clears the seat, so without this they would come back as
	 * somebody else mid-meeting. It is granted only if it is still free;
	 * whoever is wearing it now was here in the meantime and keeps it.
	 *
	 * Otherwise one nobody has taken, at random. Undefined when there are none
	 * left: the room is full, and two people behind the same face is worse
	 * than one person who cannot join.
	 */
	async pickCharacterPreference(
		set: CharacterSet,
		wanted?: string | null
	): Promise<string | undefined> {
		const taken = await this.getTakenCharacterIds()
		const free = set.characters.filter((c) => !taken.has(c.id))
		if (wanted && free.some((c) => c.id === wanted)) return wanted
		if (free.length === 0) return undefined
		return free[Math.floor(Math.random() * free.length)].id
	}

	/**
	 * Strips everything the other participants aren't supposed to know yet.
	 * Real names are swapped for character names until the room is revealed.
	 */
	async getPublicUsers(phase: RoomPhase, set: CharacterSet): Promise<User[]> {
		const revealed = phase === 'revealed'
		const users: User[] = []
		for (const stored of (await this.getUsers()).values()) {
			// Arrival times stay here too: nobody needs them, and while the
			// room is masked they are one more thing to match a person against.
			const { realName, joinedAt: _joinedAt, ...rest } = stored
			users.push({
				...rest,
				name: revealed
					? realName || '???'
					: (getCharacter(set, stored.characterId)?.name ?? '???'),
			})
		}
		return users
	}

	/**
	 * Makes sure somebody is holding the host controls, handing them to the
	 * longest-standing participant if the previous host dropped out.
	 */
	async ensureHost() {
		const hostId = await this.ctx.storage.get<string>(HOST_KEY)
		const users = await this.getUsers()
		if (hostId !== undefined && users.has(`session-${hostId}`)) return hostId

		const successor = nextHost([...users.values()])
		if (successor === undefined) {
			await this.ctx.storage.delete(HOST_KEY)
			return undefined
		}
		await this.ctx.storage.put(HOST_KEY, successor.id)
		log({ eventName: 'hostReassigned', connectionId: successor.id })
		return successor.id
	}

	async broadcastRoomState() {
		const meetingId = await this.getMeetingId()
		const aiEnabled =
			(await this.ctx.storage.get<boolean>('ai:enabled')) ?? false
		const aiSessionId =
			(await this.ctx.storage.get<string>('ai:sessionId')) ?? undefined
		const aiAudioTrack =
			(await this.ctx.storage.get<string>('ai:trackName')) ?? undefined
		await this.ensureHost()
		const masquerade = await this.getMasqueradeState()
		const characterSet = getCharacterSet(masquerade.characterSetId)
		const roomState = {
			type: 'roomState',
			state: {
				masquerade,
				ai: {
					enabled: aiEnabled,
					controllingUser:
						await this.ctx.storage.get<string>('ai:userControlling'),
					connectionPending: await this.ctx.storage.get<boolean>(
						'ai:connectionPending'
					),
					error: await this.ctx.storage.get<string>('ai:error'),
				},
				meetingId,
				users: [
					...(await this.getPublicUsers(masquerade.phase, characterSet)),
					...(aiEnabled
						? [
								{
									id: 'ai',
									name: 'AI',
									joined: true,
									raisedHand: false,
									transceiverSessionId: aiSessionId,
									speaking: false,
									tracks: {
										audioEnabled: true,
										audio: aiSessionId + '/' + aiAudioTrack,
										audioUnavailable: false,
										videoEnabled: false,
										screenShareEnabled: false,
									},
								} satisfies User,
							]
						: []),
				],
			},
		} satisfies ServerMessage
		return this.broadcastMessage(roomState)
	}

	async onClose(
		connection: Connection,
		code: number,
		reason: string,
		wasClean: boolean
	) {
		const meetingId = await this.getMeetingId()
		log({
			eventName: 'onClose',
			meetingId,
			connectionId: connection.id,
			code,
			reason,
			wasClean,
		})
	}

	async onMessage(
		connection: Connection<User>,
		message: WSMessage
	): Promise<void> {
		try {
			const meetingId = await this.getMeetingId()
			if (typeof message !== 'string') {
				console.warn('Received non-string message')
				return
			}

			let data: ClientMessage = JSON.parse(message)

			switch (data.type) {
				case 'userLeft': {
					connection.close(1000, 'User left')
					this.userLeftNotification(connection.id)
					await this.ctx.storage
						.delete(`session-${connection.id}`)
						.catch(() => {
							console.warn(
								`Failed to delete session session-${connection.id} on userLeft`
							)
						})
					await this.ctx.storage
						.delete(`heartbeat-${connection.id}`)
						.catch(() => {
							console.warn(
								`Failed to delete session session-heartbeat-${connection.id} on userLeft`
							)
						})
					log({ eventName: 'userLeft', meetingId, connectionId: connection.id })

					await this.broadcastRoomState()
					break
				}
				case 'userUpdate': {
					// The client owns its media state; the server owns identity.
					// Merging rather than overwriting is what keeps a tampered
					// client from broadcasting its own real name, promoting
					// itself to host, or stealing someone else's character.
					const stored = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)
					if (!stored) break
					const merged: StoredUser = {
						...stored,
						joined: data.user.joined,
						raisedHand: data.user.raisedHand,
						speaking: data.user.speaking,
						transceiverSessionId: data.user.transceiverSessionId,
						tracks: data.user.tracks,
					}
					await this.ctx.storage.put(`session-${connection.id}`, merged)
					await this.broadcastRoomState()
					break
				}
				case 'setDisplayName': {
					const stored = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)
					if (!stored) break
					// Only ever their own name, and only the one they are hiding
					// behind until the reveal — getPublicUsers keeps it back.
					const name = data.name.trim().slice(0, MAX_NAME_LENGTH)
					if (name === stored.realName) break
					await this.ctx.storage.put(`session-${connection.id}`, {
						...stored,
						realName: name,
					} satisfies StoredUser)

					// Somebody who had no name when the meeting began was left in
					// the lobby, so the draw passed them by and their wish may be
					// on somebody else's face by now. Giving them a name is what
					// lets them in, so this is where that is put right.
					const { phase: nowPhase } = await this.getMasqueradeState()
					if (name !== '' && nowPhase !== 'lobby') {
						const set = getCharacterSet(
							await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
						)
						const taken = await this.getTakenCharacterIds(connection.id)
						if (!stored.characterId || taken.has(stored.characterId)) {
							const free = await this.pickCharacterPreference(set)
							await this.ctx.storage.put(`session-${connection.id}`, {
								...stored,
								realName: name,
								characterId: free,
								characterConfirmed: true,
							} satisfies StoredUser)
						}
						await this.takeSeat(connection.id)
					}
					await this.broadcastRoomState()
					break
				}
				case 'selectCharacter': {
					const stored = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)
					if (!stored) break
					const characterSet = getCharacterSet(
						await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
					)
					const character = getCharacter(characterSet, data.characterId)
					if (!character) break

					// Their own answer is already final: confirming is a one-way
					// door, which is what lets them tune a voice to the face.
					if (stored.characterConfirmed) break

					// In the lobby a character is a wish until somebody confirms
					// it, and several people may wish for the same one — clashes
					// are drawn for when the meeting starts. What has been
					// confirmed is gone, though, and so is everything once a
					// meeting is running and the draw has already happened.
					const { phase } = await this.getMasqueradeState()
					const unavailable =
						phase === 'lobby'
							? await this.getConfirmedCharacterIds(connection.id)
							: await this.getTakenCharacterIds(connection.id)
					if (unavailable.has(character.id)) break

					await this.ctx.storage.put(`session-${connection.id}`, {
						...stored,
						characterId: character.id,
					} satisfies StoredUser)
					await this.broadcastRoomState()
					break
				}
				case 'confirmCharacter': {
					const stored = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)
					if (!stored?.characterId) break
					if (stored.characterConfirmed) break

					// The whole race is decided here, and it is safe because a
					// Durable Object does not deliver another message while this
					// one is waiting on storage: whoever's confirm is read first
					// has already been written by the time the next one looks.
					const confirmed = await this.getConfirmedCharacterIds(connection.id)
					if (confirmed.has(stored.characterId)) {
						connection.send(
							JSON.stringify({
								type: 'characterUnavailable',
								characterId: stored.characterId,
							} satisfies ServerMessage)
						)
						break
					}

					await this.ctx.storage.put(`session-${connection.id}`, {
						...stored,
						characterConfirmed: true,
					} satisfies StoredUser)
					await this.broadcastRoomState()
					break
				}
				case 'startMeeting': {
					const hostId = await this.ensureHost()
					if (hostId !== connection.id) break
					const { phase, startAt } = await this.getMasqueradeState()
					if (phase !== 'lobby' || startAt !== undefined) break

					const users = [...(await this.getUsers()).values()]
					const characterSet = getCharacterSet(
						await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
					)
					// A masquerade the host attends alone is a person in a mask in
					// an empty room, and one with more people than faces cannot be
					// dealt. Nobody is waited on beyond that.
					if (!canStartMeeting(users, characterSet.characters.length)) break

					// Not a start: a deadline. Anybody still choosing has until it
					// falls, and whatever is unsettled by then is settled for them.
					const beginAt = Date.now() + startCountdownMs
					await this.ctx.storage.put(START_AT_KEY, beginAt)
					log({ eventName: 'meetingStarting', meetingId, startAt: beginAt })
					await this.broadcastRoomState()
					// Land an alarm exactly on the deadline, so a room nobody is
					// touching still begins on time.
					await this.scheduleNextAlarm()
					break
				}
				case 'startReveal': {
					const hostId = await this.ensureHost()
					if (hostId !== connection.id) break
					const { phase } = await this.getMasqueradeState()
					if (phase !== 'masquerade') break

					const revealAt = Date.now() + revealCountdownMs
					await this.ctx.storage.put(PHASE_KEY, 'revealing' satisfies RoomPhase)
					await this.ctx.storage.put(REVEAL_AT_KEY, revealAt)
					log({ eventName: 'revealStarted', meetingId, revealAt })
					await this.broadcastRoomState()
					// Make sure a broadcast lands the moment the masks drop, so
					// that anyone who reconnects mid-countdown is caught up.
					await this.scheduleNextAlarm()
					break
				}
				case 'restartMeeting': {
					const hostId = await this.ensureHost()
					if (hostId !== connection.id) break
					const { phase } = await this.getMasqueradeState()
					if (!canRestartMeeting(phase)) break

					// Everyone goes back to the lobby to pick again, masked once
					// more even though they have just been looking at each other's
					// faces. Registered names survive; the characters do not —
					// keeping them would hand the whole room the answer, since
					// everybody now knows who was the bear. Whoever does not
					// bother re-picking gets a face nobody can place instead.
					const users = [...(await this.getUsers()).values()]
					const characterSet = getCharacterSet(
						await this.ctx.storage.get<string>(CHARACTER_SET_KEY)
					)
					const dealt = assignCharacters(
						users.map(({ id }) => ({ id })),
						characterSet.characters.map((c) => c.id)
					)
					for (const user of users) {
						await this.ctx.storage.put(`session-${user.id}`, {
							...restartParticipant(user),
							characterId: dealt.get(user.id) ?? user.characterId,
						} satisfies StoredUser)
					}
					await this.ctx.storage.put(PHASE_KEY, 'lobby' satisfies RoomPhase)
					await this.ctx.storage.delete(REVEAL_AT_KEY)
					await this.ctx.storage.delete(START_AT_KEY)
					// A new round is dealt new faces, and gets a new seating
					// chart with them.
					await this.ctx.storage.delete(SEATS_KEY)
					log({ eventName: 'meetingRestarted', meetingId })
					await this.broadcastRoomState()
					break
				}
				case 'removeSeat': {
					const hostId = await this.ensureHost()
					if (hostId !== connection.id) break
					// Only an empty one. A seat with somebody in it is not the
					// host's to clear, and an empty seat is only empty until its
					// owner reloads their way back into it — so this is a
					// decision, not a tidy-up the room should make on its own.
					const stillHere = await this.ctx.storage.get<StoredUser>(
						`session-${data.seatId}`
					)
					if (stillHere) break
					const seats = await this.getSeats()
					if (!seats.includes(data.seatId)) break
					await this.ctx.storage.put(
						SEATS_KEY,
						seats.filter((seat) => seat !== data.seatId)
					)
					await this.broadcastRoomState()
					break
				}
				case 'chatMessage': {
					// Not stored, only relayed: the log lives in the clients that
					// were in the room to hear it. Nothing is said in the lobby,
					// where there is no meeting to say it in.
					const { phase } = await this.getMasqueradeState()
					if (phase === 'lobby') break
					const body = data.body.trim().slice(0, MAX_CHAT_LENGTH)
					if (body === '') break
					await this.broadcastMessage({
						type: 'chatMessage',
						id: crypto.randomUUID(),
						// Their own id, never one they picked, and never a name.
						from: connection.id,
						body,
						at: Date.now(),
					})
					break
				}
				case 'callsApiHistoryEntry': {
					const { entry, sessionId } = data
					log({
						eventName: 'clientNegotiationRecord',
						connectionId: connection.id,
						meetingId,
						entry,
						sessionId,
					})
					break
				}
				case 'directMessage': {
					const { to, message } = data
					const fromUser = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)

					for (const otherConnection of this.getConnections<User>()) {
						if (otherConnection.id === to) {
							this.sendMessage(otherConnection, {
								type: 'directMessage',
								from: fromUser!.name,
								message,
							})
							break
						}
					}
					console.warn(
						`User with id "${to}" not found, cannot send DM from "${fromUser!.name}"`
					)
					break
				}
				case 'muteUser': {
					const user = await this.ctx.storage.get<StoredUser>(
						`session-${connection.id}`
					)
					let mutedUser = false
					for (const otherConnection of this.getConnections<User>()) {
						if (otherConnection.id === data.id) {
							const otherUser = await this.ctx.storage.get<StoredUser>(
								`session-${data.id}`
							)
							await this.ctx.storage.put(`session-${data.id}`, {
								...otherUser!,
								tracks: {
									...otherUser!.tracks,
									audioEnabled: false,
								},
							})
							this.sendMessage(otherConnection, {
								type: 'muteMic',
							})

							await this.broadcastRoomState()
							mutedUser = true
							break
						}
					}
					if (!mutedUser) {
						console.warn(
							`User with id "${data.id}" not found, cannot mute user from "${user!.name}"`
						)
					}
					break
				}

				case 'partyserver-ping': {
					// do nothing, this should never be received
					console.warn(
						"Received partyserver-ping from client. You shouldn't be seeing this message. Did you forget to enable hibernation?"
					)
					break
				}
				case 'e2eeMlsMessage': {
					// forward as-is
					this.broadcastMessage(data, connection)
					break
				}
				case 'heartbeat': {
					await this.ctx.storage.put(`heartbeat-${connection.id}`, Date.now())
					break
				}
				case 'disableAi': {
					await this.ctx.storage
						.list({
							prefix: 'ai:',
						})
						.then((map) => {
							for (const key of map.keys()) {
								this.ctx.storage.delete(key)
							}
						})
					this.broadcastRoomState()

					break
				}
				case 'enableAi': {
					await this.ctx.storage.put('ai:connectionPending', true)
					await this.ctx.storage.delete('ai:error')
					this.broadcastRoomState()

					try {
						// This session establishes a PeerConnection between Calls and OpenAI.
						// CallsNewSession thirdparty parameter must be true to be able to connect to an external WebRTC server
						const openAiSession = await CallsNewSession(
							this.env.CALLS_APP_ID,
							this.env.CALLS_APP_SECRET,
							this.env.API_EXTRA_PARAMS,
							await this.getMeetingId(),
							true
						)
						const openAiTracksResponse = await openAiSession.NewTracks({
							// No offer is provided so Calls will generate one for us
							tracks: [
								{
									location: 'local',
									trackName: 'ai-generated-voice',
									// Let it know a sendrecv transceiver is wanted to receive this track instead of a recvonly one
									bidirectionalMediaStream: true,
									// Needed to create an appropriate response
									kind: 'audio',
								},
							],
						})
						checkNewTracksResponse(openAiTracksResponse, true)

						invariant(this.env.OPENAI_MODEL_ENDPOINT)
						invariant(this.env.OPENAI_API_TOKEN)

						const params = new URLSearchParams()
						const { voice, instructions } = data
						if (voice) {
							params.set('voice', voice)
						}
						if (instructions) {
							params.set('instructions', instructions)
						}

						params.set(
							'model',
							this.env.OPENAI_MODEL_ID || defaultOpenAIModelID
						)

						// The Calls's offer is sent to OpenAI
						const openaiAnswer = await requestOpenAIService(
							openAiTracksResponse.sessionDescription ||
								({} as SessionDescription),
							this.env.OPENAI_API_TOKEN,
							this.env.OPENAI_MODEL_ENDPOINT,
							params
						)

						console.log('OpenAI answer', openaiAnswer)

						// And the negotiation is completed by setting the answer from OpenAI
						const renegotiationResponse =
							await openAiSession.Renegotiate(openaiAnswer)
						console.log('renegotiationResponse', renegotiationResponse)

						console.log('set ai:sessionId', openAiSession.sessionId)
						await this.ctx.storage.put('ai:sessionId', openAiSession.sessionId)
						await this.ctx.storage.put(
							'ai:trackName',
							openAiTracksResponse.tracks[0].trackName
						)
						await this.ctx.storage.put('ai:enabled', true)
						await this.ctx.storage.put('ai:connectionPending', false)
						this.broadcastRoomState()

						break
					} catch (error) {
						console.error(error)
						await this.ctx.storage.put('ai:connectionPending', false)
						await this.ctx.storage.put(
							'ai:error',
							'Error establishing connection with AI'
						)
						this.broadcastRoomState()
						break
					}
				}
				case 'requestAiControl': {
					const userControllingPending = await this.ctx.storage.get<string>(
						'ai:userControlling:pending'
					)
					if (userControllingPending) {
						break
					}
					await this.ctx.storage.put(
						'ai:userControlling:pending',
						connection.id
					)
					try {
						const aiSessionId =
							await this.ctx.storage.get<string>('ai:sessionId')
						invariant(aiSessionId)
						const openAiSession = new CallsSession(
							aiSessionId,
							{
								Authorization: `Bearer ${this.env.CALLS_APP_SECRET}`,
								'Content-Type': 'application/json',
							},
							`https://rtc.live.cloudflare.com/apps/${this.env.CALLS_APP_ID}`
						)

						const { track } = data

						console.log('starting exchangeStepTwo, pulling', {
							session: track.sessionId,
							trackName: track.trackName,
						})
						const exchangeStepTwo = await openAiSession.NewTracks({
							tracks: [
								{
									location: 'remote',
									sessionId: track.sessionId,
									trackName: track.trackName,
									// Let Calls to find out the actual mid value
									mid: `#ai-generated-voice`,
								},
							],
						})

						console.log('exchangeStepTwo result', exchangeStepTwo)
						checkNewTracksResponse(exchangeStepTwo)

						await this.ctx.storage.put('ai:userControlling', connection.id)
						this.broadcastRoomState()
					} finally {
						await this.ctx.storage.delete('ai:userControlling:pending')
					}
					break
				}
				case 'relenquishAiControl': {
					await this.ctx.storage.delete('ai:userControlling:pending')
					this.ctx.storage.delete('ai:userControlling')
					this.broadcastRoomState()
					break
				}
				default: {
					assertNever(data)
					break
				}
			}
		} catch (error) {
			const meetingId = await this.getMeetingId()
			log({
				eventName: 'errorHandlingMessage',
				meetingId,
				connectionId: connection.id,
				error,
			})
			assertError(error)
			// TODO: should this even be here?
			// Report any exceptions directly back to the client. As with our handleErrors() this
			// probably isn't what you'd want to do in production, but it's convenient when testing.
			this.sendMessage(connection, {
				type: 'error',
				error: error.stack,
			} satisfies ServerMessage)
		}
	}

	onError(connection: Connection, error: unknown): void | Promise<void> {
		log({
			eventName: 'onErrorHandler',
			error,
		})
		return this.getMeetingId().then((meetingId) => {
			log({
				eventName: 'onErrorHandlerDetails',
				meetingId,
				connectionId: connection.id,
				error,
			})
			this.broadcastRoomState()
		})
	}

	getUsers() {
		return this.ctx.storage.list<StoredUser>({
			prefix: 'session-',
		})
	}

	/**
	 * Normally a heartbeat tick, but during the reveal countdown we want the
	 * alarm to land exactly when the masks drop so late-joining or reconnecting
	 * clients are told about it immediately.
	 */
	async scheduleNextAlarm() {
		const phase = await this.ctx.storage.get<RoomPhase>(PHASE_KEY)
		const revealAt = await this.ctx.storage.get<number>(REVEAL_AT_KEY)
		const startAt = await this.ctx.storage.get<number>(START_AT_KEY)
		const heartbeatAt = Date.now() + alarmInterval
		const deadlines = [
			phase === 'revealing' ? revealAt : undefined,
			// A room where the host presses go and everybody then sits still
			// has nothing else to wake it, so the deadline has to.
			phase === undefined || phase === 'lobby' ? startAt : undefined,
		].filter((at): at is number => at !== undefined && at < heartbeatAt)
		await this.ctx.storage.setAlarm(Math.min(heartbeatAt, ...deadlines))
	}

	async endMeeting(meetingId: string) {
		log({ eventName: 'endingMeeting', meetingId })
		if (this.db) {
			// stamp meeting as ended
			await this.db
				.update(Meetings)
				.set({
					ended: sql`CURRENT_TIMESTAMP`,
				})
				.where(eq(Meetings.id, meetingId))
		}
		await this.ctx.storage.deleteAll()
	}

	userLeftNotification(id: string) {
		this.broadcastMessage({
			type: 'userLeftNotification',
			id,
		})
	}

	async cleanupOldConnections() {
		const meetingId = await this.getMeetingId()
		if (!meetingId) log({ eventName: 'meetingIdNotFoundInCleanup' })
		const now = Date.now()
		const users = await this.getUsers()
		let removedUsers = 0
		const connections = [...this.getConnections()]

		for (const [key, user] of users) {
			const connectionId = key.replace('session-', '')
			const heartbeat = await this.ctx.storage.get<number>(
				`heartbeat-${connectionId}`
			)
			if (heartbeat === undefined || heartbeat + alarmInterval < now) {
				this.userLeftNotification(connectionId)
				removedUsers++
				await this.ctx.storage.delete(key).catch(() => {
					console.warn(
						`Failed to delete session ${key} in cleanupOldConnections`
					)
				})

				const connection = connections.find((c) => c.id === connectionId)
				if (connection) {
					connection.close(1011)
				}
				log({ eventName: 'userTimedOut', connectionId: user.id, meetingId })
			}
		}

		const activeUserCount = (await this.getUsers()).size

		if (meetingId && activeUserCount === 0) {
			this.endMeeting(meetingId)
		} else if (removedUsers > 0) {
			await this.ensureHost()
			this.broadcastRoomState()
		}

		return activeUserCount
	}

	async alarm(): Promise<void> {
		const meetingId = await this.getMeetingId()
		log({ eventName: 'alarm', meetingId })
		const activeUserCount = await this.cleanupOldConnections()
		await this.broadcastRoomState()
		if (activeUserCount !== 0) {
			await this.scheduleNextAlarm()
		}
	}
}
