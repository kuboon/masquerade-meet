const key = (roomName: string) => `masquerade:character:${roomName}`

/**
 * The character this browser was last wearing in a given room.
 *
 * A reload is a departure as far as the room is concerned — the page says
 * goodbye on its way out and the seat is cleared — so coming back means being
 * dealt a new face unless the browser remembers the old one and asks for it.
 * Per room, because the same person is somebody else in the room next door.
 *
 * It is only ever a request. Whether it can be honoured is the room's to
 * decide, and it will not be if somebody else took the character meanwhile.
 */
export function rememberedCharacter(roomName: string): string | undefined {
	if (typeof window === 'undefined') return undefined
	try {
		return window.localStorage.getItem(key(roomName)) ?? undefined
	} catch {
		// Storage can be denied outright; being dealt a new character is a
		// perfectly good outcome, so there is nothing to report.
		return undefined
	}
}

export function rememberCharacter(roomName: string, characterId: string) {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(key(roomName), characterId)
	} catch {
		// ditto
	}
}
