import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare'
import { routePartyTracksRequest } from 'partytracks/server'

/**
 * The proxy in front of Cloudflare Realtime.
 *
 * Guarded rather than passed straight through, because of what happens
 * without credentials: the client signs its request with a zero-length key
 * and the runtime throws `DataError: Imported HMAC key length (0)` — from
 * inside a library, unhandled, once per attempt, several times a second for
 * as long as anybody has the page open. Nothing in that says "the secrets
 * are missing", which is exactly the shape the outage took when a broken
 * sync wrote empty strings over both of them.
 *
 * So: say so, in one line, with the names of the things to set.
 */
const proxy = async ({ request, context }: LoaderFunctionArgs) => {
	const appId = context.env.CALLS_APP_ID
	const token = context.env.CALLS_APP_SECRET
	if (!appId || !token) {
		return json(
			{
				error:
					'Cloudflare Realtime の認証情報がありません。CALLS_APP_ID と CALLS_APP_SECRET を設定してください。',
			},
			{ status: 503 }
		)
	}
	return routePartyTracksRequest({
		appId,
		token,
		realtimeApiBaseUrl: context.env.CALLS_API_URL,
		request,
	})
}

export const loader = proxy
export const action = proxy
