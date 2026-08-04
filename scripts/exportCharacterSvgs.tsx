/**
 * Freezes the parametric avatars into static SVG files.
 *
 * The characters used to be drawn at runtime from `face` and `colors` by
 * CharacterAvatar. Moving to image files means that renderer goes away, so
 * this runs it one last time and writes what it produced to disk — the look
 * survives the change untouched, because it is literally the same code.
 *
 * Run once with `npm run export:character-svgs`, then delete this script
 * along with the renderer. It cannot outlive the fields it reads.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { CharacterAvatar } from '~/components/CharacterAvatar'
import animals from '~/utils/characterSets/animals'

const outDir = join(process.cwd(), 'public', 'characters', animals.id)
mkdirSync(outDir, { recursive: true })

for (const character of animals.characters) {
	// React omits the xmlns, and a standalone file served as image/svg+xml
	// will not render inside an <img> without it. The explicit width/height
	// give the file an intrinsic size so every browser lays it out the same.
	const markup = renderToStaticMarkup(<CharacterAvatar character={character} />)
		// The Tailwind sizing classes are meaningless once the SVG is a file of
		// its own; the <img> that embeds it does the sizing now.
		.replace(' class="h-full w-full"', '')
		.replace(
			'<svg ',
			'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" '
		)

	writeFileSync(
		join(outDir, `${character.id}.svg`),
		`<?xml version="1.0" encoding="UTF-8"?>\n${markup}\n`
	)
	console.log(`wrote ${animals.id}/${character.id}.svg`)
}
