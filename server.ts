import { createRequestHandler } from '@remix-run/cloudflare'
import * as build from '@remix-run/dev/server-build'
import type { Env } from '~/types/Env'
import { mode } from '~/utils/mode'
import { queue } from './app/queue'

/**
 * The Worker: Remix, and nothing else.
 *
 * Everything under `public/` is served by the platform before this runs — see
 * `[assets]` in wrangler.toml — so a request only reaches here when no file
 * matches it. That used to be this file's job, through Workers Sites and
 * `@cloudflare/kv-asset-handler`, along with a hand-written cache-control
 * policy for Remix's hashed bundles. Static Assets works that out from the
 * filenames itself.
 */
const remixHandler = createRequestHandler(build, mode)

export { ChatRoom } from './app/durableObjects/ChatRoom.server'
export { queue } from './app/queue'

export default {
	fetch(request: Request, env: Env) {
		return remixHandler(request, { env, mode })
	},
	queue,
}
