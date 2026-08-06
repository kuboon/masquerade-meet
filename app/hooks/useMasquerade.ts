import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RoomPhase } from '~/types/Messages'
import { getCharacter, getCharacterSet } from '~/utils/characterSets'
import { neutralVoice } from '~/utils/characters'
import { canRestartMeeting, canStartMeeting } from '~/utils/masquerade'
import { stillImage$ } from '~/utils/stillImage'
import { setVoiceParams } from '~/utils/voiceChanger'
import useMyVoice from './useMyVoice'
import type useRoom from './useRoom'
import { allowStillImage, type UserMedia } from './useUserMedia'

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
	const { phase, hostId, revealAt, serverNow, characterSetId, seats, startAt } =
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

	// The meeting's own deadline, read the same way as the reveal's: only the
	// interval matters, so a client whose clock is wrong still counts down
	// with everybody else.
	const [localStartAt, setLocalStartAt] = useState<number>()
	useEffect(() => {
		if (startAt === undefined) {
			setLocalStartAt(undefined)
			return
		}
		setLocalStartAt(Date.now() + (startAt - serverNow))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [startAt])

	const [startingIn, setStartingIn] = useState<number>()
	useEffect(() => {
		if (localStartAt === undefined) {
			setStartingIn(undefined)
			return
		}
		const tick = () =>
			setStartingIn(Math.max(0, Math.ceil((localStartAt - Date.now()) / 1000)))
		tick()
		const interval = setInterval(tick, 100)
		return () => clearInterval(interval)
	}, [localStartAt])

	// The disguise itself. Retargets the live audio graph, so switching
	// characters or dropping the mask is seamless.
	// Whatever they tuned wins over whatever they were dealt: somebody who
	// spent the lobby getting their voice right does not want it taken away by
	// a draw they had no say in.
	const [myVoice, setMyVoice, clearMyVoice] = useMyVoice()
	const wornVoice = myVoice ?? character?.voice ?? neutralVoice
	useEffect(() => {
		setVoiceParams(revealed || !character ? neutralVoice : wornVoice)
	}, [revealed, character, wornVoice])

	// A camera that is never sent cannot give anyone away. It comes back on
	// automatically at the reveal, which is the whole payoff — unless a
	// picture has been registered, in which case that is the point: showing
	// something other than your face. Turning the camera on by hand still
	// wins over the picture.
	const { turnCameraOn, turnCameraOff } = userMedia
	useEffect(() => {
		allowStillImage(revealed)
		if (!revealed) {
			turnCameraOff()
			return
		}
		if (stillImage$.value === null) turnCameraOn()
	}, [revealed, turnCameraOn, turnCameraOff])

	const participants = roomState.users

	return {
		phase: phase as RoomPhase,
		/** true once this client has actually dropped its disguise */
		revealed,
		countdown,
		/** seconds until the meeting begins, once the host has said go */
		startingIn,
		/** the host has set it going and nobody can stop it now */
		starting: startAt !== undefined,
		isHost,
		hostId,
		character,
		/** the roster this room is hiding behind */
		characterSet,
		/**
		 * Who sits where, by connection id. The same on every screen, and
		 * unchanged by anybody coming or going — an empty seat stays empty
		 * until its owner returns or the host clears it.
		 */
		seats: useMemo(() => seats ?? [], [seats]),
		/**
		 * Resolve a character within this room's set. Handed out so components
		 * deeper in the tree do not have to be passed the set itself.
		 */
		getCharacter: useCallback(
			(characterId?: string) => getCharacter(characterSet, characterId),
			[characterSet]
		),
		participants,
		/** the same rule the room enforces, so the button cannot over-promise */
		canStart: canStartMeeting(participants, characterSet.characters.length),
		/** the host may run the whole thing again with the same people */
		canRestart: canRestartMeeting(phase),
		/** the meeting is under way — the lobby should hand over to the room */
		meetingStarted: phase !== 'lobby',
		selectCharacter: useCallback(
			(characterId: string) => send({ type: 'selectCharacter', characterId }),
			[send]
		),
		setDisplayName: useCallback(
			(name: string) => send({ type: 'setDisplayName', name }),
			[send]
		),
		startMeeting: useCallback(() => send({ type: 'startMeeting' }), [send]),
		startReveal: useCallback(() => send({ type: 'startReveal' }), [send]),
		restartMeeting: useCallback(() => send({ type: 'restartMeeting' }), [send]),
		/** the voice going out: theirs if they tuned one, else the character's */
		wornVoice,
		/** true once they have tuned one of their own */
		voiceCustomised: myVoice !== undefined,
		setMyVoice,
		clearMyVoice,
		removeSeat: useCallback(
			(seatId: string) => send({ type: 'removeSeat', seatId }),
			[send]
		),
	}
}

export type Masquerade = ReturnType<typeof useMasquerade>
