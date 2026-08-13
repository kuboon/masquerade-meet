import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * The room's own protocol, spoken from a page without going through the UI.
 *
 * The lobby will not start a meeting without a Cloudflare Realtime session,
 * which is out of reach here, so anything on the far side of the start button
 * has to be reached this way. It is also how a test plays the parts it is not
 * looking at: one browser page can hold a dozen participants this way, and
 * only the page under test has to be a real one.
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

/** Installs the harness on a page that has not navigated yet. */
export async function installRoomSocket(page: Page) {
	await page.addInitScript(harness)
}

export const seats = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.seats ?? null,
		id
	) as Promise<string[] | null>

export const phase = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.phase ?? null,
		id
	) as Promise<string | null>

export const userIds = (page: Page, id: string) =>
	page.evaluate(
		(id) => (window.__room.state[id]?.users ?? []).map((u: any) => u.id),
		id
	) as Promise<string[]>

export const open = (page: Page, room: string, id: string) =>
	page.evaluate(([room, id]) => window.__room.open(room, id), [room, id])

export const send = (page: Page, id: string, message: unknown) =>
	page.evaluate(([id, message]) => window.__room.send(id as string, message), [
		id,
		message,
	] as [string, unknown])

/** Everything the room says about one connection, by its id. */
export const user = (page: Page, id: string, of = id) =>
	page.evaluate(
		([id, of]) =>
			(window.__room.state[id]?.users ?? []).find((u: any) => u.id === of) ??
			null,
		[id, of]
	) as Promise<any>

export const leave = (page: Page, id: string) =>
	page.evaluate((id) => window.__room.leave(id), id)

/**
 * A meeting under way, with everybody already seated.
 *
 * Nobody declares themselves ready any more — the host arms a deadline and
 * the room begins on it — so this waits for the room to see all the arrivals,
 * says go, and then waits out the countdown.
 */
export async function seatedMeeting(page: Page, room: string, ids: string[]) {
	for (const id of ids) {
		await open(page, room, id)
		// A name is the whole of the entry requirement: the room leaves anybody
		// without one in the lobby when the deadline falls.
		await send(page, id, { type: 'setDisplayName', name: id })
	}
	// Sending on one socket says nothing about when another one's message
	// lands, and the room counts heads before it agrees to start.
	await expect.poll(() => userIds(page, ids[0])).toHaveLength(ids.length)

	// The first through the door runs the room.
	await send(page, ids[0], { type: 'startMeeting' })
	// Longer than the countdown, which is deliberately not instant.
	await expect
		.poll(() => seats(page, ids[0]), { timeout: 30_000 })
		.toHaveLength(ids.length)
	return room
}

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
