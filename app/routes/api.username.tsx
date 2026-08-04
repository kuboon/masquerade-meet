import { type ActionFunctionArgs } from '@remix-run/cloudflare'
import invariant from 'tiny-invariant'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import { setUsername } from '~/utils/getUsername.server'
import { safeRedirect } from '~/utils/safeReturnUrl'

/**
 * Stores the display name and sends the browser back where it came from.
 *
 * An action-only route rather than a page: the name is asked for in the
 * lobby now, and the form that asks lives in a layout rather than in the
 * leaf route the URL points at.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
	const form = await request.formData()
	const returnUrl = form.get('return-url')
	invariant(typeof returnUrl === 'string')

	// Behind Cloudflare Access the name is not ours to set.
	if (request.headers.get(ACCESS_AUTHENTICATED_USER_EMAIL_HEADER)) {
		throw safeRedirect(returnUrl)
	}

	const username = form.get('username')
	invariant(typeof username === 'string')
	return setUsername(username, request, returnUrl)
}
