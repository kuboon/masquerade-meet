import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { neutralVoice, voice, VOICE_RANGE } from './characters'
import { toEngineParams } from './voiceChanger'

describe('toEngineParams', () => {
	it('leaves everything alone in the middle', () => {
		const engine = toEngineParams(neutralVoice)
		expect(engine.semitones).toBe(0)
		expect(engine.lowGain).toBeCloseTo(0)
		expect(engine.midGain).toBeCloseTo(0)
		expect(engine.highGain).toBeCloseTo(0)
		expect(engine.ringModDepth).toBe(0)
		// A carrier of zero rather than a silent one. At zero depth the
		// modulation contributes nothing either way, but a stopped oscillator
		// is one less thing running in every participant's browser.
		expect(engine.ringModHz).toBe(0)
	})

	it('moves the formants with the pitch when nothing says otherwise', () => {
		// The whole compatibility story in one line: equal numbers mean one
		// body growing or shrinking, which is what every character written
		// before `throat` existed asked for and still gets.
		for (const size of [-1, -0.4, 0, 0.5, 1]) {
			const engine = toEngineParams(voice(size, 0, 0))
			expect(engine.formantSemitones).toBeCloseTo(engine.semitones)
		}
	})

	it('moves the formants on their own for a throat that does not match', () => {
		const engine = toEngineParams({ ...voice(0, 0, 0), throat: 1 })
		expect(engine.semitones).toBe(0)
		expect(engine.formantSemitones).toBeCloseTo(VOICE_RANGE.throatSemitones)

		// And it is measured from the pitch, not instead of it.
		const deep = toEngineParams({ ...voice(-1, 0, 0), throat: 1 })
		expect(deep.semitones).toBeCloseTo(-VOICE_RANGE.sizeSemitones)
		expect(deep.formantSemitones).toBeCloseTo(
			-VOICE_RANGE.sizeSemitones + VOICE_RANGE.throatSemitones
		)
	})

	it('treats a missing throat as no throat at all', () => {
		const absent = toEngineParams(voice(0.5, 0, 0))
		const explicit = toEngineParams({ ...voice(0.5, 0, 0), throat: 0 })
		expect(absent).toEqual(explicit)
	})

	it('reads size as a musical distance', () => {
		// Semitones rather than a ratio, so the same slider distance is the
		// same musical distance at both ends without anybody having to write
		// the exponential twice. The shifter does that part.
		expect(toEngineParams(voice(1, 0, 0)).semitones).toBeCloseTo(
			VOICE_RANGE.sizeSemitones
		)
		expect(toEngineParams(voice(-1, 0, 0)).semitones).toBeCloseTo(
			-VOICE_RANGE.sizeSemitones
		)
		expect(toEngineParams(voice(0.5, 0, 0)).semitones).toBeCloseTo(
			VOICE_RANGE.sizeSemitones / 2
		)
	})

	it('keeps the ends of the slider somewhere a voice still works', () => {
		// Two octaves either way is where every shifter gives up; the whole
		// range has to sit well inside that.
		for (const size of [-1, 1]) {
			expect(
				Math.abs(toEngineParams(voice(size, 0, 0)).semitones)
			).toBeLessThanOrEqual(24)
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

describe('the vendored pitch shifter', () => {
	it('is the version package.json pins', () => {
		// The library is served from public/ so that the browser test can
		// render audio through the very file that ships. That means a copy,
		// and a copy that can go stale — `npm run voice:vendor` makes it, and
		// this is what notices when somebody bumps the dependency without
		// running it.
		const vendored = readFileSync(
			join(process.cwd(), 'public/voice/SignalsmithStretch.mjs')
		)
		const installed = readFileSync(
			join(
				process.cwd(),
				'node_modules/signalsmith-stretch/SignalsmithStretch.mjs'
			)
		)
		expect(vendored.equals(installed)).toBe(true)
	})
})
