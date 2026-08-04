import { expect, test } from '@playwright/test'

test('two users meet in disguise and are then revealed', async ({
	browser,
}) => {
	// can't use nanoid here :(
	const location = `http://localhost:8787/${crypto.randomUUID()}`

	const context = await browser.newContext()

	// the first person into the room becomes its host
	const host = await context.newPage()
	await host.goto(location)
	await host.getByLabel('Enter your display name').fill('kevin')
	await host.getByLabel('Enter your display name').press('Enter')
	await expect(
		host.getByRole('button', { name: '準備完了', exact: true })
	).toBeVisible()
	await host.getByRole('button', { name: '準備完了', exact: true }).click()

	const guest = await context.newPage()
	await guest.goto(location)
	await guest.getByRole('button', { name: '準備完了', exact: true }).click()

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
})
