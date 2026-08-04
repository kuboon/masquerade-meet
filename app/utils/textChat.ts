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
export function chatSenderName(
	message: Pick<ChatMessage, 'from' | 'nameWhenSent'>,
	users: { id: string; name: string }[]
): string {
	return users.find((u) => u.id === message.from)?.name ?? message.nameWhenSent
}
