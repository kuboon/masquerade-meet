import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * The seating chart, taken up with the room directly.
 *
 * Seats only exist once a meeting is running, and the lobby will not start
 * one without a Cloudflare Realtime session — which is out of reach here. So
 * this talks the room's own protocol over a WebSocket instead of driving the
 * UI, which is enough: the chart is the room's to decide, and every screen is
 * only repeating what it is told.
 */
const harness = `
window.__room = {
	sockets: {},
	state: {},
	open(room, id) {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(
				location.origin.replace('http', 'ws') + '/parties/rooms/' + room + '?_pk=' + id
			)
			ws.onmessage = (event) => {
				const message = JSON.parse(event.data)
				if (message.type === 'roomState') window.__room.state[id] = message.state
			}
			ws.onopen = () => {
				window.__room.sockets[id] = ws
				// The room drops a connection that stops saying hello.
				ws.__beat = setInterval(
					() => ws.send(JSON.stringify({ type: 'heartbeat' })),
					3000
				)
				resolve(id)
			}
			ws.onerror = reject
		})
	},
	send(id, message) {
		window.__room.sockets[id].send(JSON.stringify(message))
	},
	leave(id) {
		const ws = window.__room.sockets[id]
		clearInterval(ws.__beat)
		ws.send(JSON.stringify({ type: 'userLeft' }))
		ws.close()
		delete window.__room.sockets[id]
		delete window.__room.state[id]
	},
}
`

const room = () => `seating-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const seats = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.seats ?? null,
		id
	) as Promise<string[] | null>

const names = (page: Page, id: string) =>
	page.evaluate(
		(id) => (window.__room.state[id]?.users ?? []).map((u: any) => u.id),
		id
	) as Promise<string[]>

async function seatedMeeting(page: Page, ids: string[]) {
	const name = room()
	await page.addInitScript(harness)
	await page.goto('/')
	for (const id of ids) {
		await page.evaluate(
			([name, id]) => window.__room.open(name, id),
			[name, id]
		)
		await page.evaluate(
			(id) => window.__room.send(id, { type: 'setDisplayName', name: id }),
			id
		)
		await page.evaluate(
			(id) => window.__room.send(id, { type: 'setReady', ready: true }),
			id
		)
	}
	// Wait for the room to agree that everybody is ready. Sending on one socket
	// says nothing about when another one's message lands, and the room refuses
	// to start a moment early.
	await expect
		.poll(() =>
			page.evaluate(
				(id) =>
					(window.__room.state[id]?.users ?? []).filter((u: any) => u.ready)
						.length,
				ids[0]
			)
		)
		.toBe(ids.length)

	// The first through the door runs the room.
	await page.evaluate(
		(id) => window.__room.send(id, { type: 'startMeeting' }),
		ids[0]
	)
	await expect.poll(() => seats(page, ids[0])).toHaveLength(ids.length)
	return name
}

test.describe('the seating chart', () => {
	test('seats everybody, the same way on every screen', async ({ page }) => {
		const ids = ['aaa', 'bbb', 'ccc']
		await seatedMeeting(page, ids)

		const chart = await seats(page, 'aaa')
		expect(chart).not.toBeNull()
		expect([...chart!].sort()).toEqual([...ids].sort())
		// Everyone is looking at the same room, in the same order.
		expect(await seats(page, 'bbb')).toEqual(chart)
		expect(await seats(page, 'ccc')).toEqual(chart)
	})

	test('does not rearrange itself at the reveal', async ({ page }) => {
		await seatedMeeting(page, ['aaa', 'bbb'])
		const before = await seats(page, 'aaa')

		await page.evaluate(() =>
			window.__room.send('aaa', { type: 'startReveal' })
		)
		await expect
			.poll(
				() =>
					page.evaluate(() => window.__room.state['aaa']?.masquerade?.phase),
				{ timeout: 20_000 }
			)
			.toBe('revealed')

		expect(await seats(page, 'aaa')).toEqual(before)
	})

	test('holds a seat for somebody who drops out, and gives it back', async ({
		page,
	}) => {
		const ids = ['aaa', 'bbb', 'ccc']
		const name = await seatedMeeting(page, ids)
		const before = await seats(page, 'aaa')

		await page.evaluate(() => window.__room.leave('ccc'))
		await expect.poll(() => names(page, 'aaa')).not.toContain('ccc')
		// Nobody shuffles along to fill the gap.
		expect(await seats(page, 'aaa')).toEqual(before)

		await page.evaluate(([name]) => window.__room.open(name, 'ccc'), [name])
		await expect.poll(() => names(page, 'aaa')).toContain('ccc')
		expect(await seats(page, 'aaa')).toEqual(before)
	})

	test('is the host alone who may clear an empty seat', async ({ page }) => {
		const ids = ['aaa', 'bbb', 'ccc']
		await seatedMeeting(page, ids)
		const before = await seats(page, 'aaa')

		// An occupied seat is nobody's to clear, the host's included.
		await page.evaluate(() =>
			window.__room.send('aaa', { type: 'removeSeat', seatId: 'bbb' })
		)
		await page.evaluate(() => window.__room.leave('ccc'))
		await expect.poll(() => names(page, 'aaa')).not.toContain('ccc')

		// Nor is an empty one anybody else's.
		await page.evaluate(() =>
			window.__room.send('bbb', { type: 'removeSeat', seatId: 'ccc' })
		)
		expect(await seats(page, 'aaa')).toEqual(before)

		await page.evaluate(() =>
			window.__room.send('aaa', { type: 'removeSeat', seatId: 'ccc' })
		)
		await expect.poll(() => seats(page, 'aaa')).toHaveLength(2)
		expect(await seats(page, 'aaa')).not.toContain('ccc')
		expect(await seats(page, 'bbb')).toEqual(await seats(page, 'aaa'))
	})
})

declare global {
	interface Window {
		__room: {
			open(room: string, id: string): Promise<string>
			send(id: string, message: unknown): void
			leave(id: string): void
			state: Record<string, any>
		}
	}
}
