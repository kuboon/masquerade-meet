import { redirect, type LoaderFunctionArgs } from '@remix-run/cloudflare'
import { nanoid } from 'nanoid'
import { chosenSet } from '~/utils/chosenSet'

/**
 * A brand new room, for a browser that got here without JavaScript.
 *
 * The form on the front page normally settles this itself and never comes
 * here; this is the same decision made on the server, which is why it reads
 * the form through the same function rather than its own copy of the rule.
 *
 * It is also the address a third party's 「このキャラセットでマスカレードする」
 * button points at, with the roster's address already attached.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
	const params = new URL(request.url).searchParams
	const set = chosenSet(params)
	const roomName = nanoid(8)
	return redirect(
		'/' + roomName + (set ? '?set=' + encodeURIComponent(set) : '')
	)
}
