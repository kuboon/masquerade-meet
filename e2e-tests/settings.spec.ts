import { expect, test } from '@playwright/test'

/**
 * A browser will not name a device of a kind it has never been allowed to
 * use. It still says one exists — kind and nothing else, with an empty id —
 * and that empty id is not something a Radix select item will accept: handed
 * one, it throws during render and takes the whole page with it.
 *
 * Chromium's fake devices are named whether or not permission was given, so
 * the state has to be described rather than provoked. This is verbatim what
 * a real browser returns for a camera nobody has agreed to, which is the
 * ordinary case here — the camera is optional and most people never grant it.
 */
const cameraNeverPermitted = `
const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
navigator.mediaDevices.enumerateDevices = async () => {
	const devices = await real()
	return [
		...devices.filter((d) => d.kind !== 'videoinput'),
		{ deviceId: '', kind: 'videoinput', label: '', groupId: '', toJSON: () => ({}) },
	]
}
`

test('the settings dialog opens without a camera to offer', async ({
	browser,
}) => {
	const context = await browser.newContext({ permissions: ['microphone'] })
	await context.addInitScript(cameraNeverPermitted)
	const page = await context.newPage()

	const crashes: string[] = []
	page.on('pageerror', (error) => crashes.push(error.message))

	await page.goto(`/settings-${Date.now()}`)
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()
	await expect(page.getByText('人が待機中')).toBeVisible({ timeout: 20_000 })

	await page.getByRole('button', { name: '設定' }).click()

	await expect(page.getByText('（カメラなし）')).toBeVisible()
	// The lobby is still there rather than replaced by an error boundary.
	await expect(page.getByText('人が待機中')).toBeVisible()
	expect(crashes).toEqual([])
})
