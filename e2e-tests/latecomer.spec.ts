import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
	installRoomSocket,
	leave,
	open,
	phase,
	send,
	user,
	userIds,
} from './roomSocket'

/**
 * Somebody arriving after the meeting has started.
 *
 * A meeting holds as many people as the character set has faces, so the
 * interesting case is the one where it is full: there is nothing left to deal,
 * and a participant with no character has no disguise on their voice either,
 * because the disguise is the character's. Whoever that happens to waits in
 * the lobby until somebody leaves.
 */
test.describe.configure({ timeout: 180_000 })

const roomName = () => `late-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const seatsOf = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.seats ?? [],
		id
	) as Promise<string[]>

/** A meeting already under way, with `ids` in it. */
async function meetingOf(page: Page, room: string, ids: string[]) {
	await installRoomSocket(page)
	await page.goto('/')
	for (const id of ids) {
		await open(page, room, id)
		await send(page, id, { type: 'setDisplayName', name: id })
	}
	await expect.poll(() => userIds(page, ids[0])).toHaveLength(ids.length)
	await send(page, ids[0], { type: 'startMeeting' })
	await expect
		.poll(() => phase(page, ids[0]), { timeout: 30_000 })
		.toBe('masquerade')
}

/** However many faces this room's set has, which is the room's capacity. */
const FULL = 15

test('deals a latecomer a face and a seat of their own', async ({ page }) => {
	const room = roomName()
	await meetingOf(page, room, ['aaa', 'bbb', 'ccc'])

	await open(page, room, 'late')
	await send(page, 'late', { type: 'setDisplayName', name: 'late' })
	await expect.poll(() => userIds(page, 'aaa')).toHaveLength(4)

	const them = await user(page, 'aaa', 'late')
	expect(them.characterId).toBeTruthy()
	// Appended, never inserted: everybody else's tile stays where it was.
	const seats = await seatsOf(page, 'aaa')
	expect(seats).toHaveLength(4)
	expect(seats[3]).toBe('late')
})

test('gives a latecomer nothing when every face is worn', async ({ page }) => {
	const room = roomName()
	const ids = Array.from({ length: FULL }, (_, i) => `p${i}`)
	await meetingOf(page, room, ids)

	await open(page, room, 'late')
	await send(page, 'late', { type: 'setDisplayName', name: 'late' })
	await expect.poll(() => userIds(page, 'p0')).toHaveLength(FULL + 1)

	// The lobby is what holds them; the room simply has nothing to give.
	expect((await user(page, 'p0', 'late')).characterId).toBeFalsy()
})

test('lets the waiting one in the moment somebody leaves', async ({ page }) => {
	const room = roomName()
	const ids = Array.from({ length: FULL }, (_, i) => `p${i}`)
	await meetingOf(page, room, ids)

	await open(page, room, 'late')
	await send(page, 'late', { type: 'setDisplayName', name: 'late' })
	await expect
		.poll(async () => (await user(page, 'p0', 'late'))?.characterId ?? null)
		.toBeNull()

	const freed = (await user(page, 'p0', 'p7')).characterId
	await leave(page, 'p7')

	// Waiting has to end by itself, or "somebody will leave" is not an answer.
	await expect
		.poll(async () => (await user(page, 'p0', 'late'))?.characterId ?? null)
		.toBe(freed)
	expect(await seatsOf(page, 'p0')).toContain('late')
})

test('keeps somebody with no face out of the meeting', async ({ browser }) => {
	const room = roomName()
	const ids = Array.from({ length: FULL }, (_, i) => `p${i}`)
	const backstage = await browser.newPage()
	await meetingOf(backstage, room, ids)

	// A real browser with a name already remembered, which is every regular:
	// nothing else would stop them being carried straight in.
	const page = await browser.newPage()
	await page.addInitScript(() =>
		localStorage.setItem('masquerade:display-name', '"おそいひと"')
	)
	await page.goto(`/${room}`)
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()

	await expect(
		page.getByText('空いているキャラクターがありません')
	).toBeVisible({ timeout: 20_000 })

	// Still in the lobby a good while later, rather than on their way in.
	await page.waitForTimeout(5000)
	expect(page.url()).not.toContain('/room')
})
