/**
 * Check a character set before anybody follows a link to it.
 *
 * ```
 * npx jsrex @kuboon/masquerade-character-set/cli set.json
 * deno run --allow-read=set.json jsr:@kuboon/masquerade-character-set/cli set.json
 * ```
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
 * Under Deno, give it the one permission the argument needs — `--allow-read`
 * for a file, `--allow-net=<host>` for a URL — rather than `-A`. This reads a
 * document somebody else wrote and then goes to the address it names, which
 * is the last thing to hand the whole machine to. Run it with nothing at all
 * and it still works up to the point where it needs something, then names the
 * flag. Node has no such thing to give it; that is Node, not a choice here.
 */

import { checkTarget, report } from './report.ts'

/**
 * What this needs from whichever runtime is hosting it.
 *
 * Reached through globals and declared by hand rather than imported, and that
 * is load-bearing twice over. A `node:` specifier anywhere in a published
 * module makes the whole package demand `@types/node` to type-check, which it
 * cannot get in the bare checkout a release runs from — and importing one
 * would also make this file Node-only, when the same three operations exist
 * on both runtimes under different names.
 *
 * `process.getBuiltinModule` is Node's own way to reach a builtin without an
 * import (Node 22.3 and later), which is exactly the hole this needs.
 */
interface Host {
	Deno?: {
		args: string[]
		readTextFile(path: string): Promise<string>
		exit(code: number): never
	}
	process?: {
		argv: string[]
		exitCode?: number
		getBuiltinModule?(id: 'fs'): {
			promises: { readFile(path: string, encoding: 'utf8'): Promise<string> }
		}
	}
}

const { Deno, process } = globalThis as unknown as Host

const args = Deno ? Deno.args : (process?.argv.slice(2) ?? [])

function readTextFile(path: string): Promise<string> {
	if (Deno) return Deno.readTextFile(path)
	const fs = process?.getBuiltinModule?.('fs')
	if (fs) return fs.promises.readFile(path, 'utf8')
	return Promise.reject(
		new Error(
			'この実行環境ではローカルのファイルを読めません。URL を渡してください'
		)
	)
}

/** Node has no `exit` worth using here — a set exit code ends it cleanly. */
function finish(code: number): void {
	if (Deno) Deno.exit(code)
	else if (process) process.exitCode = code
}

const target = args[0]
if (target === undefined) {
	console.error('使い方: cli <キャラセットの JSON ファイル か https:// の URL>')
	finish(1)
} else {
	const { ok, lines } = report(target, await checkTarget(target, readTextFile))
	for (const line of lines) (ok ? console.log : console.error)(line)
	finish(ok ? 0 : 1)
}
