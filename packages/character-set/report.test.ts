import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkTarget, describeVoice, report } from './report.ts'

const good = {
	name: 'テスト一座',
	characters: [
		{
			id: 'bear',
			name: 'くま',
			emoji: '🐻',
			image: 'bear.png',
			voice: { size: -0.8, weight: -0.3, nasal: 0 },
		},
		{
			id: 'mouse',
			name: 'ねずみ',
			emoji: '🐭',
			image: 'mouse.png',
			voice: { size: 0, weight: 0, nasal: 0, roughness: 0.6 },
		},
	],
}

/** Writes a document to a real file, because reading one is the point. */
async function onDisk(document: unknown, name = 'set.json') {
	const dir = await mkdtemp(join(tmpdir(), 'masq-'))
	const path = join(dir, name)
	await writeFile(path, JSON.stringify(document))
	return path
}

describe('checkTarget', () => {
	it('checks a file on disk', async () => {
		const { set, problems } = await checkTarget(await onDisk(good))
		expect(problems).toEqual([])
		expect(set?.characters).toHaveLength(2)
	})

	it('says which file it could not read', async () => {
		const { problems } = await checkTarget('/no/such/set.json')
		expect(problems[0]).toContain('/no/such/set.json')
	})

	it('says so when the file is not JSON', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'masq-'))
		const path = join(dir, 'set.json')
		await writeFile(path, 'not json at all')
		expect((await checkTarget(path)).set).toBeUndefined()
	})
})

describe('report', () => {
	it('lists what is wrong, all of it', async () => {
		const path = await onDisk({
			...good,
			characters: [
				{ ...good.characters[0], voice: { size: 0, weight: 0, nasal: 0 } },
				{ ...good.characters[1], name: '' },
			],
		})
		const { ok, lines } = report(path, await checkTarget(path))
		expect(ok).toBe(false)
		expect(lines.join('\n')).toContain('地声')
		expect(lines.join('\n')).toContain('characters[1].name')
	})

	it('says how many people the set seats', async () => {
		// The number an author most often gets wrong, because it is not
		// written anywhere in their file — it is the length of the list.
		const path = await onDisk(good)
		const { ok, lines } = report(path, await checkTarget(path))
		expect(ok).toBe(true)
		expect(lines.join('\n')).toContain('2人 = ')
	})

	it('points out a character whose disguise is not its size', async () => {
		// A rasp counts, and this one is only a rasp: turn it down later and
		// that character quietly stops being a disguise.
		const path = await onDisk(good)
		const { lines } = report(path, await checkTarget(path))
		expect(lines.find((l) => l.includes('ねずみ'))).toContain('size 以外')
		expect(lines.find((l) => l.includes('くま'))).not.toContain('size 以外')
	})
})

describe('describeVoice', () => {
	it('says what a number of the scale actually does', () => {
		// -0.5 means nothing to anybody. Six semitones down is a tritone.
		expect(
			describeVoice({ size: -0.5, weight: 0, nasal: 0, roughness: 0 })
		).toBe('-6.0半音')
	})

	it('mentions a throat and a rasp only when there is one', () => {
		expect(
			describeVoice({
				size: 0.5,
				weight: 0,
				nasal: 0,
				roughness: 0.4,
				throat: -0.5,
			})
		).toBe('+6.0半音 / 口 -4.0半音 / かすれ 0.4')
	})
})
