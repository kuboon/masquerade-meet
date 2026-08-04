import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { useNavigate, useParams, useSearchParams } from '@remix-run/react'
import { useObservableAsValue } from 'partytracks/react'
import { useEffect } from 'react'
import { AudioIndicator } from '~/components/AudioIndicator'
import { Button } from '~/components/Button'
import { CharacterAvatar } from '~/components/CharacterAvatar'
import { CharacterPicker } from '~/components/CharacterPicker'
import { CopyButton } from '~/components/CopyButton'
import { Disclaimer } from '~/components/Disclaimer'
import { Icon } from '~/components/Icon/Icon'
import { MicButton } from '~/components/MicButton'

import { SettingsButton } from '~/components/SettingsDialog'
import { Spinner } from '~/components/Spinner'
import { Tooltip } from '~/components/Tooltip'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useRoomUrl } from '~/hooks/useRoomUrl'
import getUsername from '~/utils/getUsername.server'
import { minimumParticipants } from '~/utils/masquerade'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	// May be null: the layout above shows the name form in that case and this
	// route never renders.
	const username = await getUsername(request)
	return json({ username, callsAppId: context.env.CALLS_APP_ID })
}

let refreshCheckDone = false
function trackRefreshes() {
	if (refreshCheckDone) return
	if (typeof document === 'undefined') return

	const key = `previously loaded`
	const initialValue = sessionStorage.getItem(key)
	const refreshed = initialValue !== null
	sessionStorage.setItem(key, Date.now().toString())

	if (refreshed) {
		fetch(`/api/reportRefresh`, {
			method: 'POST',
		})
	}

	refreshCheckDone = true
}

