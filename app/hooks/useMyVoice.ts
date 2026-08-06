import { useCallback } from 'react'
import { useLocalStorage } from 'react-use'
import type { VoiceParams } from '~/utils/characters'

const KEY = 'masquerade:my-voice'

/**
 * The voice this person has settled on, if they have settled on one.
 *
 * Undefined until they touch a slider, and from then on it is theirs: the
 * character they are dealt supplies a starting point, not a verdict. Somebody
 * who spent the lobby getting their voice right does not want it taken away
 * by a draw they did not control.
 *
 * Kept per browser rather than per room. It is a voice they like the sound
 * of, which does not change between rooms, and it never reaches the server —
 * the disguise is applied to the outgoing track here.
 */
export default function useMyVoice() {
	const [stored, setStored] = useLocalStorage<VoiceParams | null>(KEY, null)
	const clear = useCallback(() => setStored(null), [setStored])
	const set = useCallback((next: VoiceParams) => setStored(next), [setStored])
	return [stored ?? undefined, set, clear] as const
}
