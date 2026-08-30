/**
 * Which roster a new room was asked for, out of the creation form.
 *
 * Two fields rather than one because they are two different things: a radio
 * naming one of ours, and an address somebody pasted. A pasted address wins,
 * on the grounds that nobody types one out by accident while a radio always
 * has something selected.
 *
 * Shared with `/new`, which is the same decision made on the server for a
 * browser that submitted the form before the JavaScript arrived. The two
 * paths have to agree, and the way to make sure of that is for there to be
 * only one of them.
 */
export function chosenSet(
	form: Pick<FormData | URLSearchParams, 'get'>
): string | undefined {
	const url = form.get('setUrl')
	if (typeof url === 'string' && url.trim() !== '') return url.trim()
	const set = form.get('set')
	return typeof set === 'string' && set !== '' ? set : undefined
}
