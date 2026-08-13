import type { RoomPhase } from '~/types/Messages'

/**
 * How many people have to be in the lobby before the host can start.
 *
 * A disguise needs somebody to be disguised from — a meeting of one is just
 * a person wearing a mask alone in a room. Two is the smallest number that
 * makes the premise work.
 */
export const minimumParticipants = 2

/**
 * How long everyone has once the host says go.
 *
 * Long enough to finish choosing a character, short enough that nobody is
 * waited on. A character and a voice can both be settled for somebody who
 * runs out of time; a name cannot, which is why the name is the one thing
 * asked for up front.
 *
 * Shared rather than living in the Durable Object, because the lobby quotes
 * the number back and the two must not drift.
 */
export const startCountdownMs = 10_000

/**
 * The one place that decides whether the host may set the meeting going.
 *
 * It no longer waits for anybody. A masquerade the host attends alone is a
 * person in a mask in an empty room, and one with more people than faces
 * cannot be dealt — but beyond that, whoever is still choosing has until the
 * deadline, and whatever they have not settled is settled for them.
 *
 * The Durable Object enforces this and the lobby UI reads it to decide
 * whether the start button is live, so the button never promises something
 * the room will then refuse.
 */
export function canStartMeeting(
	participants: unknown[],
	/** how many characters the room's set has to hand out */
	capacity: number
): boolean {
	return (
		participants.length >= minimumParticipants &&
		participants.length <= capacity
	)
}

/**
 * Whether the host may send everyone back to the lobby for another round.
 *
 * Any time a meeting is running, not only after the reveal: a round that is
 * going wrong — the wrong people, a character nobody can hear — is worth
 * restarting before the payoff, not after it. Only the lobby is excluded,
 * because that is already where restarting puts everyone. Interrupting the
 * countdown is allowed too; the phase going back to lobby resets it, so
 * nobody is left half unmasked.
 *
 * Shared with the button so it cannot offer what the room would refuse.
 */
export function canRestartMeeting(phase: RoomPhase): boolean {
	return phase !== 'lobby'
}

/**
 * Who takes over the host controls when the host is gone.
 *
 * The longest-standing participant: they have seen the most of the room, and
 * of the arbitrary rules available it is the one people can predict. Ties, and
 * seats from before arrival times were recorded, fall back to the order the
 * room hands them over in — a seat with no arrival time belongs to somebody
 * who has not been seen since the room last restarted, so it goes last rather
 * than inheriting the room.
 */
export function nextHost<T extends { joinedAt?: number }>(
	users: T[]
): T | undefined {
	let earliest: T | undefined
	for (const user of users) {
		if (
			earliest === undefined ||
			(user.joinedAt ?? Infinity) < (earliest.joinedAt ?? Infinity)
		) {
			earliest = user
		}
	}
	return earliest
}

/**
 * A participant as they go back into the lobby for another round.
 *
 * Everything about the round that just finished is dropped, but the name
 * they registered is not, so nobody has to type theirs in again. The
 * character is dealt afresh by the caller rather than kept: everyone has
 * just seen who was wearing what.
 */
export function restartParticipant<
	T extends { joined: boolean; raisedHand: boolean; speaking: boolean },
>(user: T): T {
	return {
		...user,
		joined: false,
		raisedHand: false,
		speaking: false,
		// A new round is a new draw, so nothing is taken yet. The caller deals
		// fresh characters; this only makes sure nobody is still holding a
		// claim on one from last time.
		characterConfirmed: false,
	}
}

/**
 * Whether somebody's microphone goes out as their own voice.
 *
 * Two cases, and no others. After the reveal there is nothing left to hide.
 * And the host while the room is still in the lobby, so that whoever is
 * running it can tell everyone what is about to happen — at the price of
 * their own reveal, which is theirs to pay and nobody else's, and which is
 * why they have to ask for it rather than find they have already spent it.
 *
 * Everything else is disguised, the host included from the moment the phase
 * leaves the lobby. That happens when the start deadline falls, which is
 * before anybody is carried into the room.
 *
 * Kept here, apart from the audio graph it drives, because getting it wrong
 * is not a bug you can hear until somebody has already been recognised.
 */
export function speaksUndisguised({
	phase,
	revealed,
	isHost,
	speakingInLobby,
}: {
	phase: RoomPhase
	/** true once this client has actually dropped its disguise */
	revealed: boolean
	isHost: boolean
	/** the host has asked to be heard as themselves while waiting */
	speakingInLobby: boolean
}): boolean {
	return revealed || (isHost && phase === 'lobby' && speakingInLobby)
}

/**
 * A copy in a random order. Fisher-Yates, with the source of randomness
 * injectable so the outcome can be pinned down in a test.
 */
export function shuffled<T>(
	items: T[],
	random: () => number = Math.random
): T[] {
	const order = [...items]
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[order[i], order[j]] = [order[j], order[i]]
	}
	return order
}

/**
 * Turns everyone's preferred character into an assignment nobody shares.
 *
 * Anybody who confirmed keeps what they took — that is what confirming is
 * for, and by the time this runs their character is already nobody else's
 * to want. Everyone else is still holding a wish, and wishes may clash: the
 * order is shuffled, first come first served within that order, and whoever
 * loses gets one of the characters still going. Shuffling matters because
 * insertion order is "whoever connected first", and that should not decide
 * who gets the face they wanted.
 *
 * `random` is injectable so the outcome can be tested; it is `Math.random`
 * in the Durable Object.
 */
export function assignCharacters(
	participants: {
		id: string
		characterId?: string
		characterConfirmed?: boolean
	}[],
	characterIds: string[],
	random: () => number = Math.random
): Map<string, string> {
	const remaining = new Set(characterIds)
	const assigned = new Map<string, string>()

	// Settled first, and out of the pool before anybody draws from it.
	const undecided: typeof participants = []
	for (const participant of participants) {
		if (participant.characterConfirmed && participant.characterId) {
			remaining.delete(participant.characterId)
			assigned.set(participant.id, participant.characterId)
		} else {
			undecided.push(participant)
		}
	}

	const order = shuffled(undecided, random)
	const unlucky: typeof order = []

	for (const participant of order) {
		const wanted = participant.characterId
		if (wanted !== undefined && remaining.has(wanted)) {
			remaining.delete(wanted)
			assigned.set(participant.id, wanted)
		} else {
			unlucky.push(participant)
		}
	}

	for (const participant of unlucky) {
		const pool = [...remaining]
		if (pool.length === 0) break
		const pick = pool[Math.floor(random() * pool.length)]
		remaining.delete(pick)
		assigned.set(participant.id, pick)
	}

	return assigned
}
