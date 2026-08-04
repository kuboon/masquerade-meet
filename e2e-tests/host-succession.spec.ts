import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Opens the lobby with a chosen connection id.
 *
 * The seat is keyed by a random id kept in sessionStorage, and the room used
 * to hand the controls to whichever id sorted first — so choosing the ids is
 * what makes "first in, first to inherit" distinguishable from "lowest id
 * wins", rather than a coin toss that passes half the time.
 */
async function join(browser: Browser, id: string, room: string): Promise<Page> {
	const context = await browser.newContext()
	await context.addInitScript(
		([room, id]) =>
			window.sessionStorage.setItem(`masquerade-connection-id:${room}`, id),
		[room, id]
	)
	const page = await context.newPage()
	await page.goto(`/${room}`)
	await allowPermissions(page)
	await expect(page.getByText('人が待機中')).toBeVisible({ timeout: 20_000 })
	return page
}

/** The permission gate stands in front of the lobby on every load. */
async function allowPermissions(page: Page) {
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()
}

// Only the host is offered this, so it says who is holding the room.
const hostControl = (page: Page) =>
	page.getByRole('button', { name: 'ミーティング開始' })

test('the room goes to the longest-standing participant', async ({
	browser,
}) => {
	const room = `host-succession-${Date.now()}`
	const first = await join(browser, 'aaa', room)
	await expect(hostControl(first)).toBeVisible()
	const second = await join(browser, 'zzz', room)
	const third = await join(browser, 'bbb', room)
	await expect(hostControl(second)).toHaveCount(0)
	await expect(hostControl(third)).toHaveCount(0)

	await first.close({ runBeforeUnload: true })

	// 'zzz' was here before 'bbb' and inherits, even though 'bbb' sorts first.
	await expect(hostControl(second)).toBeVisible({ timeout: 20_000 })
	await expect(hostControl(third)).toHaveCount(0)
})

test('the owner keeps their place in the queue across a reload', async ({
	browser,
}) => {
	const room = `host-reload-${Date.now()}`
	const owner = await join(browser, 'aaa', room)
	await expect(hostControl(owner)).toBeVisible()
	const second = await join(browser, 'zzz', room)
	const third = await join(browser, 'bbb', room)

	// The owner hits trouble and reloads. That is a departure as far as the
	// room is concerned, so the controls move on while they are away.
	await owner.reload()
	await allowPermissions(owner)
	// Wait for the seat to actually be back before disturbing anything else:
	// the lobby only draws once the room has answered, so a roster of three
	// says the reconnection has landed.
	await expect(owner.getByText('3人が待機中')).toBeVisible({ timeout: 20_000 })
	await expect(hostControl(second)).toBeVisible({ timeout: 20_000 })
	await expect(hostControl(owner)).toHaveCount(0)

	// When the stand-in leaves, it goes back to the owner rather than on to
	// the next in line — the reload did not send them to the back of it.
	await second.close({ runBeforeUnload: true })
	await expect(hostControl(owner)).toBeVisible({ timeout: 20_000 })
	await expect(hostControl(third)).toHaveCount(0)
})
