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

	// The name is asked for in the lobby, under the character picker, and it
	// is the whole of the entry requirement: a character and a voice can be
	// settled for somebody who runs out of time, but a name cannot.
	const enterLobby = async (page: Page, name: string) => {
		await page.goto(location)
		await page.getByLabel('名前').fill(name)
	}

	// the first person into the room becomes its host
	const host = await context.newPage()
	await enterLobby(host, 'kevin')

	const guest = await context.newPage()
	await enterLobby(guest, 'sam')

	// Nobody declares themselves ready — the host arms a deadline and the
	// room begins on it, settling whatever is still unchosen.
	const start = host.getByRole('button', { name: 'ミーティング開始' })
	await expect(start).toBeEnabled({ timeout: 20_000 })
	await start.click()
	await expect(host.getByText('まもなく始まります')).toBeVisible()

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
	await host.getByRole('button', { name: '最初から' }).click()
	await host.getByRole('button', { name: 'キャラクター選択に戻る' }).click()

	for (const page of [host, guest]) {
		// Everybody walks back out to the lobby, not just the host — the half
		// of this that a single page cannot show. The name from the first
		// round is still filled in, so nobody introduces themselves twice.
		await expect(page.getByLabel('名前')).toHaveValue(/.+/, {
			timeout: 20_000,
		})
	}

	await host.getByRole('button', { name: 'ミーティング開始' }).click()

	// masks back on for the second round
	await expect(guest.getByRole('button', { name: 'Leave' })).toBeVisible()
	await expect
		.poll(async () => guest.locator('img[src^="/characters/"]').count(), {
			timeout: 10_000,
		})
		.toBeGreaterThanOrEqual(2)

	// text chat, sent from behind a mask. The panel stays open on the guest's
	// side across the reveal below, which is where the interesting part is.
	const chatPanel = (page: Page) =>
		page.getByRole('complementary', { name: 'チャット' })
	for (const page of [host, guest]) {
		await page.getByRole('button', { name: 'チャット' }).click()
	}
	await host.getByPlaceholder('メッセージを入力').fill('だれでしょう')
	await host.getByRole('button', { name: '送信' }).click()

	await expect(chatPanel(guest).getByText('だれでしょう')).toBeVisible()
	// Signed by a character, not by a person. The room never puts a real name
	// on the wire before the reveal, and this is the line that would carry it.
	await expect(chatPanel(guest).getByText('kevin')).toHaveCount(0)

	await host.getByRole('button', { name: '正体を明かす' }).click()
	await host.getByRole('button', { name: 'カウントダウン開始' }).click()

	// countdown is 5s, then everyone's camera comes back on at once
	await expect
		.poll(async () => guest.locator('video').count(), { timeout: 20_000 })
		.toBe(2)

	// and the log unmasks along with the faces: the same line, now signed
	await expect(chatPanel(guest).getByText('kevin')).toBeVisible()

	// and starting over still works from the other side of the reveal
	await host.getByRole('button', { name: '最初から' }).click()
	await host.getByRole('button', { name: 'キャラクター選択に戻る' }).click()
	await expect(guest.getByLabel('名前')).toBeVisible({ timeout: 20_000 })
})
