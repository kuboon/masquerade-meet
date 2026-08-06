import { expect, test } from '@playwright/test'

/**
 * A smoke test for the developer voice tuner. Chromium runs with a fake
 * capture device (see playwright.config.ts), so the recording path can be
 * driven end to end without a real microphone.
 */
test('records a loop and disguises it', async ({ page }) => {
	await page.goto('/dev/voice')

	await expect(
		page.getByRole('heading', { name: 'ボイス調整ツール' })
	).toBeVisible()

	// Nothing to play until something has been recorded.
	await expect(page.getByRole('button', { name: 'ループ再生' })).toBeDisabled()

	// Let the recording run its full length and stop itself rather than
	// cutting it short: on a slow runner an early stop can leave a blob too
	// short to decode, which the page reports instead of enabling playback.
	await page.getByRole('button', { name: '自分の声を録音' }).click()
	await expect(page.getByRole('button', { name: '停止' })).toBeVisible()
	await expect(
		page.getByRole('button', { name: '自分の声を録音' })
	).toBeVisible({ timeout: 20_000 })
	await expect(page.getByRole('button', { name: 'ループ再生' })).toBeEnabled({
		timeout: 10_000,
	})

	await page.getByRole('button', { name: 'ループ再生' }).click()
	await expect(page.getByRole('button', { name: '再生を止める' })).toBeVisible()

	// The whole voice is four controls, and no more.
	await expect(page.getByRole('slider')).toHaveCount(4)

	// Moving one edits the selected character's draft and shows up in the
	// paste-ready snippet, written the way the character files are.
	await page.getByLabel('体の大きさ (数値)').fill('-0.42')
	await expect(page.getByLabel('書き出し')).toHaveValue(
		/^voice: voice\(-0\.42, /
	)
	await expect(page.getByText('1体を編集中')).toBeVisible()

	// A clean voice leaves the optional fourth argument off; a rasping one
	// has to write it.
	await expect(page.getByLabel('書き出し')).toHaveValue(/, [-\d.]+\),$/)
	await page.getByLabel('かすれ (数値)').fill('0.4')
	await expect(page.getByLabel('書き出し')).toHaveValue(/, 0\.4\),$/)

	// The whole-set view covers every character, edited or not.
	await page.getByLabel('セット全体').click()
	const wholeSet = await page.getByLabel('書き出し').inputValue()
	expect(wholeSet).toContain('// bear — くまごろう')
	expect(wholeSet).toContain('// lion — ')
	expect(wholeSet.match(/voice: voice\(/g)).toHaveLength(15)
	await page.getByLabel('セット全体').click()

	await page.getByRole('button', { name: 'このキャラをリセット' }).click()
	await expect(page.getByText('ソースの値のままです')).toBeVisible()
})
