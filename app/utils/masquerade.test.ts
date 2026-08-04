import { describe, expect, it } from 'vitest'
import { canStartMeeting, minimumParticipants } from './masquerade'

const ready = (count: number) =>
	Array.from({ length: count }, () => ({ ready: true }))

describe('canStartMeeting', () => {
	it('refuses an empty lobby', () => {
		expect(canStartMeeting([])).toBe(false)
	})

	it('refuses a host who is on their own, however ready they are', () => {
		expect(canStartMeeting(ready(1))).toBe(false)
	})

	it('allows the meeting once the minimum is met and everyone is ready', () => {
		expect(canStartMeeting(ready(minimumParticipants))).toBe(true)
		expect(canStartMeeting(ready(minimumParticipants + 3))).toBe(true)
	})

	it('still waits on anyone who has not readied up', () => {
		expect(canStartMeeting([...ready(1), { ready: false }])).toBe(false)
		expect(canStartMeeting([...ready(4), { ready: false }])).toBe(false)
	})
})
