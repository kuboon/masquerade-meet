import { expect, test } from '@playwright/test'

// A 4x4 red PNG, inline so the test carries its own fixture.
const RED_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGO4Y2MDRwzEcQAy0hVBbgTcWgAAAABJRU5ErkJggg==',
	'base64'
)

/**
 * The still image can only be seen end to end in a real meeting, which needs
 * Cloudflare Realtime credentials — which is how it shipped without anybody
 * noticing it was not arriving. /dev/still-image subscribes to the same
 * observable the room pushes, so the sending half can be checked here.
 */
test.describe('the still image on the wire', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dev/still-image')
		await page.getByLabel('変装解除後の画像（任意）').setInputFiles({
			name: 'me.png',
			mimeType: 'image/png',
			buffer: RED_PNG,
		})
		await expect(page.getByAltText('登録した画像')).toBeVisible()
	})

	test('always has a track on the wire, even before the reveal', async ({
		page,
	}) => {
		// Nothing is being shown yet, but something has to be published or
		// there is no transceiver to replace a track on later. This is where
		// a feedback loop between the camera's isBroadcasting and the switch
		// below it shows up: it starves the pipeline and nothing is emitted.
		await expect(page.getByTestId('track-kind')).toHaveText('video')
		await expect(page.getByTestId('track-state')).toHaveText('live')
	})

	test('switches to the picture when the masks come off', async ({ page }) => {
		await page.getByRole('button', { name: 'アンマスクする' }).click()

		await expect(page.getByTestId('track-kind')).toHaveText('video')
		await expect(page.getByTestId('track-state')).toHaveText('live')
		// A canvas drawn once and left alone yields a track that exists and
		// never delivers anything — indistinguishable from a working one
		// unless the frames are counted.
		await expect
			.poll(
				async () => Number(await page.getByTestId('frame-count').innerText()),
				{
					timeout: 15_000,
				}
			)
			.toBeGreaterThan(0)
	})

	test('goes back to the camera track when hidden again', async ({ page }) => {
		await page.getByRole('button', { name: 'アンマスクする' }).click()
		await expect(page.getByTestId('dbg-active')).toHaveText('true')

		await page.getByRole('button', { name: '変装に戻す' }).click()
		await expect(page.getByTestId('dbg-active')).toHaveText('false')
		await expect(page.getByTestId('track-state')).toHaveText('live')
		await expect
			.poll(
				async () => Number(await page.getByTestId('frame-count').innerText()),
				{
					timeout: 15_000,
				}
			)
			.toBeGreaterThan(0)
	})
})
