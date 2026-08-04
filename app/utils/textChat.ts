/** A chat message as the client keeps it, once it has arrived. */
export type ChatMessage = {
	id: string
	/** the sender's connection id */
	from: string
	body: string
	at: number
	/**
	 * The name the sender was wearing when this arrived. Only used once they
	 * are gone from the room and can no longer be looked up — see below.
	 */
	nameWhenSent: string
}

/**
 * Who a message is from, as it should be shown right now.
 *
 * The message itself never carries a name. Resolving it against the current
 * roster on every render is what makes the whole log unmask at once: the
 * room serves character names until the reveal and real names after it, so
 * a line typed from behind a mask turns out to have been said by somebody
 * the moment everyone's face appears.
 *
 * The name captured on arrival is the fallback, for a sender who has since
 * left: they are out of the roster, and the room has forgotten their real
 * name along with the rest of their session, so the mask is all that is
 * left of them.
 */
export function chatSender(
	message: Pick<ChatMessage, 'from' | 'nameWhenSent'>,
	users: { id: string; name: string; characterId?: string }[],
	/**
	 * The mask to show beside the name, once there is a name to show it
	 * beside. Only after the reveal, where it answers the question the whole
	 * meeting was about: so *that* was who the bear was.
	 */
	characterName?: (characterId?: string) => string | undefined
): { name: string; character?: string } {
	const user = users.find((u) => u.id === message.from)
	// Nobody to look up: they have left, the room has forgotten their real
	// name with the rest of their session, and the mask is all that is left.
	if (!user) return { name: message.nameWhenSent }

	const character = characterName?.(user.characterId)
	// Before the reveal the name *is* the character, and saying it twice
	// would be an odd way to keep a secret.
	if (!character || character === user.name) return { name: user.name }
	return { name: user.name, character }
}

// Only with a scheme, and only these two: a bare domain is as likely to be
// prose, and anything else is a way to put a javascript: URL in front of
// somebody. Stops at whitespace and at the characters that would let a
// message close the tag it is written into.
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g

/** Punctuation that ends a sentence rather than a URL. */
const TRAILING = /[.,;:!?"'”’、。，．！？…]+$/

function withoutTrailingPunctuation(url: string): string {
	let trimmed = url.replace(TRAILING, '')
	// A closing bracket belongs to the URL if the URL opened one, and to the
	// sentence around it otherwise — "(see https://example.com)".
	while (
		(trimmed.endsWith(')') && !trimmed.includes('(')) ||
		(trimmed.endsWith('）') && !trimmed.includes('（'))
	) {
		trimmed = trimmed.slice(0, -1)
	}
	return trimmed
}

export type MessagePart =
	| { type: 'text'; value: string }
	| { type: 'link'; value: string }

/**
 * A message body split into the bits that are links and the bits that are not.
 *
 * Done here rather than with a regex in the markup so that the awkward part —
 * where a URL ends and the sentence resumes — can be pinned down in a test.
 */
export function linkify(body: string): MessagePart[] {
	const parts: MessagePart[] = []
	let cursor = 0
	for (const match of body.matchAll(URL_PATTERN)) {
		const url = withoutTrailingPunctuation(match[0])
		if (url === '') continue
		const start = match.index
		if (start > cursor) {
			parts.push({ type: 'text', value: body.slice(cursor, start) })
		}
		parts.push({ type: 'link', value: url })
		cursor = start + url.length
	}
	if (cursor < body.length) {
		parts.push({ type: 'text', value: body.slice(cursor) })
	}
	return parts
}
