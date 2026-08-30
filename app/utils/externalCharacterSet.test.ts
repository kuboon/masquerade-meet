import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	embeddedSetType,
	externalSetLimits,
	fetchExternalCharacterSet,
	isExternalSetUrl,
	parseExternalCharacterSet,
} from './externalCharacterSet'

const source = new URL('https://example.com/masquerade/set.json')

/** A document that passes, for tests that want to break one thing about it. */
const good = () => ({
	name: 'テスト一座',
	tagline: 'ためしの面々',
	characters: [
		{
			id: 'bear',
			name: 'くま',
			emoji: '🐻',
			tagline: 'のっそり',
			image: 'bear.png',
			voice: { size: -0.8, weight: -0.3, nasal: 0, roughness: 0.1 },
		},
		{
			id: 'mouse',
			name: 'ねずみ',
			emoji: '🐭',
			tagline: 'ちょろちょろ',
			image: 'https://cdn.example.com/mouse.png',
			voice: { size: 0.85, weight: 0.4, nasal: 0.3 },
		},
	],
})

const parse = (document: unknown) => parseExternalCharacterSet(document, source)

describe('parseExternalCharacterSet', () => {
	it('reads a set somebody else published', () => {
		const { set, problems } = parse(good())
		expect(problems).toEqual([])
		expect(set?.name).toBe('テスト一座')
		expect(set?.characters.map((c) => c.id)).toEqual(['bear', 'mouse'])
	})

	it('names the set by where it came from', () => {
		// Not by anything the document says. The address is the one thing about
		// a stranger's roster the room knows first-hand, and it is what the
		// room pins and what tells a delivered set apart from a built-in one.
		expect(parse(good()).set?.id).toBe(source.href)
	})

	it('resolves an image beside the document', () => {
		expect(parse(good()).set?.characters[0].image).toBe(
			'https://example.com/masquerade/bear.png'
		)
	})

	it('leaves an image on another host alone', () => {
		expect(parse(good()).set?.characters[1].image).toBe(
			'https://cdn.example.com/mouse.png'
		)
	})

	it('fills in what an author may leave out', () => {
		const document = good()
		// @ts-expect-error deliberately incomplete
		delete document.characters[1].emoji
		// @ts-expect-error deliberately incomplete
		delete document.characters[1].tagline
		const { set } = parse(document)
		expect(set?.characters[1].emoji).toBeTruthy()
		expect(set?.characters[1].tagline).toBe('')
		expect(set?.characters[1].voice.roughness).toBe(0)
		expect(set?.characters[1].voice.throat).toBe(0)
	})

	it('refuses a voice that is not a disguise', () => {
		// The whole reason this file exists. A set of zeroes would put everyone
		// on the call in their own voice while telling them they were hidden,
		// and they would have no way to notice.
		const document = good()
		document.characters[0].voice = {
			size: 0,
			weight: 0.9,
			nasal: 0.9,
			roughness: 0,
		}
		const { set, problems } = parse(document)
		expect(set).toBeUndefined()
		expect(problems.join()).toContain('characters[0].voice')
		expect(problems.join()).toContain('地声')
	})

	it('refuses a set even when only one character is undisguised', () => {
		// Not "drops that one": the author chose fifteen faces and would get
		// fourteen back, and whoever ended up in the missing one is the person
		// this check is for.
		const document = good()
		document.characters[1].voice = { size: 0.05, weight: 0, nasal: 0 }
		expect(parse(document).set).toBeUndefined()
	})

	it('refuses an image that is not a picture on the web', () => {
		const document = good()
		document.characters[0].image =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
		expect(parse(document).problems.join()).toContain('https://')
	})

	it('refuses http, which anyone on the wire can replace', () => {
		const document = good()
		document.characters[0].image = 'http://example.com/bear.png'
		expect(parse(document).set).toBeUndefined()
	})

	it('says everything that is wrong at once', () => {
		// The other end of this is somebody editing a JSON file by hand. One
		// mistake per publish is a bad afternoon.
		const { problems } = parse({
			characters: [
				{ id: 'a', image: 'a.png', voice: { size: -0.9, weight: 0, nasal: 0 } },
				{ id: 'b', name: 'び', image: 'b.png', voice: { size: 2 } },
			],
		})
		expect(problems.length).toBeGreaterThanOrEqual(3)
		expect(problems.join()).toContain('name')
		expect(problems.join()).toContain('characters[0].name')
		expect(problems.join()).toContain('characters[1].voice.size')
	})

	it('refuses two characters with the same id', () => {
		const document = good()
		document.characters[1].id = 'bear'
		expect(parse(document).problems.join()).toContain('重複')
	})

	it('refuses an id that is not safe to put in a URL', () => {
		const document = good()
		document.characters[0].id = 'く ま/../'
		expect(parse(document).set).toBeUndefined()
	})

	it('wants at least two faces to hide behind', () => {
		const document = good()
		document.characters = [document.characters[0]]
		expect(parse(document).set).toBeUndefined()
	})

	it('stops at a roster no room could seat', () => {
		const document = good()
		document.characters = Array.from(
			{ length: externalSetLimits.maxCharacters + 5 },
			(_, i) => ({ ...good().characters[0], id: `c${i}` })
		)
		expect(parse(document).problems.join()).toContain('多すぎます')
	})

	it('refuses a name long enough to break the tiles', () => {
		const document = good()
		document.characters[0].name = 'あ'.repeat(
			externalSetLimits.characterName + 1
		)
		expect(parse(document).set).toBeUndefined()
	})

	it('has nothing to say about a document that is not one', () => {
		expect(parse('a string').set).toBeUndefined()
		expect(parse(null).set).toBeUndefined()
		expect(parse([]).set).toBeUndefined()
		expect(parse({ name: 'x' }).problems.join()).toContain('characters')
	})
})

