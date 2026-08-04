import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RoomPhase } from '~/types/Messages'
import { getCharacter, getCharacterSet } from '~/utils/characterSets'
import { neutralVoice } from '~/utils/characters'
import { canStartMeeting } from '~/utils/masquerade'
import { setVoiceParams } from '~/utils/voiceChanger'
import type useRoom from './useRoom'
import type { UserMedia } from './useUserMedia'

/**
 * Owns everything about the masquerade: who is behind which character, when
 * the meeting may start, and the moment the masks come off.
 *
 * The countdown deliberately runs off a locally computed deadline rather than
 * off render-time state updates, so every participant drops their disguise at
 * the same wall-clock instant even if a state broadcast is delayed.
 */
export default function useMasquerade({
	room,
	userMedia,
}: {
	room: ReturnType<typeof useRoom>
	userMedia: UserMedia
}) {
	const { roomState, identity, send } = room
	const { phase, hostId, revealAt, serverNow, characterSetId } =
		roomState.masquerade

	const isHost = Boolean(identity && hostId === identity.id)
	const characterSet = getCharacterSet(characterSetId)
	const character = getCharacter(characterSet, identity?.characterId)

	// Translate the server's deadline onto this machine's clock. Only the
	// interval between revealAt and serverNow matters, so a wrong system clock
	// cannot skew the countdown.
	const [localRevealAt, setLocalRevealAt] = useState<number>()
	useEffect(() => {
		if (phase !== 'revealing' || revealAt === undefined) {
			setLocalRevealAt(undefined)
			return
		}
		setLocalRevealAt(Date.now() + (revealAt - serverNow))
		// serverNow is intentionally excluded: it is only meaningful paired with
		// the revealAt it arrived with, and re-running on every heartbeat would
		// jitter the deadline.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [phase, revealAt])

	const [revealed, setRevealed] = useState(phase === 'revealed')
	useEffect(() => {
		if (phase === 'revealed') {
			setRevealed(true)
			return
		}
		setRevealed(false)
		if (phase !== 'revealing' || localRevealAt === undefined) return
		const timeout = setTimeout(
			() => setRevealed(true),
			Math.max(0, localRevealAt - Date.now())
		)
		return () => clearTimeout(timeout)
	}, [phase, localRevealAt])

	// Whole seconds still on the clock: 5, 4, 3, 2, 1.
	const [countdown, setCountdown] = useState<number>()
	useEffect(() => {
		if (phase !== 'revealing' || localRevealAt === undefined || revealed) {
			setCountdown(undefined)
			return
		}
		const tick = () =>
			setCountdown(Math.max(0, Math.ceil((localRevealAt - Date.now()) / 1000)))
		tick()
		const interval = setInterval(tick, 100)
		return () => clearInterval(interval)
	}, [phase, localRevealAt, revealed])

	// The disguise itself. Retargets the live audio graph, so switching
	// characters or dropping the mask is seamless.
	useEffect(() => {
		setVoiceParams(revealed || !character ? neutralVoice : character.voice)
	}, [revealed, character])

	// A camera that is never sent cannot give anyone away. It comes back on
	// automatically at the reveal, which is the whole payoff.
	const { turnCameraOn, turnCameraOff } = userMedia
	useEffect(() => {
		if (revealed) turnCameraOn()
		else turnCameraOff()
	}, [revealed, turnCameraOn, turnCameraOff])

	const participants = roomState.users
	const takenCharacterIds = useMemo(
		() =>
			new Set(
				participants
					.filter((u) => u.id !== identity?.id && u.characterId)
					.map((u) => u.characterId!)
			),
		[participants, identity?.id]
	)

	const everyoneReady =
		participants.length > 0 && participants.every((u) => u.ready)

	return {
		phase: phase as RoomPhase,
		/** true once this client has actually dropped its disguise */
		revealed,
		countdown,
		isHost,
		hostId,
		character,
		/** the roster this room is hiding behind */
		characterSet,
		/**
		 * Resolve a character within this room's set. Handed out so components
		 * deeper in the tree do not have to be passed the set itself.
		 */
		getCharacter: useCallback(
			(characterId?: string) => getCharacter(characterSet, characterId),
			[characterSet]
		),
		participants,
		takenCharacterIds,
		everyoneReady,
		/** the same rule the room enforces, so the button cannot over-promise */
		canStart: canStartMeeting(participants),
		readyCount: participants.filter((u) => u.ready).length,
		/** the meeting is under way — the lobby should hand over to the room */
		meetingStarted: phase !== 'lobby',
		selectCharacter: useCallback(
			(characterId: string) => send({ type: 'selectCharacter', characterId }),
			[send]
		),
		setReady: useCallback(
			(ready: boolean) => send({ type: 'setReady', ready }),
			[send]
		),
		startMeeting: useCallback(() => send({ type: 'startMeeting' }), [send]),
		startReveal: useCallback(() => send({ type: 'startReveal' }), [send]),
	}
}

export type Masquerade = ReturnType<typeof useMasquerade>
