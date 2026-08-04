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

	// The host can start over at any point in a meeting, the reveal included.
	// Here it happens while everyone is still masked — a round that is going
	// wrong should not have to be played out first.
	const readyUp = (page: Page) =>
		page.getByRole('button', { name: '準備完了', exact: true })
	await host.getByRole('button', { name: '最初から' }).click()
	await host.getByRole('button', { name: 'キャラクター選択に戻る' }).click()

	for (const page of [host, guest]) {
		// Everybody walks back out to the lobby, not just the host — the half
		// of this that a single page cannot show. And enabled, not merely
		// present: the name from the first round is still on file, so nobody
		// has to introduce themselves twice.
		await expect(readyUp(page)).toBeEnabled({ timeout: 20_000 })
	}

	await readyUp(host).click()
	await readyUp(guest).click()
	await host.getByRole('button', { name: 'ミーティング開始' }).click()

	// masks back on for the second round
	await expect(guest.getByRole('button', { name: 'Leave' })).toBeVisible()
	await expect
		.poll(async () => guest.locator('img[src^="/characters/"]').count(), {
			timeout: 10_000,
		})
		.toBeGreaterThanOrEqual(2)

	await host.getByRole('button', { name: '正体を明かす' }).click()
	await host.getByRole('button', { name: 'カウントダウン開始' }).click()

	// countdown is 5s, then everyone's camera comes back on at once
	await expect
		.poll(async () => guest.locator('video').count(), { timeout: 20_000 })
		.toBe(2)

	// and starting over still works from the other side of the reveal
	await host.getByRole('button', { name: '最初から' }).click()
	await host.getByRole('button', { name: 'キャラクター選択に戻る' }).click()
	await expect(readyUp(guest)).toBeEnabled({ timeout: 20_000 })
})
