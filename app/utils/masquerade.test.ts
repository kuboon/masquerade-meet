import { describe, expect, it } from 'vitest'
import {
	assignCharacters,
	canStartMeeting,
	minimumParticipants,
} from './masquerade'

const ready = (count: number) =>
	Array.from({ length: count }, () => ({ ready: true }))

const CAPACITY = 15

describe('canStartMeeting', () => {
	it('refuses an empty lobby', () => {
		expect(canStartMeeting([], CAPACITY)).toBe(false)
	})

	it('refuses a host who is on their own, however ready they are', () => {
		expect(canStartMeeting(ready(1), CAPACITY)).toBe(false)
	})

	it('allows the meeting once the minimum is met and everyone is ready', () => {
		expect(canStartMeeting(ready(minimumParticipants), CAPACITY)).toBe(true)
		expect(canStartMeeting(ready(minimumParticipants + 3), CAPACITY)).toBe(true)
	})

	it('still waits on anyone who has not readied up', () => {
		expect(canStartMeeting([...ready(1), { ready: false }], CAPACITY)).toBe(
			false
		)
		expect(canStartMeeting([...ready(4), { ready: false }], CAPACITY)).toBe(
			false
		)
	})

	it('refuses more people than there are characters to hide behind', () => {
		expect(canStartMeeting(ready(CAPACITY), CAPACITY)).toBe(true)
		expect(canStartMeeting(ready(CAPACITY + 1), CAPACITY)).toBe(false)
	})
})

describe('assignCharacters', () => {
	const ids = ['bear', 'rabbit', 'fox', 'cat']
	// Always picks the first of whatever it is choosing from, which makes the
	// shuffle a no-op and the tie-break deterministic.
	const first = () => 0

	it('gives everyone the character they asked for when nobody clashes', () => {
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear' },
				{ id: 'b', characterId: 'fox' },
			],
			ids,
			first
		)
		expect(assigned.get('a')).toBe('bear')
		expect(assigned.get('b')).toBe('fox')
	})

	it('gives a contested character to exactly one of the people who wanted it', () => {
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear' },
				{ id: 'b', characterId: 'bear' },
				{ id: 'c', characterId: 'bear' },
			],
			ids,
			first
		)
		const winners = ['a', 'b', 'c'].filter(
			(id) => assigned.get(id) === 'bear'
		).length
		expect(winners).toBe(1)
	})

	it('still finds a character for everyone who lost the toss', () => {
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear' },
				{ id: 'b', characterId: 'bear' },
				{ id: 'c' },
			],
			ids,
			first
		)
		expect(assigned.size).toBe(3)
		expect(new Set(assigned.values()).size).toBe(3)
		for (const value of assigned.values()) expect(ids).toContain(value)
	})

	it('never hands the same character to two people', () => {
		// Everybody wants the bear; the room has four faces and four people.
		const assigned = assignCharacters(
			['a', 'b', 'c', 'd'].map((id) => ({ id, characterId: 'bear' })),
			ids
		)
		expect(assigned.size).toBe(4)
		expect(new Set(assigned.values()).size).toBe(4)
	})

	it('leaves people out rather than doubling up when the set is too small', () => {
		const assigned = assignCharacters(
			['a', 'b', 'c'].map((id) => ({ id })),
			['bear', 'fox']
		)
		expect(assigned.size).toBe(2)
		expect(new Set(assigned.values()).size).toBe(2)
	})

	it('does not always settle a clash the same way', () => {
		// The shuffle is the only thing standing between "first connection
		// wins every time" and a fair draw, so it is worth pinning down.
		const winners = new Set<string>()
		for (let i = 0; i < 50; i++) {
			const assigned = assignCharacters(
				[
					{ id: 'a', characterId: 'bear' },
					{ id: 'b', characterId: 'bear' },
				],
				ids
			)
			winners.add(assigned.get('a') === 'bear' ? 'a' : 'b')
		}
		expect(winners.size).toBe(2)
	})
})
