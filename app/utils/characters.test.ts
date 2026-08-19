import { describe, expect, it } from 'vitest'
import { isDisguised, neutralVoice, voice } from './characters'
import { toEngineParams } from './voiceChanger'

describe('neutral voice', () => {
	it('leaves the voice completely transparent', () => {
		// Every axis at rest, and the engine reading it as a passthrough — the
		// second half matters because that is what the reveal switches to.
		expect(neutralVoice).toEqual(voice(0, 0, 0, 0))
		const engine = toEngineParams(neutralVoice)
		expect(engine.semitones).toBe(0)
		expect(engine.ringModDepth).toBe(0)
		expect(engine.lowGain).toBeCloseTo(0)
		expect(engine.midGain).toBeCloseTo(0)
		expect(engine.highGain).toBeCloseTo(0)
	})
})

describe('isDisguised', () => {
	it('refuses a voice the size of your own', () => {
		expect(isDisguised(neutralVoice)).toBe(false)
		// A semitone and a half is inside the range one person's voice wanders
		// on its own, whatever the tone controls are doing.
		expect(isDisguised(voice(0.1, 1, 1))).toBe(false)
	})

	it('accepts a body of a different size', () => {
		expect(isDisguised(voice(-0.2, 0, 0))).toBe(true)
		expect(isDisguised(voice(0.2, 0, 0))).toBe(true)
	})

	it('accepts a rasp nobody has, at any size', () => {
		expect(isDisguised(voice(0, 0, 0, 0.5))).toBe(true)
	})
})
