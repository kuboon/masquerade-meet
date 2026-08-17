import { shuffled } from './masquerade'

/**
 * The slips of paper a game master hands out: 人狼, 占い師, 村人.
 *
 * The room knows nothing about any particular game. A deck is whatever words
 * the host typed, dealt one per player, and the only rule the room enforces
 * is that everybody gets exactly one and nobody sees anybody else's.
 *
 * Kept here rather than in the Durable Object because the lobby quotes the
 * deal back before it happens — 「6人なら 人狼1 占い師1 村人4」 — and a preview
 * that disagrees with the deal would be worse than no preview at all.
 */

/** Long enough for 「パン屋」 or 「怪盗」, short enough to sit on a tile. */
export const maxRoleLength = 16

/** More cards than any table needs, and a bound on what one message stores. */
export const maxRoleCount = 40

/**
 * The deck as typed: words separated by spaces.
 *
 * `\s` covers the ideographic space a Japanese keyboard produces as well as
 * the ASCII one, which matters because the whole point of the field is
 * pasting a line prepared somewhere else.
 *
 * Duplicates are kept. 「人狼 人狼 村人」 is two werewolves, and collapsing
 * that into a set would quietly change the game.
 */
export function parseRoleDeck(text: string): string[] {
	return text
		.split(/\s+/)
		.map((card) => card.slice(0, maxRoleLength))
		.filter((card) => card !== '')
		.slice(0, maxRoleCount)
}

/**
 * The cards actually going out, one per player.
 *
 * The last card is the one that repeats: 「人狼 占い師 村人」 at a table of six
 * is one werewolf, one seer and four villagers. That way round because the
 * cards worth naming are the ones you write first, and what a bigger table
 * needs more of is the filler at the end.
 *
 * A table smaller than the deck simply leaves the tail unused.
 */
export function dealtDeck(deck: string[], playerCount: number): string[] {
	if (deck.length === 0 || playerCount <= 0) return []
	return Array.from(
		{ length: playerCount },
		(_, i) => deck[Math.min(i, deck.length - 1)]
	)
}

/** The deal counted up, in the deck's own order, for the lobby to quote. */
export function roleTally(cards: string[]): { role: string; count: number }[] {
	const tally: { role: string; count: number }[] = []
	for (const card of cards) {
		const seen = tally.find((entry) => entry.role === card)
		if (seen) seen.count++
		else tally.push({ role: card, count: 1 })
	}
	return tally
}

/**
 * Who ends up holding what.
 *
 * `plan` is the game master saying so in advance, by connection id. It is
 * honoured first and only while the deal has that card left to give — asking
 * for a third werewolf out of a deck with two is not a request the room can
 * grant, so that player goes back into the draw rather than the room
 * inventing a card.
 *
 * Everyone else is shuffled and dealt what is left. The shuffle is the whole
 * of the fairness here: the caller's order is "whoever connected first", and
 * the pool is in deck order, so pairing them up unshuffled would hand the
 * first arrival the first card every single game.
 *
 * The game master is not in `players`. They deal, they do not play, which is
 * also why their voice is never disguised.
 */
export function dealRoles({
	players,
	deck,
	plan = {},
	random = Math.random,
}: {
	/** connection ids, game master excluded */
	players: string[]
	deck: string[]
	plan?: Record<string, string>
	random?: () => number
}): Map<string, string> {
	const pool = dealtDeck(deck, players.length)
	const dealt = new Map<string, string>()
	const undecided: string[] = []

	for (const id of players) {
		const wanted = plan[id]
		const index = wanted === undefined ? -1 : pool.indexOf(wanted)
		if (index === -1) {
			undecided.push(id)
			continue
		}
		pool.splice(index, 1)
		dealt.set(id, wanted)
	}

	for (const id of shuffled(undecided, random)) {
		const card = pool.shift()
		if (card === undefined) break
		dealt.set(id, card)
	}

	return dealt
}
