import type { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import {
	useLoaderData,
	useNavigate,
	useParams,
	useSearchParams,
} from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { useMount, useWindowSize } from 'react-use'
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
import { SafetyNumberToast } from '~/components/SafetyNumberToast'
import { ScreenshareButton } from '~/components/ScreenshareButton'
import { ChatButton, TextChat } from '~/components/TextChat'
import Toast, { useDispatchToast } from '~/components/Toast'
import useBroadcastStatus from '~/hooks/useBroadcastStatus'
import useIsSpeaking from '~/hooks/useIsSpeaking'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useShowDebugInfoShortcut } from '~/hooks/useShowDebugInfoShortcut'
import useSounds from '~/hooks/useSounds'
import useStageManager from '~/hooks/useStageManager'
import useTextChat from '~/hooks/useTextChat'
import { useUserJoinLeaveToasts } from '~/hooks/useUserJoinLeaveToasts'
import { dashboardLogsLink } from '~/utils/dashboardLogsLink'
import getUsername from '~/utils/getUsername.server'
import isNonNullable from '~/utils/isNonNullable'

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

	const { width } = useWindowSize()

	const someScreenshare =
		otherUsers.some((u) => u.tracks.screenShareEnabled) ||
		Boolean(identity?.tracks.screenShareEnabled)
	const stageLimit = width < 600 ? 2 : someScreenshare ? 5 : 9

	const { recordActivity, actorsOnStage } = useStageManager(
		otherUsers,
		stageLimit,
		identity
	)

	useEffect(() => {
		otherUsers.forEach((u) => {
			if (u.speaking || u.raisedHand) recordActivity(u)
		})
	}, [otherUsers, recordActivity])

	const pinnedActors = actorsOnStage.filter((u) => pinnedTileIds.includes(u.id))
	const unpinnedActors = actorsOnStage.filter(
		(u) => !pinnedTileIds.includes(u.id)
	)

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
						{pinnedActors.length > 0 && (
							<div className="flex-grow-[5] overflow-hidden relative">
								<ParticipantLayout
									users={pinnedActors.filter(isNonNullable)}
									gap={gridGap}
									aspectRatio="16:9"
								/>
							</div>
						)}
						<div className="flex-grow overflow-hidden relative">
							<ParticipantLayout
								users={unpinnedActors.filter(isNonNullable)}
								gap={gridGap}
								aspectRatio="4:3"
							/>
						</div>
					</div>
					{masquerade.countdown !== undefined && (
						<RevealCountdown seconds={masquerade.countdown} />
					)}
					{!masquerade.revealed && (
						<div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-2">
							<span className="rounded-full bg-zinc-900/70 px-3 py-1 text-xs text-white">
								{masquerade.character
									? `${masquerade.character.emoji} ${masquerade.character.name} として参加中 — 全員が変装しています`
									: '全員が変装しています'}
							</span>
						</div>
					)}
					{chatOpen && (
						<TextChat
							messages={messages}
							users={users}
							selfId={identity?.id}
							onSend={sendChatMessage}
							onClose={() => setChatOpen(false)}
						/>
					)}
					<Toast.Viewport className="absolute bottom-0 right-0" />
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2 p-2 text-sm md:gap-4 md:p-5 md:text-base">
					{hasAiCredentials && <AiButton recordActivity={recordActivity} />}
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
