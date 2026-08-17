import { describe, expect, it } from 'vitest'
import {
	dealRoles,
	dealtDeck,
	maxRoleCount,
	maxRoleLength,
	parseRoleDeck,
	roleTally,
} from './roles'

describe('parseRoleDeck', () => {
	it('reads a line of cards', () => {
		expect(parseRoleDeck('人狼 占い師 村人')).toEqual([
			'人狼',
			'占い師',
			'村人',
		])
	})

	it('reads the space a Japanese keyboard actually produces', () => {
		// The point of the field is pasting a line prepared somewhere else, and
		// that line will be full of U+3000 rather than U+0020.
		expect(parseRoleDeck('人狼　占い師　村人')).toEqual([
			'人狼',
			'占い師',
			'村人',
		])
	})

	it('does not mind how it was spaced', () => {
		expect(parseRoleDeck('  人狼   　 占い師\n村人  ')).toEqual([
			'人狼',
			'占い師',
			'村人',
		])
	})

	it('keeps duplicates', () => {
		// Two werewolves is a different game from one, and collapsing the deck
		// into a set would quietly play the other one.
		expect(parseRoleDeck('人狼 人狼 村人')).toEqual(['人狼', '人狼', '村人'])
	})

	it('has nothing to say about an empty field', () => {
		expect(parseRoleDeck('')).toEqual([])
		expect(parseRoleDeck('   　 ')).toEqual([])
	})

	it('cuts a card down to something that fits on a tile', () => {
		const long = 'あ'.repeat(maxRoleLength + 10)
		expect(parseRoleDeck(long)).toEqual(['あ'.repeat(maxRoleLength)])
	})

	it('stops counting somewhere', () => {
		const many = Array.from({ length: maxRoleCount + 5 }, (_, i) => `役${i}`)
		expect(parseRoleDeck(many.join(' '))).toHaveLength(maxRoleCount)
	})
})

describe('dealtDeck', () => {
	const deck = ['人狼', '占い師', '村人']

	it('repeats the last card to fill the table', () => {
		expect(dealtDeck(deck, 6)).toEqual([
			'人狼',
			'占い師',
			'村人',
			'村人',
			'村人',
			'村人',
		])
	})

	it('leaves the tail of the deck unused at a small table', () => {
		expect(dealtDeck(deck, 2)).toEqual(['人狼', '占い師'])
	})

	it('deals one each when the numbers match', () => {
		expect(dealtDeck(deck, 3)).toEqual(deck)
	})

	it('deals nothing out of an empty deck', () => {
		expect(dealtDeck([], 5)).toEqual([])
		expect(dealtDeck(deck, 0)).toEqual([])
	})
})

describe('roleTally', () => {
	it('counts the deal in the order the deck named things', () => {
		expect(roleTally(['人狼', '占い師', '村人', '村人'])).toEqual([
			{ role: '人狼', count: 1 },
			{ role: '占い師', count: 1 },
			{ role: '村人', count: 2 },
		])
	})

	it('has nothing to count in an empty deal', () => {
		expect(roleTally([])).toEqual([])
	})
})

describe('dealRoles', () => {
	const deck = ['人狼', '占い師', '村人']
	const players = ['a', 'b', 'c', 'd']

	it('gives everybody exactly one card', () => {
		const dealt = dealRoles({ players, deck })
		expect(dealt.size).toBe(4)
		expect([...dealt.values()].filter((r) => r === '人狼')).toHaveLength(1)
		expect([...dealt.values()].filter((r) => r === '占い師')).toHaveLength(1)
		expect([...dealt.values()].filter((r) => r === '村人')).toHaveLength(2)
	})

	it('deals nothing at all without a deck', () => {
		// Which is every room that is not playing a game, and the whole
		// feature has to be invisible in those.
		expect(dealRoles({ players, deck: [] }).size).toBe(0)
	})

	it('honours what the game master asked for', () => {
		const dealt = dealRoles({ players, deck, plan: { c: '人狼', a: '占い師' } })
		expect(dealt.get('c')).toBe('人狼')
		expect(dealt.get('a')).toBe('占い師')
		expect(dealt.get('b')).toBe('村人')
		expect(dealt.get('d')).toBe('村人')
	})

	it('puts somebody back in the draw rather than inventing a card', () => {
		// Three people promised the one werewolf. Two of them cannot have it,
		// and the room has no third one to make up.
		const dealt = dealRoles({
			players,
			deck,
			plan: { a: '人狼', b: '人狼', c: '人狼' },
		})
		expect([...dealt.values()].filter((r) => r === '人狼')).toHaveLength(1)
		expect(dealt.size).toBe(4)
	})

	it('ignores a plan naming a card that is not in the deck', () => {
		const dealt = dealRoles({ players, deck, plan: { a: '怪盗' } })
		expect(dealt.get('a')).not.toBe('怪盗')
		expect(deck).toContain(dealt.get('a'))
	})

	it('ignores a plan naming somebody who is not playing', () => {
		// The game master's own list, filled in before somebody left.
		const dealt = dealRoles({ players, deck, plan: { gone: '人狼' } })
		expect(dealt.has('gone')).toBe(false)
		expect([...dealt.values()].filter((r) => r === '人狼')).toHaveLength(1)
	})

	it('does not always hand the first card to the first player', () => {
		// The caller's order is "whoever connected first", and pairing that
		// against the deck unshuffled would make the same person the werewolf
		// every single game.
		const werewolves = new Set<string>()
		for (let i = 0; i < 50; i++) {
			const dealt = dealRoles({ players, deck })
			for (const [id, role] of dealt) if (role === '人狼') werewolves.add(id)
		}
		expect(werewolves.size).toBeGreaterThan(1)
	})

	it('leaves the draw alone when the plan settles everybody', () => {
		let consulted = 0
		const dealt = dealRoles({
			players: ['a', 'b', 'c'],
			deck,
			plan: { a: '村人', b: '占い師', c: '人狼' },
			random: () => {
				consulted++
				return 0
			},
		})
		expect(consulted).toBe(0)
		expect(dealt.get('c')).toBe('人狼')
	})
})
