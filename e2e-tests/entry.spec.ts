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
	// A room name of its own, and the chosen roster travelling with it. Once
	// there is more than one set to choose from the form carries `?set=`, so
	// the name is the whole path rather than the whole URL.
	await expect(page).toHaveURL(/\/[A-Za-z0-9_-]{8}(\?|$)/)

	// The name and picture are asked for in the lobby, below the character
	// picker, so nothing stands between the link and the room but the
	// camera/microphone prompt.
	await expect(page.getByLabel('名前')).toHaveCount(0)
	await expect(
		page.getByRole('button', { name: '権限を許可する' })
	).toBeVisible()
})

test('carries the chosen character set into the room', async ({ page }) => {
	// The set travels in the URL because the room pins whatever the first
	// connection asks for, and the link is what everyone else follows.
	await page.goto('/')
	// The card is the target; the radio inside it is only there so the form
	// works before the JavaScript arrives.
	await page.getByText('サーカス団', { exact: true }).click()
	await expect(page.getByRole('radio', { name: 'サーカス団' })).toBeChecked()
	await page.getByRole('button', { name: 'ルームを作る' }).click()
	await expect(page).toHaveURL(/\/[A-Za-z0-9_-]{8}\?set=circus$/)
})

test('hands out a link with nothing but the room in it', async ({
	browser,
}) => {
	const context = await browser.newContext({
		// The microphone has to be in the list: naming any permission at all
		// overrides Chromium's auto-accept, and without it the lobby stops at
		// "マイクの権限が必要です" instead of asking.
		permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
	})
	const page = await context.newPage()

	await page.goto('/')
	await page.getByText('サーカス団', { exact: true }).click()
	await page.getByRole('button', { name: 'ルームを作る' }).click()
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()
	await expect(page.getByText('人が待機中')).toBeVisible({ timeout: 20_000 })

	// The set reached the room, which is now the only place it lives.
	await expect(
		page.locator('img[src^="/characters/circus/"]').first()
	).toBeVisible()
	// So the knob comes off the address bar rather than sitting there doing
	// nothing — the room ignores it from here on.
	await expect(page).toHaveURL(/\/[A-Za-z0-9_-]{8}$/)

	await page.getByRole('button', { name: 'URLをコピー' }).click()
	const invitation = await page.evaluate(() => navigator.clipboard.readText())
	expect(invitation).toMatch(/\/[A-Za-z0-9_-]{8}$/)
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
