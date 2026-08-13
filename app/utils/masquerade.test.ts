import { describe, expect, it } from 'vitest'
import {
	assignCharacters,
	canRestartMeeting,
	canStartMeeting,
	minimumParticipants,
	nextHost,
	restartParticipant,
	speaksUndisguised,
} from './masquerade'

const CAPACITY = 15

describe('canStartMeeting', () => {
	const people = (count: number) => Array.from({ length: count }, () => ({}))

	it('refuses an empty lobby', () => {
		expect(canStartMeeting([], CAPACITY)).toBe(false)
	})

	it('refuses a host who is on their own', () => {
		expect(canStartMeeting(people(1), CAPACITY)).toBe(false)
	})

	it('allows the meeting once the minimum is met', () => {
		expect(canStartMeeting(people(minimumParticipants), CAPACITY)).toBe(true)
		expect(canStartMeeting(people(minimumParticipants + 3), CAPACITY)).toBe(
			true
		)
	})

	it('waits for nobody', () => {
		// The gate used to require everyone to have readied up, which let one
		// person who had wandered off hold up the room. Whoever is still
		// choosing has until the deadline instead.
		expect(canStartMeeting(people(5), CAPACITY)).toBe(true)
	})

	it('refuses more people than there are characters to hide behind', () => {
		expect(canStartMeeting(people(CAPACITY), CAPACITY)).toBe(true)
		expect(canStartMeeting(people(CAPACITY + 1), CAPACITY)).toBe(false)
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
		joined: true,
		raisedHand: true,
		speaking: true,
	}

	it('puts everyone back to square one for the next round', () => {
		expect(restartParticipant(veteran)).toMatchObject({
			joined: false,
			raisedHand: false,
			speaking: false,
		})
	})

	it('lets go of the character they had taken', () => {
		// The next round deals fresh faces, so a claim from the last one would
		// keep a character out of the draw for nobody's benefit.
		expect(
			restartParticipant({ ...veteran, characterConfirmed: true })
				.characterConfirmed
		).toBe(false)
	})

	it('keeps who they are', () => {
		// Losing the name would make the lobby demand one again from people who
		// are already sitting in it, and leave them behind at the next start if
		// they did not notice. The character is the room's to deal, not this
		// function's.
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

	it('leaves a confirmed character where it is', () => {
		// Confirming is the promise the lobby makes: nothing after it can take
		// the face away, least of all the draw.
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear', characterConfirmed: true },
				{ id: 'b', characterId: 'fox' },
			],
			ids,
			first
		)
		expect(assigned.get('a')).toBe('bear')
	})

	it('will not deal a confirmed character to anybody else', () => {
		// Somebody still wishing for it has already lost; they get something
		// else rather than a second copy of a face that is spoken for.
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear', characterConfirmed: true },
				{ id: 'b', characterId: 'bear' },
				{ id: 'c', characterId: 'bear' },
			],
			ids,
			first
		)
		expect(assigned.get('a')).toBe('bear')
		expect(assigned.get('b')).not.toBe('bear')
		expect(assigned.get('c')).not.toBe('bear')
		expect(new Set(assigned.values()).size).toBe(3)
	})

	it('does not let the shuffle reach somebody who has confirmed', () => {
		// With every character confirmed there is nothing to draw for, so the
		// source of randomness should never be consulted at all.
		let consulted = 0
		const assigned = assignCharacters(
			[
				{ id: 'a', characterId: 'bear', characterConfirmed: true },
				{ id: 'b', characterId: 'fox', characterConfirmed: true },
			],
			ids,
			() => {
				consulted++
				return 0
			}
		)
		expect(consulted).toBe(0)
		expect(assigned.get('a')).toBe('bear')
		expect(assigned.get('b')).toBe('fox')
	})

	it('ignores a confirmation with no character behind it', () => {
		// Storage from before confirming existed, or a client sending
		// nonsense. Either way they go back in the draw rather than being
		// dealt undefined.
		const assigned = assignCharacters(
			[{ id: 'a', characterConfirmed: true }],
			ids,
			first
		)
		expect(ids).toContain(assigned.get('a'))
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

describe('speaksUndisguised', () => {
	const guest = {
		phase: 'lobby' as const,
		revealed: false,
		isHost: false,
		speakingInLobby: false,
	}
	const host = { ...guest, isHost: true, speakingInLobby: true }

	it('lets the host be heard while the room is still waiting', () => {
		// Somebody has to be able to say what is about to happen, and a mask
		// is in the way of that.
		expect(speaksUndisguised(host)).toBe(true)
	})

	it('waits for the host to ask', () => {
		// The default has to be silence: this is the one place an unprocessed
		// microphone leaves the browser, and it spends the host's own reveal.
		// Nobody should find they have paid that without choosing to.
		expect(speaksUndisguised({ ...host, speakingInLobby: false })).toBe(false)
	})

	it('does not let anybody else ask', () => {
		// The switch is only offered to the host, but the rule is what makes
		// that true rather than a matter of which component got rendered.
		expect(speaksUndisguised({ ...guest, speakingInLobby: true })).toBe(false)
	})

	it('keeps everybody else disguised in the lobby', () => {
		// Their microphone reaches nobody there either, but the disguise is
		// what makes that safe rather than incidental.
		expect(speaksUndisguised(guest)).toBe(false)
	})

	it('puts the host back behind the mask once the meeting starts', () => {
		// The phase leaves the lobby when the start deadline falls, which is
		// before anybody is carried into the room — so this is what stops the
		// host walking in still sounding like themselves.
		expect(speaksUndisguised({ ...host, phase: 'masquerade' })).toBe(false)
		expect(speaksUndisguised({ ...host, phase: 'revealing' })).toBe(false)
	})

	it("drops everyone's disguise at the reveal", () => {
		// Regardless of the switch, which by then is about a room nobody is in.
		expect(speaksUndisguised({ ...guest, revealed: true })).toBe(true)
		expect(
			speaksUndisguised({ ...host, phase: 'revealed', revealed: true })
		).toBe(true)
	})

	it('waits for this client to catch up with the phase', () => {
		// `revealed` is the local countdown having elapsed, not the room's
		// announcement. Reading the phase instead would take the mask off
		// early for whoever heard about it first.
		expect(
			speaksUndisguised({ ...guest, phase: 'revealed', revealed: false })
		).toBe(false)
	})
})
