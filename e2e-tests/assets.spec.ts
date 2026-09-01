import { expect, test } from '@playwright/test'

/**
 * How `public/` is served.
 *
 * The platform serves it before the Worker runs, so none of this is code in
 * this repository any more — which is exactly why it is worth a test. The
 * caching below used to be hand-written in server.ts, and moving to Static
 * Assets silently dropped it until `public/_headers` put it back.
 */
test('serves a static asset', async ({ request }) => {
	const response = await request.get('/characters/animals/bear.png')
	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).toContain('image/png')
})

test("lets the browser keep Remix's fingerprinted bundles for good", async ({
	request,
}) => {
	// Whatever this build happens to have called them. Read out of the page
	// rather than off disk, and by pattern rather than by tag: Remix asks for
	// its bundles from an inline module script, so there is no `src` to find.
	const page = await (await request.get('/')).text()
	const bundle = page.match(/\/build\/[\w./-]+\.js/)?.[0]
	expect(bundle, 'no fingerprinted bundle on the page').toBeTruthy()

	const response = await request.get(bundle!)
	expect(response.status()).toBe(200)
	// The name changes whenever the contents do, so there is never a reason
	// to ask about one twice.
	expect(response.headers()['cache-control']).toContain('immutable')
})

test('leaves everything else revalidating', async ({ request }) => {
	// Stable names, changing contents — the opposite trade.
	const response = await request.get('/favicon.ico')
	expect(response.status()).toBe(200)
	expect(response.headers()['cache-control']).not.toContain('immutable')
})

test('hands an unknown path to the app rather than answering it', async ({
	request,
}) => {
	// `_headers` is configuration for the asset server, not an asset.
	const response = await request.get('/_headers')
	expect(response.headers()['content-type']).toContain('text/html')
})

test("lets somebody else's page import the pitch shifter", async ({
	request,
}) => {
	// An author previewing the voices in their own character set imports this
	// module from their own origin, and a cross-origin module import without
	// this header fails with nothing in the console worth reading.
	const response = await request.get('/voice/SignalsmithStretch.mjs')
	expect(response.status()).toBe(200)
	expect(response.headers()['access-control-allow-origin']).toBe('*')
})

test('says plainly when Realtime is not configured', async ({ request }) => {
	// Without credentials the library signs with a zero-length key and throws
	// from inside itself, several times a second, saying nothing about what is
	// missing. That is the shape the outage took, so the proxy answers for it.
	const response = await request.post('/partytracks/sessions/new', { data: {} })
	if (response.status() === 503) {
		expect(await response.text()).toContain('CALLS_APP_ID')
	} else {
		// Configured, so it is Cloudflare's answer rather than ours — whatever
		// it is, it must not be this Worker falling over.
		expect(response.status()).toBeLessThan(500)
	}
})
