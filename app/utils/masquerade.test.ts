import { describe, expect, it } from 'vitest'
import {
	assignCharacters,
	canRestartMeeting,
	canStartMeeting,
	minimumParticipants,
	nextHost,
	restartParticipant,
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

describe('canRestartMeeting', () => {
	it('offers another round at any point in a meeting', () => {
		// Including before the reveal: a round that is going wrong is worth
		// restarting without sitting through the payoff first.
		expect(canRestartMeeting('masquerade')).toBe(true)
		expect(canRestartMeeting('revealing')).toBe(true)
		expect(canRestartMeeting('revealed')).toBe(true)
	})

	it('has nothing to offer in the lobby', () => {
		expect(canRestartMeeting('lobby')).toBe(false)
	})
})

describe('nextHost', () => {
	it('hands the room to whoever has been in it longest', () => {
		// Not the order they happen to be stored in: seats are keyed by a
		// random connection id, so storage order is a coin toss.
		expect(
			nextHost([
				{ id: 'c', joinedAt: 300 },
				{ id: 'a', joinedAt: 100 },
				{ id: 'b', joinedAt: 200 },
			])?.id
		).toBe('a')
	})

	it('has nobody to promote in an empty room', () => {
		expect(nextHost([])).toBeUndefined()
	})

	it('promotes a seat with no arrival time only as a last resort', () => {
		// Those are seats from before arrival times were recorded, belonging to
		// someone not seen since the room last restarted.
		const legacy: { id: string; joinedAt?: number }[] = [{ id: 'old' }]
		expect(nextHost([...legacy, { id: 'a', joinedAt: 100 }])?.id).toBe('a')
		expect(nextHost(legacy)?.id).toBe('old')
	})

	it('settles a tie the same way every time', () => {
		const tied = [
			{ id: 'a', joinedAt: 100 },
			{ id: 'b', joinedAt: 100 },
		]
		expect(nextHost(tied)?.id).toBe('a')
		expect(nextHost([...tied])?.id).toBe('a')
	})
})

describe('restartParticipant', () => {
	const veteran = {
		id: 'a',
		realName: '本名',
		name: 'くまごろう',
		characterId: 'bear',
		ready: true,
		joined: true,
		raisedHand: true,
		speaking: true,
	}

	it('puts everyone back to square one for the next round', () => {
		expect(restartParticipant(veteran)).toMatchObject({
			ready: false,
			joined: false,
			raisedHand: false,
			speaking: false,
		})
	})

	it('keeps who they are', () => {
		// Losing the name would make the lobby demand one again from people who
		// are already sitting in it, and refuse to let them ready up until they
		// noticed. The character is the room's to deal, not this function's.
		const restarted = restartParticipant(veteran)
		expect(restarted.realName).toBe('本名')
		expect(restarted.id).toBe('a')
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
