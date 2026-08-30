import {
	isDisguised,
	VOICE_RANGE,
	type Character,
	type CharacterSet,
	type VoiceParams,
} from './characters'

/**
 * A roster somebody else wrote, read off the open web.
 *
 * A page anywhere can publish a JSON file describing its own characters and
 * link to `masq.kbn.one/new?set=<that url>`. The room fetches it once, when
 * it is created, checks it here and then keeps its own copy for good — so a
 * meeting does not end because the site it borrowed its faces from went down
 * halfway through, and so nobody can swap the faces out from under a meeting
 * by editing the file afterwards.
 *
 * Everything in this module is about not trusting that file. It arrives as
 * whatever bytes a stranger felt like serving, and every one of the app's
 * promises has to survive it:
 *
 *  - **Nobody's own voice goes out.** A set whose voices are all zeroes would
 *    put fifteen people on a call in their own voices believing they were
 *    disguised. That is the one failure this app must never have, so a
 *    character whose voice is not a disguise is not a character and the whole
 *    set is refused.
 *  - **The room stays small.** The roster is broadcast, stored in a Durable
 *    Object and held in every participant's memory, so it is bounded in
 *    every direction: bytes, characters, and the length of each string.
 *  - **What is on screen is a picture and nothing else.** Images are plain
 *    https URLs handed to `<img src>`; no data URIs, no other scheme.
 *
 * The document may be a JSON file or the page itself, with the roster in a
 * `<script type="application/masquerade-character-set+json">` — so an author
 * who wants to publish one HTML file and nothing else can point the button at
 * the page it is on.
 *
 * The checks are duplicated in the JSR package third parties build their page
 * with, so an author sees these messages before publishing rather than after.
 * If a rule changes here it changes there.
 */

/** Everything with a size, in one place, because every one of them is a limit. */
export const externalSetLimits = {
	/** the whole JSON document */
	bytes: 64 * 1024,
	/** long enough for a slow origin, short enough not to hang a room's first connection */
	timeoutMs: 5_000,
	minCharacters: 2,
	maxCharacters: 40,
	setName: 40,
	setTagline: 60,
	characterId: 32,
	characterName: 24,
	characterTagline: 40,
	emoji: 8,
	/** an image URL; generous, because a CDN path can be long */
	url: 512,
} as const

const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

type Problems = string[]

export type ExternalSetResult =
	| { set: CharacterSet; problems: [] }
	| { set: undefined; problems: [string, ...string[]] }

/**
 * The document, checked and turned into a roster this app can wear.
 *
 * Every problem is collected rather than the first one thrown, because the
 * other end of this is somebody editing a JSON file: being told about one
 * mistake per publish is a bad afternoon.
 *
 * `source` is where the document came from, and it does two jobs — relative
 * image paths are resolved against it (so an author can write `"bear.png"`
 * next to their JSON), and it becomes the set's id, which is how a room
 * names a roster that has no name in any registry.
 */
export function parseExternalCharacterSet(
	input: unknown,
	source: URL
): ExternalSetResult {
	const problems: Problems = []
	const fail = (): ExternalSetResult => ({
		set: undefined,
		problems: problems as [string, ...string[]],
	})

	if (!isRecord(input)) {
		problems.push('JSON のトップレベルがオブジェクトではありません')
		return fail()
	}

	const name =
		text(input.name, 'name', externalSetLimits.setName, problems, {
			required: true,
		}) ?? ''
	const tagline =
		text(input.tagline, 'tagline', externalSetLimits.setTagline, problems) ?? ''
	const banner =
		input.banner === undefined
			? undefined
			: url(input.banner, 'banner', source, problems)

	const raw = input.characters
	if (!Array.isArray(raw)) {
		problems.push('characters が配列ではありません')
		return fail()
	}
	if (raw.length < externalSetLimits.minCharacters) {
		problems.push(
			`characters が ${raw.length} 件しかありません（${externalSetLimits.minCharacters} 件以上必要です）`
		)
	}
	if (raw.length > externalSetLimits.maxCharacters) {
		problems.push(
			`characters が多すぎます（${externalSetLimits.maxCharacters} 件まで）`
		)
	}

	const characters: Character[] = []
	const seen = new Set<string>()
	for (const [index, entry] of raw
		.slice(0, externalSetLimits.maxCharacters)
		.entries()) {
		const character = parseCharacter(
			entry,
			`characters[${index}]`,
			source,
			problems
		)
		if (character === undefined) continue
		if (seen.has(character.id)) {
			problems.push(
				`characters[${index}].id "${character.id}" が重複しています`
			)
			continue
		}
		seen.add(character.id)
		characters.push(character)
	}

	if (problems.length > 0) return fail()

	return {
		set: {
			// Not anything the document said: a roster off the web is named by
			// where it came from, which is the one thing about it that the room
			// knows first-hand.
			id: source.href,
			name,
			tagline,
			banner: banner ?? characters[0].image,
			characters,
		},
		problems: [],
	}
}

