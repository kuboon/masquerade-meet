import { expect, test } from '@playwright/test'

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

test('goes straight into the room without asking for a name first', async ({
	page,
}) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'ルームを作る' }).click()
	await expect(page).toHaveURL(/\/[A-Za-z0-9_-]{8}$/)

	// The name and picture are asked for in the lobby, below the character
	// picker, so nothing stands between the link and the room but the
	// camera/microphone prompt.
	await expect(page.getByLabel('名前')).toHaveCount(0)
	await expect(
		page.getByRole('button', { name: '権限を許可する' })
	).toBeVisible()
})

test('lets someone in who has no camera', async ({ page }) => {
	// Refuse anything asking for video, the way a machine with no camera —
	// or somebody who declines it — behaves. The microphone still works.
	await page.addInitScript(() => {
		const original = navigator.mediaDevices.getUserMedia.bind(
			navigator.mediaDevices
		)
		navigator.mediaDevices.getUserMedia = (constraints) =>
			constraints?.video
				? Promise.reject(new DOMException('no camera', 'NotFoundError'))
				: original(constraints)
	})

	await page.goto('/')
	await page.getByRole('button', { name: 'ルームを作る' }).click()
	await page.getByRole('button', { name: '権限を許可する' }).click()

	await expect(
		page.getByRole('button', { name: '権限を許可する' })
	).toHaveCount(0)
	await expect(
		page.getByRole('heading', { name: 'マイクの権限が必要です' })
	).toHaveCount(0)
})
