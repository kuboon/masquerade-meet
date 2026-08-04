import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test('two users meet in disguise and are then revealed', async ({
	browser,
}) => {
	// can't use nanoid here :(
	const location = `http://localhost:8787/${crypto.randomUUID()}`

	const context = await browser.newContext({
		permissions: ['camera', 'microphone'],
	})

	// The name is asked for in the lobby now, under the character picker,
	// and nobody can ready up without one.
	const enterLobby = async (page: Page, name: string) => {
		await page.goto(location)
		await page.getByLabel('名前').fill(name)
		const ready = page.getByRole('button', { name: '準備完了', exact: true })
		await expect(ready).toBeEnabled({ timeout: 15_000 })
		await ready.click()
	}

	// the first person into the room becomes its host
	const host = await context.newPage()
	await enterLobby(host, 'kevin')

	const guest = await context.newPage()
	await enterLobby(guest, 'sam')

	// the meeting can only start once everybody is ready
	await host.getByRole('button', { name: 'ミーティング開始' }).click()

	await expect(host.getByRole('button', { name: 'Leave' })).toBeVisible()
	await expect(guest.getByRole('button', { name: 'Leave' })).toBeVisible()

	// while masked, cameras stay dark and the tiles show character artwork
	await expect
		.poll(async () => host.locator('img[src^="/characters/"]').count(), {
			timeout: 10_000,
		})
		.toBeGreaterThanOrEqual(2)

	await host.getByRole('button', { name: '正体を明かす' }).click()
	await host.getByRole('button', { name: 'カウントダウン開始' }).click()

	// countdown is 5s, then everyone's camera comes back on at once
	await expect
		.poll(async () => guest.locator('video').count(), { timeout: 20_000 })
		.toBe(2)

	// the host can run the whole thing again with the same people. Everybody
	// walks back out to the lobby — not just the host, which is the half of
	// this that a single page cannot show.
	await host.getByRole('button', { name: '最初から' }).click()
	await host.getByRole('button', { name: 'キャラクター選択に戻る' }).click()

	const readyAgain = (page: Page) =>
		page.getByRole('button', { name: '準備完了', exact: true })
	for (const page of [host, guest]) {
		// Enabled, not merely present: the name registered for the first round
		// is still on file, so nobody has to introduce themselves twice.
		await expect(readyAgain(page)).toBeEnabled({ timeout: 20_000 })
	}

	await readyAgain(host).click()
	await readyAgain(guest).click()
	await host.getByRole('button', { name: 'ミーティング開始' }).click()

	// and the masks are back on for the second round
	await expect(guest.getByRole('button', { name: 'Leave' })).toBeVisible()
	await expect
		.poll(async () => guest.locator('img[src^="/characters/"]').count(), {
			timeout: 10_000,
		})
		.toBeGreaterThanOrEqual(2)
})