function parseCharacter(
	input: unknown,
	at: string,
	source: URL,
	problems: Problems
): Character | undefined {
	if (!isRecord(input)) {
		problems.push(`${at} がオブジェクトではありません`)
		return undefined
	}
	const before = problems.length

	const id = text(
		input.id,
		`${at}.id`,
		externalSetLimits.characterId,
		problems,
		{
			required: true,
		}
	)
	if (id !== undefined && !idPattern.test(id)) {
		problems.push(
			`${at}.id "${id}" は英数字とハイフン・アンダースコアのみ使えます`
		)
	}
	const name = text(
		input.name,
		`${at}.name`,
		externalSetLimits.characterName,
		problems,
		{ required: true }
	)
	const emoji =
		text(input.emoji, `${at}.emoji`, externalSetLimits.emoji, problems) ?? '🎭'
	const tagline =
		text(
			input.tagline,
			`${at}.tagline`,
			externalSetLimits.characterTagline,
			problems
		) ?? ''
	const image = url(input.image, `${at}.image`, source, problems)
	const voice = parseVoice(input.voice, `${at}.voice`, problems)

	if (problems.length > before) return undefined
	return {
		id: id!,
		name: name!,
		emoji,
		tagline,
		image: image!,
		voice: voice!,
	}
}

function parseVoice(
	input: unknown,
	at: string,
	problems: Problems
): VoiceParams | undefined {
	if (!isRecord(input)) {
		problems.push(`${at} がオブジェクトではありません`)
		return undefined
	}
	const before = problems.length
	const size = number(input.size, `${at}.size`, -1, 1, problems, {
		required: true,
	})
	const weight = number(input.weight, `${at}.weight`, -1, 1, problems, {
		required: true,
	})
	const nasal = number(input.nasal, `${at}.nasal`, -1, 1, problems, {
		required: true,
	})
	const roughness =
		number(input.roughness, `${at}.roughness`, 0, 1, problems) ?? 0
	const throat = number(input.throat, `${at}.throat`, -1, 1, problems) ?? 0
	if (problems.length > before) return undefined

	const voice = {
		size: size!,
		weight: weight!,
		nasal: nasal!,
		roughness,
		throat,
	}
	// The point of the whole app. A set that leaves somebody recognisable is
	// worse than no set at all, because they will not know.
	if (!isDisguised(voice)) {
		const size = (2 / VOICE_RANGE.sizeSemitones).toFixed(2)
		const throatAt = (2 / VOICE_RANGE.throatSemitones).toFixed(2)
		problems.push(
			`${at} は地声とほとんど変わりません（size を ±${size} 以上、throat を ±${throatAt} 以上、または roughness を 0.3 以上にしてください）`
		)
		return undefined
	}
	return voice
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(
	value: unknown,
	at: string,
	max: number,
	problems: Problems,
	{ required = false } = {}
): string | undefined {
	if (value === undefined || value === null) {
		if (required) problems.push(`${at} がありません`)
		return undefined
	}
	if (typeof value !== 'string') {
		problems.push(`${at} が文字列ではありません`)
		return undefined
	}
	const trimmed = value.trim()
	if (required && trimmed === '') {
		problems.push(`${at} が空です`)
		return undefined
	}
	if ([...trimmed].length > max) {
		problems.push(`${at} が長すぎます（${max} 文字まで）`)
		return undefined
	}
	return trimmed
}

function number(
	value: unknown,
	at: string,
	min: number,
	max: number,
	problems: Problems,
	{ required = false } = {}
): number | undefined {
	if (value === undefined || value === null) {
		if (required) problems.push(`${at} がありません`)
		return undefined
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		problems.push(`${at} が数値ではありません`)
		return undefined
	}
	if (value < min || value > max) {
		problems.push(`${at} は ${min} 〜 ${max} の範囲で指定してください`)
		return undefined
	}
	return value
}

/**
 * An image address, resolved against the document and held to https.
 *
 * Relative is allowed and expected — `"bear.png"` beside the JSON is the
 * shape an author will reach for first. What is not allowed is any other
 * scheme: a `data:` URI would put the artwork inside the roster and blow
 * past every size limit here, and the rest of them are not pictures.
 */
function url(
	value: unknown,
	at: string,
	source: URL,
	problems: Problems
): string | undefined {
	const raw = text(value, at, externalSetLimits.url, problems, {
		required: true,
	})
	if (raw === undefined) return undefined
	let resolved: URL
	try {
		resolved = new URL(raw, source)
	} catch {
		problems.push(`${at} が URL として読めません`)
		return undefined
	}
	if (resolved.protocol !== 'https:') {
		problems.push(`${at} は https:// で始まる必要があります`)
		return undefined
	}
	return resolved.href
}

/**
 * Whether a `?set=` value is somebody else's roster rather than one of ours.
 *
 * Only https, and only an address — the room is about to fetch this, and the
 * one thing worth being strict about at the door is what it is allowed to be.
 */
export function isExternalSetUrl(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > externalSetLimits.url) {
		return false
	}
	try {
		return new URL(value).protocol === 'https:'
	} catch {
		return false
	}
}

