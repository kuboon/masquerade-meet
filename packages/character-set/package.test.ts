import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The two manifests, held to each other.
 *
 * This package is published to JSR and, in this repository, linked into the
 * app as an npm workspace under the same name — so the app imports it exactly
 * the way anybody else does, rather than reaching into `packages/` with a
 * relative path. That takes two manifests: `jsr.json` is what is published,
 * `package.json` is what npm links.
 *
 * Two manifests is one more than anybody remembers to edit. A name or an
 * export that only got changed in one of them fails in the least helpful
 * place available — an import that resolves locally and 404s for everybody
 * who installed it — so they are checked against each other here instead.
 */

const read = (name: string) =>
	JSON.parse(readFileSync(join(__dirname, name), 'utf8'))

const jsr = read('jsr.json')
const npm = read('package.json')

describe('the published package', () => {
	it('goes out under one name', () => {
		expect(npm.name).toBe(jsr.name)
	})

	it('goes out as one version', () => {
		// Only JSR enforces this on publish; npm never sees it. Without this
		// the workspace can drift a version behind for good.
		expect(npm.version).toBe(jsr.version)
	})

	it('offers the same entry points to both', () => {
		expect(npm.exports).toEqual(jsr.exports)
	})

	it('points every entry point at a file that exists', () => {
		for (const [name, path] of Object.entries<string>(jsr.exports)) {
			expect(() => readFileSync(join(__dirname, path)), name).not.toThrow()
		}
	})

	it('says the same licence the repository does', () => {
		expect(npm.license).toBe(jsr.license)
		expect(jsr.license).toBe(
			JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))
				.license
		)
	})
})
