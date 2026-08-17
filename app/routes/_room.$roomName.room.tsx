import type { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import {
	useLoaderData,
	useNavigate,
	useParams,
	useSearchParams,
} from '@remix-run/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMount } from 'react-use'
import { AiButton } from '~/components/AiButton'
import { ButtonLink } from '~/components/Button'
import { CameraButton } from '~/components/CameraButton'
import { CopyButton } from '~/components/CopyButton'
import { HighPacketLossWarningsToast } from '~/components/HighPacketLossWarningsToast'
import { IceDisconnectedToast } from '~/components/IceDisconnectedToast'
import { LeaveRoomButton } from '~/components/LeaveRoomButton'
import { MicButton } from '~/components/MicButton'
import { OverflowMenu } from '~/components/OverflowMenu'
import { ParticipantLayout } from '~/components/ParticipantLayout'
import { ParticipantsButton } from '~/components/ParticipantsMenu'
import { PullAudioTracks } from '~/components/PullAudioTracks'
import { RaiseHandButton } from '~/components/RaiseHandButton'
import { RestartButton } from '~/components/RestartButton'
import { RevealButton } from '~/components/RevealButton'
import { RevealCountdown } from '~/components/RevealCountdown'
import { RoleCard } from '~/components/RoleCard'
import { SafetyNumberToast } from '~/components/SafetyNumberToast'
import { ScreenshareButton } from '~/components/ScreenshareButton'
import { ChatButton, TextChat } from '~/components/TextChat'
import Toast, { useDispatchToast } from '~/components/Toast'
import useBroadcastStatus from '~/hooks/useBroadcastStatus'
import useIsSpeaking from '~/hooks/useIsSpeaking'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useShowDebugInfoShortcut } from '~/hooks/useShowDebugInfoShortcut'
import useSounds from '~/hooks/useSounds'
import useTextChat from '~/hooks/useTextChat'
import { useUserJoinLeaveToasts } from '~/hooks/useUserJoinLeaveToasts'
import { dashboardLogsLink } from '~/utils/dashboardLogsLink'
import getUsername from '~/utils/getUsername.server'
import isNonNullable from '~/utils/isNonNullable'
import { screenshareTile, stageTiles } from '~/utils/stage'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const username = await getUsername(request)

	return json({
		username,
		bugReportsEnabled: Boolean(
			context.env.FEEDBACK_URL &&
				context.env.FEEDBACK_QUEUE &&
				context.env.FEEDBACK_STORAGE
		),
		disableLobbyEnforcement: context.env.DISABLE_LOBBY_ENFORCEMENT === 'true',
		mode: context.mode,
		hasDb: Boolean(context.env.DB),
		hasAiCredentials: Boolean(
			context.env.OPENAI_API_TOKEN && context.env.OPENAI_MODEL_ENDPOINT
		),
		dashboardDebugLogsBaseUrl: context.env.DASHBOARD_WORKER_URL,
	})
}

export default function Room() {
	const { joined, setJoined, masquerade } = useRoomContext()
	const navigate = useNavigate()
	const { roomName } = useParams()
	const { mode, bugReportsEnabled, disableLobbyEnforcement } =
		useLoaderData<typeof loader>()
	const [search] = useSearchParams()

	// The host can send everybody back for another round. Characters are picked
	// in the lobby and nowhere else, so this walks out of the meeting even where
	// the guard below would let someone stay — but only on the way back from a
	// meeting, so opening this route directly still works in development.
	const wasInMeeting = useRef(false)
	useEffect(() => {
		if (masquerade.phase !== 'lobby') {
			wasInMeeting.current = true
			return
		}
		if (!wasInMeeting.current) return
		wasInMeeting.current = false
		setJoined(false)
		navigate(`/${roomName}${search.size > 0 ? '?' + search.toString() : ''}`)
	}, [masquerade.phase, setJoined, navigate, roomName, search])

	useEffect(() => {
		if (!joined && mode !== 'development' && !disableLobbyEnforcement)
			navigate(`/${roomName}${search.size > 0 ? '?' + search.toString() : ''}`)
	}, [joined, mode, navigate, roomName, search, disableLobbyEnforcement])

	if (!joined && mode !== 'development' && !disableLobbyEnforcement) return null

	return (
		<Toast.Provider>
			<JoinedRoom bugReportsEnabled={bugReportsEnabled} />
		</Toast.Provider>
	)
}

