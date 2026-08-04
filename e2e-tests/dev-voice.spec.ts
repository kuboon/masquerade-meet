import { expect, test } from '@playwright/test'

/**
 * A smoke test for the developer voice tuner. Chromium runs with a fake
 * capture device (see playwright.config.ts), so the recording path can be
 * driven end to end without a real microphone.
 */
test('records a loop and disguises it', async ({ page }) => {
	await page.goto('/dev/voice')
	await page.getByLabel('Enter your display name').fill('tuner')
	await page.getByLabel('Enter your display name').press('Enter')

	await expect(
		page.getByRole('heading', { name: 'ボイス調整ツール' })
	).toBeVisible()

	// Nothing to play until something has been recorded.
	await expect(page.getByRole('button', { name: 'ループ再生' })).toBeDisabled()

	await page.getByRole('button', { name: '自分の声を録音' }).click()
	await page.getByRole('button', { name: '停止' }).click()
	await expect(page.getByRole('button', { name: 'ループ再生' })).toBeEnabled({
		timeout: 10_000,
	})

	await page.getByRole('button', { name: 'ループ再生' }).click()
	await expect(page.getByRole('button', { name: '再生を止める' })).toBeVisible()

	// Moving a control edits the selected character's draft and shows up in
	// the paste-ready snippet.
	await page.getByLabel('ピッチ比 (数値)').fill('1.23')
	await expect(page.getByLabel('貼り付け用')).toHaveValue(/pitchRatio: 1\.23,/)
	await expect(page.getByText('1体を編集中')).toBeVisible()

	await page.getByRole('button', { name: 'このキャラをリセット' }).click()
	await expect(page.getByText('ソースの値のままです')).toBeVisible()
})
