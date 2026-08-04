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
