import { describe, expect, it } from 'vitest'
import { characters, getCharacter, neutralVoice } from './characters'

describe('stock characters', () => {
	it('offers exactly 15 of them', () => {
		expect(characters).toHaveLength(15)
	})

	it('gives every character a unique id and name', () => {
		expect(new Set(characters.map((c) => c.id)).size).toBe(characters.length)
		expect(new Set(characters.map((c) => c.name)).size).toBe(characters.length)
	})

	it('looks up characters by id', () => {
		expect(getCharacter('bear')?.name).toBe('くまごろう')
		expect(getCharacter('nobody')).toBeUndefined()
		expect(getCharacter(undefined)).toBeUndefined()
	})

	it('keeps pitch ratios inside the worklet parameter range', () => {
		for (const { id, voice } of characters) {
			expect(voice.pitchRatio, id).toBeGreaterThanOrEqual(0.25)
			expect(voice.pitchRatio, id).toBeLessThanOrEqual(4)
		}
	})

	it('never uses a pitch ratio of exactly 1', () => {
		// A static grain phase turns the shifter's two taps into a fixed comb
		// filter, which colours the voice without disguising it.
		for (const { id, voice } of characters) {
			expect(voice.pitchRatio, id).not.toBe(1)
		}
	})

	it('makes every voice audibly different from the real one', () => {
		for (const { id, voice } of characters) {
			const shifted = Math.abs(voice.pitchRatio - 1) > 0.05
			const modulated = voice.ringModHz > 0 && voice.ringModDepth > 0
			expect(shifted || modulated, `${id} is not disguised`).toBe(true)
		}
	})

	it('leaves the neutral voice completely transparent', () => {
		expect(neutralVoice.pitchRatio).toBe(1)
		expect(neutralVoice.ringModDepth).toBe(0)
		expect(neutralVoice.vibratoDepth).toBe(0)
		expect(neutralVoice.tone.low).toBe(0)
		expect(neutralVoice.tone.midGain).toBe(0)
		expect(neutralVoice.tone.high).toBe(0)
	})
})
