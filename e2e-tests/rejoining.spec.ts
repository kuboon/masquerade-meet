import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * A reload is a departure as far as the room is concerned: the page says
 * goodbye on the way out and the seat is cleared, so the character has to be
 * asked for again on the way back in. The lobby names the character it is
 * holding for you, which is enough to see whether it survived.
 */
const held = (page: Page) =>
	page.getByText('希望するキャラクター').locator('..').locator('p').nth(1)

/** The name on its own, without the emoji in front. */
async function heldCharacter(page: Page): Promise<string> {
	await expect(held(page)).toBeVisible({ timeout: 20_000 })
	const line = await held(page).innerText()
	expect(line).not.toBe('選択中…')
	const name = line.replace(/^\S+\s/, '')
	expect(name).not.toBe('')
	return name
}

/** The permission gate stands in front of the lobby on every load. */
async function pastPermissions(page: Page) {
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()
}

test('comes back wearing the same character after a reload', async ({
	page,
}) => {
	await page.goto(`/rejoin-${Date.now()}`)
	await pastPermissions(page)
	const before = await heldCharacter(page)

	await page.reload()
	await pastPermissions(page)
	// Without the browser asking for it back, this is a fresh draw from
	// fifteen — so it would pass by luck one time in fifteen.
	expect(await heldCharacter(page)).toBe(before)
})

test('gives up the character to whoever took it meanwhile', async ({
	browser,
}) => {
	const room = `/rejoin-taken-${Date.now()}`
	const first = await browser.newPage()
	await first.goto(room)
	await pastPermissions(first)
	const wanted = await heldCharacter(first)

	// They leave, somebody else takes the face, and then they come back for it.
	await first.close({ runBeforeUnload: true })
	const other = await browser.newPage()
	await other.goto(room)
	await pastPermissions(other)
	await heldCharacter(other)
	await other.getByRole('button', { name: wanted }).click()
	await expect(held(other)).toContainText(wanted)

	const returning = await browser.newPage()
	await returning.goto(room)
	await pastPermissions(returning)
	expect(await heldCharacter(returning)).not.toBe(wanted)
})
