#!/usr/bin/env node
/**
 * Uploads everything in .dev.vars to the deployed Worker as secrets.
 *
 * The same file already drives `wrangler dev`, so this keeps local and
 * deployed configuration in one place instead of asking you to type each
 * value again into `wrangler secret put`. Wrangler's `secret bulk` wants
 * JSON on stdin, so the dotenv file is translated on the way through.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ENV_FILE = '.dev.vars'

function parseDotenv(text) {
	const values = {}
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim()
		if (line === '' || line.startsWith('#')) continue
		const eq = line.indexOf('=')
		if (eq === -1) continue
		const key = line.slice(0, eq).trim()
		let value = line.slice(eq + 1).trim()
		// strip one layer of matching quotes, the way dotenv does
		if (
			(value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
			(value.startsWith("'") && value.endsWith("'") && value.length > 1)
		) {
			value = value.slice(1, -1)
		}
		if (key) values[key] = value
	}
	return values
}

let contents
try {
	contents = readFileSync(ENV_FILE, 'utf8')
} catch {
	console.error(
		`Could not read ${ENV_FILE}.\n` +
			`Copy .dev.vars.example to ${ENV_FILE} and fill in your Cloudflare Realtime credentials first.`
	)
	process.exit(1)
}

const secrets = parseDotenv(contents)
const names = Object.keys(secrets)

if (names.length === 0) {
	console.error(`${ENV_FILE} has no values in it, nothing to upload.`)
	process.exit(1)
}

const missing = ['CALLS_APP_ID', 'CALLS_APP_SECRET'].filter(
	(name) => !secrets[name]
)
if (missing.length > 0) {
	console.error(
		`${ENV_FILE} is missing ${missing.join(' and ')}. ` +
			`The app cannot reach the Realtime SFU without ${missing.length > 1 ? 'them' : 'it'}.`
	)
	process.exit(1)
}

console.log(`Uploading ${names.length} secrets: ${names.join(', ')}`)

const result = spawnSync('wrangler', ['secret', 'bulk'], {
	input: JSON.stringify(secrets),
	stdio: ['pipe', 'inherit', 'inherit'],
	shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
