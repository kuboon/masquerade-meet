import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isDisguised, VOICE_RANGE } from '~/utils/characters'
import { minimumParticipants } from '~/utils/masquerade'
import { toEngineParams } from '~/utils/voiceChanger'
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
		// And dropping one of the original fifteen strands whoever is wearing
		// it. Growing a set is safe; shrinking one is not.
		expect(getCharacterSet('animals').characters).toHaveLength(15)
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
		it('has enough characters to hold a meeting', () => {
			// A set's size is the room's capacity — canStartMeeting refuses to
			// start with more people than there are faces to go round, and the
			// lobby quotes the number back. Sets are allowed to be different
			// sizes; what they are not allowed to be is too small to play.
			expect(set.characters.length).toBeGreaterThanOrEqual(minimumParticipants)
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

		it('has a banner of its own, and has it on disk', () => {
			// The landing page is the one place a set is advertised rather than
			// used, and a missing banner there is a broken image on the front
			// door — where nobody has yet decided to stay.
			expect(set.banner).toMatch(
				new RegExp(`^/characters/${set.id}/banner\\.[a-z]+$`)
			)
			expect(existsSync(join(process.cwd(), 'public', set.banner))).toBe(true)
		})

		it('keeps every axis inside the range a slider offers', () => {
			// A character outside it cannot be reproduced by anybody tuning
			// their own voice, and the preview would stop matching the meeting.
			for (const { id, voice } of set.characters) {
				expect(Math.abs(voice.size), `${id} size`).toBeLessThanOrEqual(1)
				expect(Math.abs(voice.weight), `${id} weight`).toBeLessThanOrEqual(1)
				expect(Math.abs(voice.nasal), `${id} nasal`).toBeLessThanOrEqual(1)
				expect(voice.roughness, `${id} roughness`).toBeGreaterThanOrEqual(0)
				expect(voice.roughness, `${id} roughness`).toBeLessThanOrEqual(1)
			}
		})

		it('keeps every pitch somewhere a voice still works', () => {
			// Two octaves either way is where every shifter gives up, and the
			// measured quality floor in e2e-tests/voice-changer.spec.ts is only
			// promised across the slider's own range.
			for (const { id, voice } of set.characters) {
				expect(
					Math.abs(toEngineParams(voice).semitones),
					id
				).toBeLessThanOrEqual(24)
			}
		})

		it('makes every voice audibly different from the real one', () => {
			for (const { id, voice } of set.characters) {
				expect(isDisguised(voice), `${id} is not disguised`).toBe(true)
			}
		})

		it('gives no two characters the same body', () => {
			// Size is the cue people actually go by; two characters within a
			// semitone of each other are one character as far as the ear is
			// concerned, however different the rest of their settings look.
			const sizes = set.characters
				.map((c) => c.voice.size)
				.sort((a, b) => a - b)
			for (let i = 1; i < sizes.length; i++) {
				expect(
					sizes[i] - sizes[i - 1],
					`${set.id} has two characters at size ${sizes[i]}`
				).toBeGreaterThan(1 / VOICE_RANGE.sizeSemitones)
			}
		})
	})
}
