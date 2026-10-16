import { describe, expect, it } from 'vitest'
import { PitchFollower } from './pitch.ts'

/** A voice holding one note for a while. */
function hold(follower: PitchFollower, hz: number, readings: number) {
	for (let i = 0; i < readings; i++) follower.observe(hz, true)
}

describe('PitchFollower', () => {
	it('says nothing before anybody has spoken', () => {
		const follower = new PitchFollower()
		expect(follower.centreHz).toBeUndefined()
		expect(follower.deviation).toBe(0)
		expect(follower.shift(-7, 1)).toBe(-7)
	})

	it('takes the first note as the middle', () => {
		const follower = new PitchFollower()
		follower.observe(150, true)
		expect(follower.centreHz).toBeCloseTo(150)
		expect(follower.deviation).toBe(0)
	})

	it('leaves the shift alone at flatten 0, whatever the voice does', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		hold(follower, 300, 20)
		expect(follower.deviation).toBeGreaterThan(6)
		// The compatibility promise: every character written before this
		// axis existed gets exactly the shift it always got.
		expect(follower.shift(-7, 0)).toBe(-7)
	})

	it('cancels a rise at flatten 1', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		// An octave up, and given a few readings to ease into it.
		hold(follower, 300, 20)
		// A little under twelve: the middle has already started to follow.
		expect(follower.deviation).toBeGreaterThan(10)
		expect(follower.deviation).toBeLessThanOrEqual(12)
		// The voice went up; the shift goes down by the same amount to meet it.
		expect(follower.shift(-7, 1)).toBeCloseTo(-7 - follower.deviation)
	})

	it('takes out only part of it in between', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		hold(follower, 300, 20)
		expect(follower.shift(0, 0.5)).toBeCloseTo(-follower.deviation / 2)
	})

	it('holds through silence rather than snapping back', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		hold(follower, 300, 20)
		const before = follower.deviation
		for (let i = 0; i < 50; i++) follower.observe(0, false)
		expect(follower.deviation).toBe(before)
	})

	it('eases into a jump rather than taking it in one reading', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		follower.observe(300, true)
		expect(follower.deviation).toBeGreaterThan(3)
		expect(follower.deviation).toBeLessThan(9)
	})

	it('learns the middle quickly and then lets it drift only slowly', () => {
		const follower = new PitchFollower()
		follower.observe(100, true)
		follower.observe(200, true)
		// Two readings: the middle is between them.
		expect(follower.centreHz).toBeCloseTo(Math.sqrt(100 * 200), 0)

		hold(follower, 150, 300)
		expect(follower.centreHz).toBeCloseTo(150, 0)
		// A sentence's worth of high notes moves it a little, not to them.
		hold(follower, 300, 47)
		expect(follower.centreHz!).toBeGreaterThan(150)
		expect(follower.centreHz!).toBeLessThan(220)
	})

	it('will not bend the shift past an octave', () => {
		const follower = new PitchFollower()
		hold(follower, 100, 200)
		// Two octaves up is not something a voice does; a tracker says it.
		hold(follower, 400, 50)
		expect(follower.deviation).toBeLessThanOrEqual(12)
		expect(follower.shift(0, 1)).toBeGreaterThanOrEqual(-12)
	})

	it('clamps flatten to its range', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		hold(follower, 300, 20)
		expect(follower.shift(0, 2)).toBeCloseTo(follower.shift(0, 1))
		expect(follower.shift(0, -1)).toBe(0)
	})

	it('forgets the speaker on reset', () => {
		const follower = new PitchFollower()
		hold(follower, 150, 200)
		follower.reset()
		expect(follower.centreHz).toBeUndefined()
		expect(follower.deviation).toBe(0)
	})
})