function JoinedRoom({ bugReportsEnabled }: { bugReportsEnabled: boolean }) {
	const { hasDb, hasAiCredentials, dashboardDebugLogsBaseUrl } =
		useLoaderData<typeof loader>()
	const {
		userMedia,
		partyTracks,
		pushedTracks,
		showDebugInfo,
		pinnedTileIds,
		setPinnedTileIds,
		room,
		masquerade,
		e2eeSafetyNumber,
		e2eeOnJoin,
	} = useRoomContext()
	const {
		otherUsers,
		websocket,
		identity,
		roomState: { meetingId, users },
	} = room

	// Mounted here rather than beside the room: the log is meant to last one
	// meeting, and this is what unmounts when the meeting ends.
	const { messages, sendChatMessage } = useTextChat({ websocket, users })
	const [chatOpen, setChatOpen] = useState(false)
	const [readCount, setReadCount] = useState(0)
	useEffect(() => {
		if (chatOpen) setReadCount(messages.length)
	}, [chatOpen, messages.length])

	// only want this evaluated once upon mounting
	const [firstUser] = useState(otherUsers.length === 0)

	useEffect(() => {
		e2eeOnJoin(firstUser)
	}, [e2eeOnJoin, firstUser])

	useShowDebugInfoShortcut()

	const [raisedHand, setRaisedHand] = useState(false)
	const speaking = useIsSpeaking(userMedia.audioStreamTrack)

	useMount(() => {
		if (otherUsers.length > 5) {
			userMedia.turnMicOff()
		}
	})

	useBroadcastStatus({
		userMedia,
		partyTracks,
		websocket,
		identity,
		pushedTracks,
		raisedHand,
		speaking,
	})

	useSounds(otherUsers)
	useUserJoinLeaveToasts(otherUsers)

	// The stage is the room's seating chart, in the room's order, with everybody
	// on it. No sorting by who spoke last and no limit: a tile that moves is a
	// tile you have to find again, and in a game of who-is-who that is half the
	// information on the screen. Everyone sees the same thing, and it survives
	// the reveal, a dropped connection and a reload alike.
	const tiles = useMemo(
		() => stageTiles(masquerade.seats, users),
		[masquerade.seats, users]
	)

	const screenshares = useMemo(
		() =>
			users
				.filter((u) => u.joined && u.tracks.screenShareEnabled)
				.map(screenshareTile),
		[users]
	)

	// A screenshare is why everybody is looking at the screen, so it takes the
	// big half without being asked — once. Pinning it on every render would
	// undo anyone who put it back.
	const autoPinned = useRef(new Set<string>())
	useEffect(() => {
		const fresh = screenshares
			.map((s) => s.id)
			.filter((id) => !autoPinned.current.has(id))
		if (fresh.length === 0) return
		fresh.forEach((id) => autoPinned.current.add(id))
		setPinnedTileIds((ids) => [...ids, ...fresh])
	}, [screenshares, setPinnedTileIds])

	const pinnedTiles = [
		...screenshares.map((user) => ({ id: user.id, user })),
		...tiles.filter((t) => pinnedTileIds.includes(t.id)),
	]
	const unpinnedTiles = tiles.filter((t) => !pinnedTileIds.includes(t.id))

	const gridGap = 12
	const dispatchToast = useDispatchToast()

	useEffect(() => {
		if (e2eeSafetyNumber) {
			dispatchToast(
				<SafetyNumberToast safetyNumber={e2eeSafetyNumber.slice(0, 8)} />,
				{ duration: Infinity, id: 'e2ee-safety-number' }
			)
		}
	}, [e2eeSafetyNumber, dispatchToast])

	return (
		<PullAudioTracks
			audioTracks={otherUsers.map((u) => u.tracks.audio).filter(isNonNullable)}
		>
			<div className="flex flex-col h-full bg-white dark:bg-zinc-800">
				<div className="relative flex-grow bg-black isolate">
					<div
						style={{ '--gap': gridGap + 'px' } as any}
						className="absolute inset-0 flex isolate p-[--gap] gap-[--gap]"
					>
						{pinnedTiles.length > 0 && (
							<div className="flex-grow-[5] overflow-hidden relative">
								<ParticipantLayout
									tiles={pinnedTiles}
									gap={gridGap}
									aspectRatio="16:9"
								/>
							</div>
						)}
						{unpinnedTiles.length > 0 && (
							<div className="flex-grow overflow-hidden relative">
								<ParticipantLayout
									tiles={unpinnedTiles}
									gap={gridGap}
									aspectRatio="4:3"
								/>
							</div>
						)}
					</div>
					{masquerade.countdown !== undefined && (
						<RevealCountdown seconds={masquerade.countdown} />
					)}
					<div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap justify-center gap-2 p-2">
						{!masquerade.revealed && (
							<span className="rounded-full bg-zinc-900/70 px-3 py-1 text-xs text-white">
								{masquerade.character
									? `${masquerade.character.emoji} ${masquerade.character.name} として参加中 — 全員が変装しています`
									: '全員が変装しています'}
							</span>
						)}
						<RoleCard />
					</div>
					{chatOpen && (
						<TextChat
							messages={messages}
							users={users}
							selfId={identity?.id}
							// Only after the reveal: before it, the name in the log
							// already is the character.
							characterName={
								masquerade.revealed
									? (id) => masquerade.getCharacter(id)?.name
									: undefined
							}
							onSend={sendChatMessage}
							onClose={() => setChatOpen(false)}
						/>
					)}
					<Toast.Viewport className="absolute bottom-0 right-0" />
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2 p-2 text-sm md:gap-4 md:p-5 md:text-base">
					{hasAiCredentials && <AiButton />}
					<MicButton warnWhenSpeakingWhileMuted />
					{masquerade.revealed && <CameraButton />}
					<ScreenshareButton />
					<RevealButton />
					<RestartButton />
					<RaiseHandButton
						raisedHand={raisedHand}
						onClick={() => setRaisedHand(!raisedHand)}
					/>
					<ChatButton
						open={chatOpen}
						unread={messages.length - readCount}
						onClick={() => setChatOpen((open) => !open)}
					/>
					<ParticipantsButton
						identity={identity}
						otherUsers={otherUsers}
						className="hidden md:block"
					></ParticipantsButton>
					<OverflowMenu bugReportsEnabled={bugReportsEnabled} />
					<LeaveRoomButton
						navigateToFeedbackPage={hasDb}
						meetingId={meetingId}
					/>
					{showDebugInfo && meetingId && (
						<CopyButton contentValue={meetingId}>Meeting Id</CopyButton>
					)}
					{showDebugInfo && meetingId && dashboardDebugLogsBaseUrl && (
						<ButtonLink
							className="text-xs"
							displayType="secondary"
							to={dashboardLogsLink(dashboardDebugLogsBaseUrl, [
								{
									id: '2',
									key: 'meetingId',
									type: 'string',
									value: meetingId,
									operation: 'eq',
								},
							])}
							target="_blank"
							rel="noreferrer"
						>
							Meeting Logs
						</ButtonLink>
					)}
				</div>
			</div>
			<HighPacketLossWarningsToast />
			<IceDisconnectedToast />
		</PullAudioTracks>
	)
}
