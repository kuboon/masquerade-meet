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
 *
 * This entry point is Deno's, and it is the only part of the package that
 * knows about any runtime at all — everything it calls takes its I/O as an
 * argument. Hence the hand-written declaration below rather than an import:
 * a `node:` or `@types/deno` specifier in a published module would make the
 * package need types it cannot resolve in the bare checkout a release runs
 * from, and that failure only shows up at release time.
 */

import { checkTarget, report } from './report.ts'

/** The three things this needs from the runtime, and nothing more. */
const { args, readTextFile, exit } = (
	globalThis as unknown as {
		Deno: {
			args: string[]
			readTextFile(path: string): Promise<string>
			exit(code: number): never
		}
	}
).Deno

const target = args[0]
if (target === undefined) {
	console.error('使い方: cli <キャラセットの JSON ファイル か https:// の URL>')
	exit(1)
}

const { ok, lines } = report(target, await checkTarget(target, readTextFile))
for (const line of lines) (ok ? console.log : console.error)(line)
exit(ok ? 0 : 1)
