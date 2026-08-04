import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	characterSets,
	defaultCharacterSetId,
	getCharacter,
	getCharacterSet,
	isCharacterSetId,
} from './index'

describe('the character set registry', () => {
	it('gives every set a unique, url-safe id', () => {
		for (const set of characterSets) {
			expect(set.id, set.name).toMatch(/^[a-z0-9-]+$/)
		}
		expect(new Set(characterSets.map((s) => s.id)).size).toBe(
			characterSets.length
		)
	})

	it('points the default id at a set that exists', () => {
		expect(getCharacterSet(defaultCharacterSetId).id).toBe(
			defaultCharacterSetId
		)
	})

	it('falls back to the default set rather than failing', () => {
		// Rooms pinned before a set was renamed, and clients talking to a
		// Durable Object that predates character sets, both arrive here.
		expect(getCharacterSet(undefined).id).toBe(defaultCharacterSetId)
		expect(getCharacterSet(null).id).toBe(defaultCharacterSetId)
		expect(getCharacterSet('no-such-set').id).toBe(defaultCharacterSetId)
	})

	it('recognises only the ids it actually has', () => {
		expect(isCharacterSetId(defaultCharacterSetId)).toBe(true)
		expect(isCharacterSetId('no-such-set')).toBe(false)
		expect(isCharacterSetId(undefined)).toBe(false)
		expect(isCharacterSetId(42)).toBe(false)
	})

	it('keeps the ids the original rooms were pinned to', () => {
		// Renaming either of these strands every room already in storage.
		expect(defaultCharacterSetId).toBe('animals')
		expect(getCharacter(getCharacterSet('animals'), 'bear')?.name).toBe(
			'くまごろう'
		)
	})

	it('looks characters up inside their own set', () => {
		const set = getCharacterSet(defaultCharacterSetId)
		expect(getCharacter(set, 'nobody')).toBeUndefined()
		expect(getCharacter(set, undefined)).toBeUndefined()
	})
})

// Character ids only have to be unique *within* a set — a room stores the set
// id and the character id separately, so two sets may both have a 'bear'.
for (const set of characterSets) {
	describe(`the ${set.id} set`, () => {
		it('offers exactly 15 characters', () => {
			expect(set.characters).toHaveLength(15)
		})

		it('gives every character a unique id and name', () => {
			const { characters } = set
			expect(new Set(characters.map((c) => c.id)).size).toBe(characters.length)
			expect(new Set(characters.map((c) => c.name)).size).toBe(
				characters.length
			)
		})

		it('keeps every character its own artwork inside the set folder', () => {
			// The extension is left open — a set drawn by hand may well ship
			// PNGs — but a character must not borrow another set's picture.
			for (const { id, image } of set.characters) {
				expect(image, id).toMatch(
					new RegExp(`^/characters/${set.id}/${id}\\.[a-z]+$`)
				)
			}
		})

		it('has that artwork on disk', () => {
			// Adding a set and forgetting the art is otherwise silent until a
			// meeting is under way and everyone is a blank square.
			for (const { id, image } of set.characters) {
				expect(existsSync(join(process.cwd(), 'public', image)), id).toBe(true)
			}
		})

		it('keeps pitch ratios inside the worklet parameter range', () => {
			for (const { id, voice } of set.characters) {
				expect(voice.pitchRatio, id).toBeGreaterThanOrEqual(0.25)
				expect(voice.pitchRatio, id).toBeLessThanOrEqual(4)
			}
		})

		it('never uses a pitch ratio of exactly 1', () => {
			// A static grain phase turns the shifter's two taps into a fixed comb
			// filter, which colours the voice without disguising it.
			for (const { id, voice } of set.characters) {
				expect(voice.pitchRatio, id).not.toBe(1)
			}
		})

		it('makes every voice audibly different from the real one', () => {
			for (const { id, voice } of set.characters) {
				const shifted = Math.abs(voice.pitchRatio - 1) > 0.05
				const modulated = voice.ringModHz > 0 && voice.ringModDepth > 0
				expect(shifted || modulated, `${id} is not disguised`).toBe(true)
			}
		})
	})
}