export default function Lobby() {
	const { roomName } = useParams()
	const navigate = useNavigate()
	const { setJoined, userMedia, room, partyTracks, masquerade } =
		useRoomContext()
	const { audioStreamTrack, audioEnabled } = userMedia
	const session = useObservableAsValue(partyTracks.session$)
	const sessionError = useObservableAsValue(partyTracks.sessionError$)
	const { identity, characterTaken, clearCharacterTaken } = room
	trackRefreshes()

	const roomUrl = useRoomUrl()
	const [params] = useSearchParams()

	const {
		character,
		characterSet,
		participants,
		takenCharacterIds,
		everyoneReady,
		canStart,
		readyCount,
		isHost,
		meetingStarted,
		selectCharacter,
		setReady,
		startMeeting,
	} = masquerade

	const ready = identity?.ready ?? false

	// Everyone waits here until the host starts the meeting, then walks in
	// together — that simultaneous arrival is what makes the disguises work.
	useEffect(() => {
		if (!meetingStarted || !ready) return
		setJoined(true)
		navigate('room' + (params.size > 0 ? '?' + params.toString() : ''))
	}, [meetingStarted, ready, setJoined, navigate, params])

	useEffect(() => {
		if (!characterTaken) return
		const timeout = setTimeout(clearCharacterTaken, 2500)
		return () => clearTimeout(timeout)
	}, [characterTaken, clearCharacterTaken])

	const waitingOn = participants.filter((u) => !u.ready).length
	const missingParticipants = minimumParticipants - participants.length
	// Being short of people and being short of ready people are different
	// problems, and telling the host "0人の準備待ち" when they are simply alone
	// would send them looking for a bug that isn't there.
	const startHint =
		missingParticipants > 0
			? `ミーティング開始にはあと${missingParticipants}人の参加が必要です`
			: everyoneReady
				? '全員そろいました'
				: `あと${waitingOn}人の準備を待っています`

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4 p-4">
			<div className="w-full space-y-4">
				<div>
					<h1 className="text-3xl font-bold">{roomName}</h1>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						{participants.length}人が待機中 ／ 準備完了 {readyCount}人
					</p>
				</div>

				<div className="flex items-center gap-4 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
					<div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
						{character ? (
							<CharacterAvatar character={character} />
						) : (
							<div className="grid h-full w-full place-items-center bg-zinc-300 text-3xl dark:bg-zinc-700">
								?
							</div>
						)}
						<div className="absolute left-2 top-2">
							{!sessionError && !session?.sessionId ? (
								<Spinner className="text-zinc-100" />
							) : (
								audioStreamTrack &&
								(audioEnabled ? (
									<AudioIndicator audioTrack={audioStreamTrack} />
								) : (
									<Tooltip content="マイクがオフです">
										<div className="indication-shadow text-white">
											<Icon type="micOff" />
											<VisuallyHidden>マイクがオフです</VisuallyHidden>
										</div>
									</Tooltip>
								))
							)}
						</div>
					</div>
					<div className="min-w-0">
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							あなたはこのキャラクターとして参加します
						</p>
						<p className="truncate text-2xl font-bold">
							{character ? `${character.emoji} ${character.name}` : '選択中…'}
						</p>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							{character
								? character.tagline
								: `空いているキャラクターがありません。1ルームの定員は${characterSet.characters.length}人です。`}
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-baseline justify-between">
						<h2 className="text-sm font-semibold">キャラクターを選ぶ</h2>
						{characterTaken && (
							<span className="text-xs text-red-500">
								そのキャラクターは先に取られました
							</span>
						)}
					</div>
					<CharacterPicker
						characters={characterSet.characters}
						selectedId={character?.id}
						takenIds={takenCharacterIds}
						disabled={ready}
						onSelect={selectCharacter}
					/>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						ミーティング中は声がこのキャラクターの声色に変わり、カメラ映像の代わりにキャラクターが表示されます。
						本名はルーム管理者が解除するまで誰にも見えません。
					</p>
				</div>

				{sessionError && (
					<div className="rounded-md bg-red-200 p-3 text-sm text-zinc-800 dark:bg-red-700 dark:text-zinc-200">
						{sessionError}
					</div>
				)}
				{userMedia.audioUnavailableReason && (
					<div className="rounded-md bg-zinc-200 p-3 text-sm text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
						{userMedia.audioUnavailableReason === 'NotAllowedError' && (
							<p>
								マイクの使用が拒否されました。許可して再読み込みしてください。
							</p>
						)}
						{userMedia.audioUnavailableReason === 'DevicesExhaustedError' && (
							<p>使用できるマイクが見つかりませんでした。</p>
						)}
						{userMedia.audioUnavailableReason === 'UnknownError' && (
							<p>マイクで不明なエラーが発生しました。</p>
						)}
					</div>
				)}

				<div className="flex flex-wrap items-center gap-4 text-sm">
					<Button
						onClick={() => setReady(!ready)}
						disabled={!session?.sessionId || !character}
						displayType={ready ? 'secondary' : 'primary'}
					>
						{ready ? '準備完了を取り消す' : '準備完了'}
					</Button>
					{isHost && !meetingStarted && (
						<Tooltip content={startHint}>
							<span>
								<Button onClick={startMeeting} disabled={!canStart}>
									ミーティング開始
								</Button>
							</span>
						</Tooltip>
					)}
					<MicButton />
					<SettingsButton />
					<Tooltip content="URLをコピー">
						<CopyButton contentValue={roomUrl}></CopyButton>
					</Tooltip>
				</div>

				{ready && !meetingStarted && (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						{!isHost
							? 'ルーム管理者がミーティングを開始するのを待っています…'
							: missingParticipants > 0
								? `ミーティング開始には${minimumParticipants}人以上必要です。URLを共有して招待してください。`
								: '全員の準備が終わったら「ミーティング開始」を押してください。'}
					</p>
				)}

				<ul className="flex flex-wrap gap-2">
					{participants.map((user) => (
						<li
							key={user.id}
							className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
						>
							<span
								className={
									user.ready
										? 'text-green-600 dark:text-green-400'
										: 'opacity-40'
								}
							>
								●
							</span>
							{user.name}
							{user.id === masquerade.hostId && (
								<span className="text-xs text-zinc-500 dark:text-zinc-400">
									(管理者)
								</span>
							)}
						</li>
					))}
				</ul>
			</div>
			<Disclaimer className="pt-2" />
		</div>
	)
}
