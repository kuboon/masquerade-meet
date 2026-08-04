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
 * The one place that decides whether the lobby may hand over to the meeting.
 *
 * The Durable Object enforces this and the lobby UI reads it to decide
 * whether the start button is live, so the button never promises something
 * the room will then refuse.
 */
export function canStartMeeting(
	participants: { ready: boolean }[],
	/** how many characters the room's set has to hand out */
	capacity: number
): boolean {
	return (
		participants.length >= minimumParticipants &&
		participants.length <= capacity &&
		participants.every((u) => u.ready)
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
	T extends {
		ready: boolean
		joined: boolean
		raisedHand: boolean
		speaking: boolean
	},
>(user: T): T {
	return {
		...user,
		ready: false,
		joined: false,
		raisedHand: false,
		speaking: false,
	}
}

/**
 * Turns everyone's preferred character into an assignment nobody shares.
 *
 * People pick freely in the lobby — being told "already taken" while
 * waiting is a poor welcome, and it hands an advantage to whoever clicked
 * first. Instead the clash is settled here, once, when the meeting starts:
 * the order is shuffled, first come first served within that order, and
 * anyone who loses their pick gets one of the characters still going.
 *
 * `random` is injectable so the outcome can be tested; it is `Math.random`
 * in the Durable Object.
 */
export function assignCharacters(
	participants: { id: string; characterId?: string }[],
	characterIds: string[],
	random: () => number = Math.random
): Map<string, string> {
	const order = [...participants]
	// Fisher-Yates: without it the map's insertion order would decide every
	// clash, which is "whoever connected first" wearing a disguise.
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[order[i], order[j]] = [order[j], order[i]]
	}

	const remaining = new Set(characterIds)
	const assigned = new Map<string, string>()
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