/**
 * Goes and gets one, or says why it could not.
 *
 * Bounded in both directions a stranger's server can misbehave: a clock, so
 * a room's first connection is never held open by a host that accepts and
 * then says nothing, and a byte count read off the stream rather than off
 * the `Content-Length` header, which is a claim rather than a fact.
 */
export async function fetchExternalCharacterSet(
	address: string
): Promise<ExternalSetResult> {
	const fail = (problem: string): ExternalSetResult => ({
		set: undefined,
		problems: [problem],
	})
	if (!isExternalSetUrl(address)) return fail('キャラセットの URL が不正です')
	const source = new URL(address)

	let body: string | undefined
	try {
		const response = await fetch(source.href, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(externalSetLimits.timeoutMs),
		})
		if (!response.ok) {
			return fail(
				`キャラセットを取得できませんでした（HTTP ${response.status}）`
			)
		}
		body = await readCapped(response, externalSetLimits.bytes)
	} catch (error) {
		return fail(
			error instanceof Error && error.name === 'TimeoutError'
				? 'キャラセットの取得がタイムアウトしました'
				: 'キャラセットを取得できませんでした'
		)
	}
	if (body === undefined) return fail('キャラセットが大きすぎます')

	const json = body.trimStart().startsWith('{') ? body : embeddedSet(body)
	if (json === undefined) {
		return fail(`ページに <script type="${embeddedSetType}"> が見つかりません`)
	}
	let document: unknown
	try {
		document = JSON.parse(json)
	} catch {
		return fail('キャラセットが JSON として読めません')
	}
	return parseExternalCharacterSet(document, source)
}

/**
 * How a page says "the roster is in here".
 *
 * A type nothing else claims, so the tag can be found without understanding
 * the rest of the document — which is the only reason it is safe to go
 * looking for it with a pattern rather than a parser. What comes out is JSON
 * and goes through the same checks as a JSON file, so the worst a malformed
 * page can do is not be found.
 */
export const embeddedSetType = 'application/masquerade-character-set+json'

function embeddedSet(html: string): string | undefined {
	// The type has a `+` in it, which is a repetition in a pattern and a
	// literal in a mime type. Getting that wrong fails silently: the tag is
	// simply never found, and the author is told their page has no roster.
	const type = embeddedSetType.replace(/[+/.]/g, '\\$&')
	const pattern = new RegExp(
		`<script[^>]*\\stype=["']${type}["'][^>]*>([\\s\\S]*?)</script`,
		'i'
	)
	return pattern.exec(html)?.[1]
}

/** The body, or a rejection — never more than `max` bytes into memory. */
async function readCapped(
	response: Response,
	max: number
): Promise<string | undefined> {
	const reader = response.body?.getReader()
	if (reader === undefined) return ''
	const chunks: Uint8Array[] = []
	let size = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.byteLength
		if (size > max) {
			await reader.cancel()
			return undefined
		}
		chunks.push(value)
	}
	const joined = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		joined.set(chunk, offset)
		offset += chunk.byteLength
	}
	return new TextDecoder().decode(joined)
}
