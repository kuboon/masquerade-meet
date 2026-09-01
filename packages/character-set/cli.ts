/**
 * Check a character set before anybody follows a link to it.
 *
 * ```
 * deno run --allow-read=set.json jsr:@kuboon/masquerade-character-set/cli set.json
 * deno run --allow-net=example.com jsr:@kuboon/masquerade-character-set/cli https://example.com/set.json
 * ```
 *
 * One permission, and only the one the argument needs: reading that file, or
 * reaching that host. Not `-A` — this reads a document somebody else wrote
 * and then goes to the address it names, which is the last thing to hand the
 * whole machine to. Run it with nothing at all and it still works up to the
 * point where it needs something, then names the flag.
 *
 * A room that cannot use your set does not say so to whoever followed the
 * link — it opens with its own characters instead. So this is the only place
 * you will hear about it.
 *
 * An https address is fetched exactly as a room would fetch it, which is the
 * check that answers the question you actually have. A local path is read off
 * disk and checked as if it had been served from somewhere, which catches
 * everything except whether the images are really there.
 *
 * Exits 0 if a room could wear it, 1 if not. Nothing is uploaded anywhere,
 * and the only thing it ever fetches is the address you gave it.
 */

import process from 'node:process'
import { checkTarget, report } from './report.ts'

const target = process.argv[2]
if (target === undefined) {
	console.error('使い方: cli <キャラセットの JSON ファイル か https:// の URL>')
	process.exitCode = 1
} else {
	checkTarget(target).then((result) => {
		const { ok, lines } = report(target, result)
		for (const line of lines) (ok ? console.log : console.error)(line)
		process.exitCode = ok ? 0 : 1
	})
}
