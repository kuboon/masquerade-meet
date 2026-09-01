/**
 * Checking a set from the outside, and saying what came back in words.
 *
 * Kept apart from `cli.ts` so that all of it can be called from a test or a
 * build script: `cli.ts` is only argv, stdout and an exit code.
 */

import { readFile } from 'node:fs/promises'
import {
	checkCharacterSet,
	fetchCharacterSet,
	isDisguised,
	VOICE_RANGE,
	type CheckResult,
} from './check.ts'

/**
 * Where a local file is pretended to live while it is checked.
 *
 * Relative image paths have to resolve against something, and a set on disk
 * has not been published anywhere yet. `.invalid` can never be a real host,
 * so nothing here can accidentally reach out — which also means a set that
 * passes on disk can still fail once its images are somewhere real. Check
 * the published address too.
 */
const onDisk = 'https://example.invalid/'

/** Checks a set, wherever it is. */
export async function checkTarget(target: string): Promise<CheckResult> {
	if (/^https?:\/\//.test(target)) return fetchCharacterSet(target)

	let document: unknown
	try {
		document = JSON.parse(await readFile(target, 'utf8'))
	} catch (error) {
		return {
			set: undefined,
			problems: [`${target} を読めません: ${(error as Error).message}`],
		}
	}
	return checkCharacterSet(
		document,
		new URL(target.replace(/^\.?\/+/, ''), onDisk)
	)
}

/** How far a voice travels, in the units the engine speaks. */
export function describeVoice(voice: {
	size: number
	weight: number
	nasal: number
	roughness: number
	throat?: number
}): string {
	const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`
	const parts = [`${signed(voice.size * VOICE_RANGE.sizeSemitones)}半音`]
	const throat = (voice.throat ?? 0) * VOICE_RANGE.throatSemitones
	if (throat !== 0) parts.push(`口 ${signed(throat)}半音`)
	if (voice.roughness > 0) parts.push(`かすれ ${voice.roughness}`)
	return parts.join(' / ')
}

/** What to print, and whether a room could wear this. */
export function report(
	target: string,
	{ set, problems }: CheckResult
): { ok: boolean; lines: string[] } {
	if (set === undefined) {
		return {
			ok: false,
			lines: [
				`✗ ${target} はこのままでは使えません`,
				'',
				...problems.map((problem) => `  - ${problem}`),
			],
		}
	}
	return {
		ok: true,
		lines: [
			`✓ ${set.name}`,
			`  ${set.characters.length}人 = このセットで開いたルームの定員`,
			'',
			...set.characters.map((character) => {
				// The disguise rule is what refuses a set, so it is worth seeing
				// which characters are carried by a rasp or a throat rather than
				// by their size — those are the ones a later edit can break.
				const bySize = isDisguised({
					...character.voice,
					roughness: 0,
					throat: 0,
				})
				return (
					`  ${character.emoji} ${character.name.padEnd(10)} ` +
					describeVoice(character.voice) +
					(bySize ? '' : '   ※ 変装が size 以外に頼っています')
				)
			}),
		],
	}
}
