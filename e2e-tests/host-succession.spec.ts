import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const room = `host-succession-${Date.now()}`

/**
 * Opens the lobby with a chosen connection id.
 *
 * The seat is keyed by a random id kept in sessionStorage, and the room used
 * to hand the controls to whichever id sorted first — so choosing the ids is
 * what makes "first in, first to inherit" distinguishable from "lowest id
 * wins", rather than a coin toss that passes half the time.
 */
async function join(browser: Browser, id: string): Promise<Page> {
	const context = await browser.newContext()
	await context.addInitScript(
		([room, id]) =>
			window.sessionStorage.setItem(`masquerade-connection-id:${room}`, id),
		[room, id]
	)
	const page = await context.newPage()
	await page.goto(`/${room}`)
	await page.getByRole('button', { name: '権限を許可する' }).click()
	await expect(page.getByText('人が待機中')).toBeVisible({ timeout: 20_000 })
	return page
}

// Only the host is offered this, so it says who is holding the room.
const hostControl = (page: Page) =>
	page.getByRole('button', { name: 'ミーティング開始' })

test('the room goes to the longest-standing participant', async ({
	browser,
}) => {
	const first = await join(browser, 'aaa')
	await expect(hostControl(first)).toBeVisible()
	const second = await join(browser, 'zzz')
	const third = await join(browser, 'bbb')
	await expect(hostControl(second)).toHaveCount(0)
	await expect(hostControl(third)).toHaveCount(0)

	await first.close({ runBeforeUnload: true })

	// 'zzz' was here before 'bbb' and inherits, even though 'bbb' sorts first.
	await expect(hostControl(second)).toBeVisible({ timeout: 20_000 })
	await expect(hostControl(third)).toHaveCount(0)
})
