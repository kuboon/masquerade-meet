import { describe, expect, it } from 'vitest'
import { neutralVoice, voice, VOICE_RANGE } from './characters'
import { toEngineParams } from './voiceChanger'

describe('toEngineParams', () => {
	it('leaves everything alone in the middle', () => {
		const engine = toEngineParams(neutralVoice)
		expect(engine.pitchRatio).toBe(1)
		expect(engine.lowGain).toBeCloseTo(0)
		expect(engine.midGain).toBeCloseTo(0)
		expect(engine.highGain).toBeCloseTo(0)
		expect(engine.ringModDepth).toBe(0)
		// Nothing to modulate with, so the modulator is off rather than silent
		// at zero depth — the worklet skips the whole branch on a zero carrier.
		expect(engine.ringModHz).toBe(0)
	})

	it('reads size as a musical distance', () => {
		// The same slider distance has to be the same musical distance at both
		// ends, which is why size is exponential and not a plain multiplier.
		expect(toEngineParams(voice(1, 0, 0)).pitchRatio).toBeCloseTo(2)
		expect(toEngineParams(voice(-1, 0, 0)).pitchRatio).toBeCloseTo(0.5)
		expect(toEngineParams(voice(0.5, 0, 0)).pitchRatio).toBeCloseTo(
			2 ** (VOICE_RANGE.sizeSemitones / 2 / 12)
		)
	})

	it('stays inside what the worklet will accept', () => {
		// The shifter clamps at 0.25 and 4; the ends of the slider have to land
		// inside that or the disguise quietly stops matching the preview.
		for (const size of [-1, 1]) {
			const { pitchRatio } = toEngineParams(voice(size, 0, 0))
			expect(pitchRatio).toBeGreaterThanOrEqual(0.25)
			expect(pitchRatio).toBeLessThanOrEqual(4)
		}
		expect(toEngineParams(voice(0, 0, 0, 1)).ringModDepth).toBeLessThanOrEqual(
			1
		)
	})

	it('tilts the two shelves against each other', () => {
		// Both moving the same way would be a volume control wearing a
		// different name; opposite ways is what makes it timbre.
		const bright = toEngineParams(voice(0, 1, 0))
		expect(bright.highGain).toBeGreaterThan(0)
		expect(bright.lowGain).toBe(-bright.highGain)

		const dark = toEngineParams(voice(0, -1, 0))
		expect(dark.lowGain).toBeGreaterThan(0)
		expect(dark.highGain).toBe(-dark.lowGain)
	})

	it('sends nasal to the peak and nowhere else', () => {
		const nasal = toEngineParams(voice(0, 0, 1))
		expect(nasal.midGain).toBeGreaterThan(0)
		expect(nasal.lowGain).toBeCloseTo(0)
		expect(nasal.highGain).toBeCloseTo(0)
		expect(toEngineParams(voice(0, 0, -1)).midGain).toBe(-nasal.midGain)
	})

	it('keeps roughness in the range where it is a rasp', () => {
		// A carrier up in the hundreds of hertz is a robot, not a hoarse
		// person, and depth at 1 swallows the words.
		const rough = toEngineParams(voice(0, 0, 0, 1))
		expect(rough.ringModHz).toBeGreaterThan(0)
		expect(rough.ringModHz).toBeLessThan(120)
		expect(rough.ringModDepth).toBeLessThan(0.7)
		// And it arrives gradually rather than switching on.
		expect(toEngineParams(voice(0, 0, 0, 0.5)).ringModDepth).toBeCloseTo(
			rough.ringModDepth / 2
		)
	})

	it('ignores a roughness outside the slider', () => {
		expect(toEngineParams(voice(0, 0, 0, 5)).ringModDepth).toBe(
			toEngineParams(voice(0, 0, 0, 1)).ringModDepth
		)
		expect(toEngineParams(voice(0, 0, 0, -5)).ringModHz).toBe(0)
	})
})
