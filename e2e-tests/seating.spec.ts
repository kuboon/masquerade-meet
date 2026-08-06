import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
	installRoomSocket,
	leave,
	open,
	phase,
	seatedMeeting,
	seats,
	send,
	userIds,
} from './roomSocket'

/**
 * The seating chart, taken up with the room directly.
 *
 * Seats only exist once a meeting is running, and the lobby will not start
 * one without a Cloudflare Realtime session — which is out of reach here. So
 * this talks the room's own protocol over a WebSocket instead of driving the
 * UI, which is enough: the chart is the room's to decide, and every screen is
 * only repeating what it is told.
 */
const roomName = () =>
	`seating-${Date.now()}-${Math.floor(Math.random() * 1000)}`

async function meeting(page: Page, ids: string[]) {
	const name = roomName()
	await installRoomSocket(page)
	await page.goto('/')
	return seatedMeeting(page, name, ids)
}

test.describe('the seating chart', () => {
	test('seats everybody, the same way on every screen', async ({ page }) => {
		const ids = ['aaa', 'bbb', 'ccc']
		await meeting(page, ids)

		const chart = await seats(page, 'aaa')
		expect(chart).not.toBeNull()
		expect([...chart!].sort()).toEqual([...ids].sort())
		// Everyone is looking at the same room, in the same order.
		expect(await seats(page, 'bbb')).toEqual(chart)
		expect(await seats(page, 'ccc')).toEqual(chart)
	})

	test('does not rearrange itself at the reveal', async ({ page }) => {
		await meeting(page, ['aaa', 'bbb'])
		const before = await seats(page, 'aaa')

		await send(page, 'aaa', { type: 'startReveal' })
		await expect
			.poll(() => phase(page, 'aaa'), { timeout: 20_000 })
			.toBe('revealed')

		expect(await seats(page, 'aaa')).toEqual(before)
	})

	test('holds a seat for somebody who drops out, and gives it back', async ({
		page,
	}) => {
		const ids = ['aaa', 'bbb', 'ccc']
		const name = await meeting(page, ids)
		const before = await seats(page, 'aaa')

		await leave(page, 'ccc')
		await expect.poll(() => userIds(page, 'aaa')).not.toContain('ccc')
		// Nobody shuffles along to fill the gap.
		expect(await seats(page, 'aaa')).toEqual(before)

		await open(page, name, 'ccc')
		await expect.poll(() => userIds(page, 'aaa')).toContain('ccc')
		expect(await seats(page, 'aaa')).toEqual(before)
	})

	test('is the host alone who may clear an empty seat', async ({ page }) => {
		const ids = ['aaa', 'bbb', 'ccc']
		await meeting(page, ids)
		const before = await seats(page, 'aaa')

		// An occupied seat is nobody's to clear, the host's included.
		await send(page, 'aaa', { type: 'removeSeat', seatId: 'bbb' })
		await leave(page, 'ccc')
		await expect.poll(() => userIds(page, 'aaa')).not.toContain('ccc')

		// Nor is an empty one anybody else's.
		await send(page, 'bbb', { type: 'removeSeat', seatId: 'ccc' })
		expect(await seats(page, 'aaa')).toEqual(before)

		await send(page, 'aaa', { type: 'removeSeat', seatId: 'ccc' })
		await expect.poll(() => seats(page, 'aaa')).toHaveLength(2)
		expect(await seats(page, 'aaa')).not.toContain('ccc')
		expect(await seats(page, 'bbb')).toEqual(await seats(page, 'aaa'))
	})
})
