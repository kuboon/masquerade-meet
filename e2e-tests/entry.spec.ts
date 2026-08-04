import { expect, test } from '@playwright/test'

// A 4x4 red PNG, inline so the test carries its own fixture.
const RED_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGO4Y2MDRwzEcQAy0hVBbgTcWgAAAABJRU5ErkJggg==',
	'base64'
)

test('the landing page only offers to make a room', async ({ page }) => {
	await page.goto('/')
	await expect(
		page.getByRole('heading', { name: 'マスカレード' })
	).toBeVisible()
	await expect(page.getByRole('button', { name: 'ルームを作る' })).toBeVisible()
	// Joining by typing a room name is gone — a room is something you are
	// given a link to.
	await expect(page.getByLabel('ルーム名')).toHaveCount(0)
})

test('asks for the name inside the room, not before it', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'ルームを作る' }).click()
	await expect(page).toHaveURL(/\/[A-Za-z0-9_-]{8}$/)

	// The room explains itself before demanding anything.
	await expect(
		page.getByRole('heading', { name: 'マスカレード' })
	).toBeVisible()
	await expect(page.getByLabel('名前')).toBeVisible()

	await page.getByLabel('名前').fill('けん')
	await page.getByRole('button', { name: '参加する' }).click()

	await expect(page.getByLabel('名前')).toHaveCount(0)
})

test('keeps the registered picture in the browser', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'ルームを作る' }).click()

	await page.getByLabel('変装解除後の画像（任意）').setInputFiles({
		name: 'me.png',
		mimeType: 'image/png',
		buffer: RED_PNG,
	})

	// A preview means it was decoded, downscaled and stored.
	await expect(page.getByAltText('登録した画像')).toBeVisible()
	const stored = await page.evaluate(() =>
		window.localStorage.getItem('masquerade:still-image')
	)
	expect(stored).toMatch(/^data:image\/jpeg;base64,/)

	// It survives the reload that setting the name causes.
	await page.getByLabel('名前').fill('けん')
	await page.getByRole('button', { name: '参加する' }).click()
	await expect(page.getByLabel('名前')).toHaveCount(0)
	expect(
		await page.evaluate(() =>
			window.localStorage.getItem('masquerade:still-image')
		)
	).toBe(stored)
})
