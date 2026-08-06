import { describe, expect, it } from 'vitest'
import type { User } from '~/types/Messages'
import { stageTiles } from './stage'

const user = (id: string, joined = true) =>
	({
		id,
		name: id,
		joined,
		raisedHand: false,
		speaking: false,
		tracks: { audioUnavailable: false },
	}) satisfies User

describe('stageTiles', () => {
	it('follows the seating chart, not the roster', () => {
		// The roster arrives in whatever order the room stored it; the chart is
		// what every screen has in common.
		const tiles = stageTiles(['c', 'a', 'b'], [user('a'), user('b'), user('c')])
		expect(tiles.map((t) => t.id)).toEqual(['c', 'a', 'b'])
	})

	it('keeps the seat of somebody who has gone', () => {
		const tiles = stageTiles(['a', 'b', 'c'], [user('a'), user('c')])
		expect(tiles.map((t) => t.id)).toEqual(['a', 'b', 'c'])
		expect(tiles[1].user).toBeUndefined()
		// The point of the empty frame: 'c' does not slide into 'b'.
		expect(tiles[2].user?.id).toBe('c')
	})

	it('gives somebody back the seat they left', () => {
		const seats = ['a', 'b', 'c']
		const away = stageTiles(seats, [user('a'), user('c')])
		const back = stageTiles(seats, [user('a'), user('b'), user('c')])
		expect(away.map((t) => t.id)).toEqual(back.map((t) => t.id))
		expect(back[1].user?.id).toBe('b')
	})

	it('treats somebody still in the lobby as away', () => {
		// Reloading drops you back to the lobby for a moment. The seat waits.
		const tiles = stageTiles(['a', 'b'], [user('a'), user('b', false)])
		expect(tiles[1].user).toBeUndefined()
	})

	it('seats a stranger at the end rather than dropping them', () => {
		// The AI has no seat on the chart, and nor does anybody who walks in
		// during the moment before the room seats them.
		const tiles = stageTiles(['a'], [user('a'), user('ai')])
		expect(tiles.map((t) => t.id)).toEqual(['a', 'ai'])
	})

	it('has nothing to show for a chart nobody is on', () => {
		expect(stageTiles([], [])).toEqual([])
	})
})
