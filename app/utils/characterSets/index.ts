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
import circus from './circus'

export const characterSets: CharacterSet[] = [animals, circus]

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
	if (id === undefined) return undefined
	// The index is only good for the sets it was built from. A room can be
	// wearing a roster fetched from somebody else's site, and one of those
	// answering to a built-in id must not be served out of the built-in
	// roster of that name — hence identity rather than the id alone.
	if (setsById.get(set.id) === set) return charactersBySet.get(set.id)?.get(id)
	return set.characters.find((character) => character.id === id)
}

/**
 * The roster a room is wearing, given what the room said and what it sent.
 *
 * A borrowed roster arrives on its own message and answers to the address it
 * was fetched from, so this is not "prefer the delivered one": it is the room
 * naming a roster and this client checking it holds that one. A `delivered`
 * that does not match is from some other room or some other moment and is
 * ignored, which leaves the built-in fallback — never nothing.
 */
export function roomCharacterSet(
	characterSetId: string | undefined,
	delivered: CharacterSet | undefined
): CharacterSet {
	return delivered !== undefined && delivered.id === characterSetId
		? delivered
		: getCharacterSet(characterSetId)
}

/** Whether this roster is one of ours, or one a room fetched from elsewhere. */
export function isBuiltInSet(set: CharacterSet): boolean {
	return setsById.get(set.id) === set
}
