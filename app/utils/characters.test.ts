import { describe, expect, it } from 'vitest'
import { neutralVoice } from './characters'

describe('neutral voice', () => {
	it('leaves the voice completely transparent', () => {
		expect(neutralVoice.pitchRatio).toBe(1)
		expect(neutralVoice.ringModDepth).toBe(0)
		expect(neutralVoice.vibratoDepth).toBe(0)
		expect(neutralVoice.tone.low).toBe(0)
		expect(neutralVoice.tone.midGain).toBe(0)
		expect(neutralVoice.tone.high).toBe(0)
	})
})
