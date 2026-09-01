import { expect, test } from '@playwright/test'

/**
 * The page an author checks their own set on.
 *
 * A room that cannot use a set tells nobody — it opens with the built-in
 * faces — so this is the only place the mistake surfaces, and it has to
 * surface it in the author's own words rather than silently.
 *
 * The fetch happens in the loader, on the server, so these go through the
 * same code a room does. What is not covered here is a set that loads: the
 * checker only speaks https and the dev server is http.
 */

test('asks for a URL and says nothing until it has one', async ({ page }) => {
	await page.goto('/character-set')
	await expect(page.getByLabel('キャラセットの URL')).toBeVisible()
	await expect(page.getByText('このままではルームで使えません')).toHaveCount(0)
	await expect(page.getByText('このセットはルームで使えます')).toHaveCount(0)
})

test('turns away something that is not an address', async ({ page }) => {
	// `animals` is a built-in set id, which is the plausible wrong thing to
	// paste here — and the one that would otherwise be fetched as a relative
	// URL against masq's own origin.
	await page.goto('/character-set?url=animals')
	await expect(page.getByText('https:// で始まる')).toBeVisible()
})

test('says why it could not read the set', async ({ page }) => {
	await page.goto(
		'/character-set?url=' +
			encodeURIComponent('https://masquerade.invalid/set.json')
	)
	await expect(page.getByText('このままではルームで使えません')).toBeVisible({
		timeout: 20_000,
	})
})

test('keeps the address in the box so it can be fixed and tried again', async ({
	page,
}) => {
	const url = 'https://masquerade.invalid/set.json'
	await page.goto('/character-set?url=' + encodeURIComponent(url))
	await expect(page.getByLabel('キャラセットの URL')).toHaveValue(url)
})
