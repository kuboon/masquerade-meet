import type { User } from '~/types/Messages'

export const screenshareSuffix = '_screenshare'

/**
 * One place on the stage.
 *
 * A tile is a seat first and a person second: the grid is built from the
 * room's seating chart, so it keeps its shape whether or not anybody is
 * sitting there.
 */
export type Tile = { id: string; user?: User }

/** A user's screenshare as a tile of its own, beside their own. */
export function screenshareTile(user: User): User {
	return {
		...user,
		id: user.id + screenshareSuffix,
		tracks: {
			...user.tracks,
			video: user.tracks.screenshare,
			videoEnabled: user.tracks.screenShareEnabled,
		},
	}
}

/**
 * The stage, in the order the room decided.
 *
 * Every seat gets a tile, empty or not, and in the same order on every
 * screen. Anybody the chart does not know about — the AI, or somebody who
 * arrived in the moment between being let in and being seated — goes on the
 * end rather than being dropped.
 */
export function stageTiles(seats: string[], users: User[]): Tile[] {
	const present = new Map(users.filter((u) => u.joined).map((u) => [u.id, u]))
	return [
		...seats.map((id) => ({ id, user: present.get(id) })),
		...[...present.values()]
			.filter((u) => !seats.includes(u.id))
			.map((user) => ({ id: user.id, user })),
	]
}
