import type { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { routePartykitRequest } from 'partyserver'

// handles get requests
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	// No name is required to connect. It is asked for in the lobby, and the
	// room refuses to let anyone ready up until they have given one.
	const partyResponse = await routePartykitRequest(request, context.env)

	return partyResponse || new Response('Not found', { status: 404 })
}
