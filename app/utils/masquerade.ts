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
export function canStartMeeting(participants: { ready: boolean }[]): boolean {
	return (
		participants.length >= minimumParticipants &&
		participants.every((u) => u.ready)
	)
}
