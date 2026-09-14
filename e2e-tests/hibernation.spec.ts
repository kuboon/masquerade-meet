import { expect, test } from '@playwright/test'
import { drop, installRoomSocket, open, userIds } from './roomSocket'

/**
 * The keepalive has to be answered by the Cloudflare runtime, not by the room.
 *
 * This is the whole of why a quiet meeting is cheap. Every client pings every
 * few seconds, and a ping that reaches the Durable Object wakes it and is
 * billed for its trouble, so a room with anybody in it would never sleep. The
 * runtime answers it instead — but only if the frame matches the auto-response
 * pair exactly, and a mismatch fails silently: everything still works, and the
 * bill quietly goes back to being the length of the meeting.
 *
 * `heartbeatAck` is what makes it visible. Nothing in the room sends one, so a
 * reply can only have come from the auto-response.
 */
test('the runtime answers the keepalive, not the room', async ({ page }) => {
	await installRoomSocket(page)
	await page.goto('/')
	const room = `hibernation-${Date.now()}`
	await open(page, room, 'a')
	await expect.poll(() => userIds(page, 'a')).toContain('a')

	const reply = await page.evaluate(async () => {
		const ws = window.__room.sockets.a
		return new Promise<string | null>((resolve) => {
			const timer = setTimeout(() => resolve(null), 10_000)
			ws.addEventListener('message', (event: MessageEvent) => {
				const message = JSON.parse(event.data as string)
				if (message.type !== 'heartbeatAck') return
				clearTimeout(timer)
				resolve(event.data as string)
			})
		})
	})

	expect(reply).toBe(JSON.stringify({ type: 'heartbeatAck' }))
})

/**
 * A room that nobody is talking in now sleeps between events, so the sweep
 * that clears out a dropped connection is no longer a tick that comes round
 * every few seconds — it is an alarm set for the moment the grace runs out,
 * and nothing else wakes the room in between.
 *
 * This walks that whole path: a socket goes without saying goodbye, the room
 * notices the close and remembers when, wakes once on the deadline, reads the
 * runtime's record of who has been pinging, and clears out the one that has
 * not. Getting any of it wrong shows up here as a seat nobody ever vacates —
 * or, if reading that record throws, as a sweep that never finishes.
 */
test('clears out a dropped connection, and keeps the one still pinging', async ({
	page,
}) => {
	await installRoomSocket(page)
	await page.goto('/')
	const room = `dropped-${Date.now()}`
	await open(page, room, 'stays')
	await open(page, room, 'goes')
	await expect.poll(() => userIds(page, 'stays')).toHaveLength(2)

	await drop(page, 'goes')
	// Long enough for the grace to run out and the alarm to land, and no
	// longer: whoever is still here must not go with them.
	await expect
		.poll(() => userIds(page, 'stays'), { timeout: 40_000 })
		.toEqual(['stays'])
})