describe('isExternalSetUrl', () => {
	it('takes an https address', () => {
		expect(isExternalSetUrl('https://example.com/set.json')).toBe(true)
	})

	it('leaves a built-in set id alone', () => {
		// `?set=animals` is not a URL and must stay the registry's business.
		expect(isExternalSetUrl('animals')).toBe(false)
	})

	it('refuses every other scheme the room could be talked into', () => {
		for (const address of [
			'http://example.com/set.json',
			'file:///etc/passwd',
			'data:application/json,{}',
			// eslint-disable-next-line no-script-url -- being refused is the point
			'javascript:alert(1)',
		]) {
			expect(isExternalSetUrl(address)).toBe(false)
		}
	})

	it('refuses an address too long to be one', () => {
		expect(
			isExternalSetUrl(
				'https://example.com/' + 'a'.repeat(externalSetLimits.url)
			)
		).toBe(false)
	})
})

describe('fetchExternalCharacterSet', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	/** A server that answers with whatever this test wants it to. */
	const serving = (body: BodyInit, init?: ResponseInit) =>
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(body, init))
		)

	it('goes and gets a set', async () => {
		serving(JSON.stringify(good()))
		const { set, problems } = await fetchExternalCharacterSet(source.href)
		expect(problems).toEqual([])
		expect(set?.characters).toHaveLength(2)
		// Relative paths resolve against where it was fetched from, not against
		// masq — the author wrote them beside their own file.
		expect(set?.characters[0].image).toBe(
			'https://example.com/masquerade/bear.png'
		)
	})

	it('will not be sent anywhere but https', async () => {
		const fetching = vi.fn()
		vi.stubGlobal('fetch', fetching)
		for (const address of ['http://example.com/s.json', 'file:///etc/passwd']) {
			expect((await fetchExternalCharacterSet(address)).set).toBeUndefined()
		}
		// Not merely refused afterwards: never asked for. Whatever is on the
		// other end of that address is not something this room may touch.
		expect(fetching).not.toHaveBeenCalled()
	})

	it('says so when the file is not there', async () => {
		serving('not found', { status: 404 })
		expect(
			(await fetchExternalCharacterSet(source.href)).problems[0]
		).toContain('404')
	})

	it('reads a roster embedded in the page it was linked from', async () => {
		// So that an author can publish one HTML file and nothing else, which
		// is the shape the button on their page is already in.
		serving(
			`<!doctype html><title>うちの一座</title>
			<script type="${embeddedSetType}">${JSON.stringify(good())}</script>
			<a href="https://masq.kbn.one/new?set=...">このキャラセットでマスカレードする</a>`
		)
		const { set, problems } = await fetchExternalCharacterSet(source.href)
		expect(problems).toEqual([])
		expect(set?.characters).toHaveLength(2)
	})

	it('says what is missing from a page with no roster in it', async () => {
		serving('<!doctype html><title>oops</title><script>alert(1)</script>')
		expect(
			(await fetchExternalCharacterSet(source.href)).problems[0]
		).toContain(embeddedSetType)
	})

	it('says so when the file is JSON that does not parse', async () => {
		serving('{"name": "うち",,,}')
		expect(
			(await fetchExternalCharacterSet(source.href)).problems[0]
		).toContain('JSON')
	})

	it('stops reading a body that will not stop', async () => {
		// A stranger's server, so the size is not something it gets to decide.
		// Counted off the stream rather than off Content-Length, which is a
		// claim rather than a fact — hence a body sent without one.
		const chunk = new Uint8Array(16 * 1024)
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						new ReadableStream({
							pull(controller) {
								controller.enqueue(chunk)
							},
						})
					)
			)
		)
		const { set, problems } = await fetchExternalCharacterSet(source.href)
		expect(set).toBeUndefined()
		expect(problems[0]).toContain('大きすぎます')
	})

	it('does not hold a room open waiting for a server that never answers', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				// What a hung connection looks like from in here: the signal is
				// the only thing that ever settles.
				await new Promise((_, reject) =>
					init?.signal?.addEventListener('abort', () =>
						reject(init.signal!.reason)
					)
				)
				throw new Error('unreachable')
			})
		)
		const { problems } = await fetchExternalCharacterSet(source.href)
		expect(problems[0]).toContain('タイムアウト')
	}, 10_000)

	it('says so when there is nothing on the other end', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('fetch failed')
			})
		)
		expect(
			(await fetchExternalCharacterSet(source.href)).problems[0]
		).toBeTruthy()
	})
})
