import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RoomPhase } from '~/types/Messages'
import {
	getCharacter,
	isBuiltInSet,
	roomCharacterSet,
} from '~/utils/characterSets'
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
	const {
		roomState,
		identity,
		send,
		lostCharacter,
		clearLostCharacter,
		myRole,
		roleDeal,
		externalCharacterSet,
	} = room
	const {
		phase,
		hostId,
		revealAt,
		serverNow,
		characterSetId,
		characterSetProblem,
		seats,
		startAt,
		roleDeck,
		gameMasterId,
	} = roomState.masquerade

	const isHost = Boolean(identity && hostId === identity.id)
	const isGameMaster = Boolean(identity && gameMasterId === identity.id)
	const characterSet = roomCharacterSet(characterSetId, externalCharacterSet)
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
	//
	// Whatever they tuned wins over whatever the character says — on the four
	// axes they were offered. `throat` is not one of them: it belongs to the
	// mask rather than to the body behind it, so it survives the tuning
	// instead of being flattened to zero by a slider that cannot reach it.
	const [myVoice, setMyVoice, clearMyVoice] = useMyVoice()
	const throat = character?.voice.throat
	const wornVoice = useMemo(
		() =>
			myVoice ? { ...myVoice, throat } : (character?.voice ?? neutralVoice),
		[myVoice, throat, character]
	)
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
		/** the cards in play, in the order the host typed them */
		roleDeck: useMemo(() => roleDeck ?? [], [roleDeck]),
		gameMasterId,
		/** this client is dealing rather than playing: no card, no disguise */
		isGameMaster,
		/** the card this client is holding, once the room has dealt */
		myRole,
		character,
		/** the roster this room is hiding behind */
		characterSet,
		/**
		 * Whose roster it is. A borrowed one is worth saying out loud: the
		 * artwork comes from somebody else's server, so their server sees
		 * every participant ask for it.
		 */
		characterSetIsBorrowed: !isBuiltInSet(characterSet),
		/**
		 * Why the room is not wearing the set it was opened with, if it is
		 * not. The room carries on with our own faces either way.
		 */
		characterSetProblem,
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
			(characterId: string) => {
				clearLostCharacter()
				send({ type: 'selectCharacter', characterId })
			},
			[send, clearLostCharacter]
		),
		/** take the wish, if nobody has taken it first */
		confirmCharacter: useCallback(
			() => send({ type: 'confirmCharacter' }),
			[send]
		),
		/** true once this character is theirs and cannot be changed */
		confirmed: Boolean(identity?.characterConfirmed),
		/**
		 * The characters somebody else has taken, and nobody may pick now.
		 * Their own is left out: a settled choice is not out of reach.
		 *
		 * Derived rather than sent as a list of its own — the room already
		 * says who holds what.
		 */
		takenByOthers: useMemo(
			() =>
				participants
					.filter(
						(u) =>
							u.id !== identity?.id && u.characterConfirmed && u.characterId
					)
					.map((u) => u.characterId!),
			[participants, identity?.id]
		),
		/** how many of the people waiting have settled on a face */
		confirmedCount: participants.filter((u) => u.characterConfirmed).length,
		/** the one they reached for a moment too late, until they pick again */
		lostCharacter,
		setDisplayName: useCallback(
			(name: string) => send({ type: 'setDisplayName', name }),
			[send]
		),
		/**
		 * Somebody's card, if this client is allowed to know it.
		 *
		 * After the reveal that is everybody's, from the room state. Before it,
		 * only the game master knows anything, and only from the deal they were
		 * sent — the room never puts a card in the shared state early.
		 */
		roleOf: useCallback(
			(userId: string) =>
				revealed
					? participants.find((u) => u.id === userId)?.role
					: roleDeal?.[userId],
			[revealed, participants, roleDeal]
		),
		setRoleDeck: useCallback(
			(text: string) => send({ type: 'setRoleDeck', text }),
			[send]
		),
		setGameMaster: useCallback(
			(isGameMaster: boolean) => send({ type: 'setGameMaster', isGameMaster }),
			[send]
		),
		startMeeting: useCallback(
			(rolePlan?: Record<string, string>) =>
				send({ type: 'startMeeting', rolePlan }),
			[send]
		),
		startReveal: useCallback(() => send({ type: 'startReveal' }), [send]),
		restartMeeting: useCallback(() => send({ type: 'restartMeeting' }), [send]),
		/**
		 * The voice going out: theirs if they tuned one, else the
		 * character's — and the character's throat either way.
		 */
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
