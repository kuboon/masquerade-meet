/**
 * The character sets a room can hide behind, and how to look one up.
 *
 * A room pins its set on the first connection and keeps it for good, so a
 * set id and a character id are PERMANENT ONCE DEPLOYED. Renaming either
 * strands every room that is already running: `getCharacterSet` falls back
 * to the default set, the pinned character ids stop resolving, and everyone
 * turns into '???' with no avatar. Add new sets instead of editing old ones.
 *
 * Character ids only have to be unique within a set — the room stores the
 * set id and the character id separately, so `robots/bear` and
 * `animals/bear` are different characters.
 */

import type { Character, CharacterSet } from '~/utils/characters'
import animals from './animals'

export const characterSets: CharacterSet[] = [animals]

/**
 * What a room gets when it does not say otherwise: rooms created before
 * character sets existed, and clients talking to a Durable Object that has
 * not been redeployed yet, both land here and must see the original fifteen.
 */
export const defaultCharacterSetId = animals.id

const setsById = new Map(characterSets.map((set) => [set.id, set]))
const charactersBySet = new Map(
	characterSets.map((set) => [
		set.id,
		new Map(set.characters.map((character) => [character.id, character])),
	])
)

export function isCharacterSetId(id: unknown): id is string {
	return typeof id === 'string' && setsById.has(id)
}

/** Never throws and never returns undefined; unknown ids fall back. */
export function getCharacterSet(id?: string | null): CharacterSet {
	const found = id == null ? undefined : setsById.get(id)
	return found ?? setsById.get(defaultCharacterSetId)!
}

/**
 * Takes the set itself rather than its id: every caller already has the
 * resolved set, and passing the object makes it impossible to look a
 * character up in the wrong roster.
 */
export function getCharacter(
	set: CharacterSet,
	id?: string
): Character | undefined {
	return id === undefined ? undefined : charactersBySet.get(set.id)?.get(id)
}
