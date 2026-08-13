import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { useNavigate, useParams, useSearchParams } from '@remix-run/react'
import { useObservableAsValue } from 'partytracks/react'
import { useEffect } from 'react'
import { useLocalStorage } from 'react-use'
import { AudioIndicator } from '~/components/AudioIndicator'
import { Button } from '~/components/Button'
import { CharacterAvatar } from '~/components/CharacterAvatar'
import { CharacterPicker } from '~/components/CharacterPicker'
import { CopyButton } from '~/components/CopyButton'
import { Disclaimer } from '~/components/Disclaimer'
import { Icon } from '~/components/Icon/Icon'
import { LobbyVoice } from '~/components/LobbyVoice'
import { MicButton } from '~/components/MicButton'
import { UnmaskedIdentity } from '~/components/UnmaskedIdentity'
import { VoicePreview } from '~/components/VoicePreview'

import { SettingsButton } from '~/components/SettingsDialog'
import { Spinner } from '~/components/Spinner'
import { Tooltip } from '~/components/Tooltip'
import { useRoomContext } from '~/hooks/useRoomContext'
import { useRoomUrl } from '~/hooks/useRoomUrl'
import getUsername from '~/utils/getUsername.server'
import { minimumParticipants, startCountdownMs } from '~/utils/masquerade'

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
	const { setJoined, userMedia, partyTracks, masquerade } = useRoomContext()
	const { audioStreamTrack, audioEnabled } = userMedia
	const session = useObservableAsValue(partyTracks.session$)
	const sessionError = useObservableAsValue(partyTracks.sessionError$)
	trackRefreshes()

	const roomUrl = useRoomUrl()
	const [params] = useSearchParams()

	const {
		character,
		characterSet,
		participants,
		canStart,
		isHost,
		meetingStarted,
		starting,
		startingIn,
		selectCharacter,
		setDisplayName,
		startMeeting,
		wornVoice,
		voiceCustomised,
		setMyVoice,
		clearMyVoice,
	} = masquerade

	// Remembered so a regular does not retype it every time. The room never
	// broadcasts it back — it is stripped from the public user list until the
	// reveal — so this is the only copy the UI has.
	const [storedName, setStoredName] = useLocalStorage(
		'masquerade:display-name',
		''
	)
	const displayName = storedName ?? ''

	// Pushed to the room after a pause rather than on every keystroke: each
	// one would otherwise fan a room state broadcast out to everybody.
	useEffect(() => {
		const timeout = setTimeout(() => setDisplayName(displayName.trim()), 300)
		return () => clearTimeout(timeout)
	}, [displayName, setDisplayName])

	// Everyone waits here until the meeting begins, then walks in together —
	// that simultaneous arrival is what makes the disguises work. A name is
	// the whole of the entry requirement: a character and a voice can be
	// settled for somebody who has not got round to them, but the name they
	// will be unmasked as cannot. Somebody who types one late walks in then.
	const named = displayName.trim() !== ''
	useEffect(() => {
		if (!meetingStarted || !named) return
		setJoined(true)
		navigate('room' + (params.size > 0 ? '?' + params.toString() : ''))
	}, [meetingStarted, named, setJoined, navigate, params])

	const missingParticipants = minimumParticipants - participants.length
	const overCapacity = participants.length - characterSet.characters.length
	const startHint =
		overCapacity > 0
			? `キャラクターが足りません。1ルームの定員は${characterSet.characters.length}人です（${overCapacity}人超過）`
			: missingParticipants > 0
				? `ミーティング開始にはあと${missingParticipants}人の参加が必要です`
				: `押すと${startCountdownMs / 1000}秒後に始まります`

	return (
		<div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-4 p-4">
			<div className="w-full space-y-4">
				{starting && (
					<div className="rounded-md bg-orange-100 p-3 text-sm text-zinc-900 dark:bg-orange-900 dark:text-zinc-100">
						<p className="font-bold">
							まもなく始まります
							{startingIn !== undefined && `（${startingIn}秒）`}
						</p>
						<p className="pt-1">
							まだ選んでいないキャラクターは自動で決まります。
							{!named && '名前を入れないと参加できません。'}
						</p>
					</div>
				)}

				<div>
					<h1 className="text-3xl font-bold">{roomName}</h1>
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						{participants.length}人が待機中
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
							希望するキャラクター
						</p>
						<p className="truncate text-2xl font-bold">
							{character ? `${character.emoji} ${character.name}` : '選択中…'}
						</p>
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							{character?.tagline}
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<h2 className="text-sm font-semibold">キャラクターを選ぶ</h2>
					<CharacterPicker
						characters={characterSet.characters}
						selectedId={character?.id}
						disabled={starting}
						onSelect={selectCharacter}
					/>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						誰が誰を選んでいるかは分かりません。希望が重なった場合は、ミーティング開始時に抽選で決まり、外れた人には空いているキャラクターが割り当てられます。
					</p>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						ミーティング中は声がこのキャラクターの声色に変わり、カメラ映像の代わりにキャラクターが表示されます。
						本名はルーム管理者が解除するまで誰にも見えません。
					</p>
				</div>

				<div className="space-y-2">
					<h2 className="text-sm font-semibold">声を確かめる（任意）</h2>
					<VoicePreview
						voice={wornVoice}
						onVoiceChange={setMyVoice}
						onReset={clearMyVoice}
						customised={voiceCustomised}
					/>
				</div>

				<UnmaskedIdentity name={displayName} onNameChange={setStoredName} />

				{meetingStarted && !character && (
					// The room hands out a character on arrival and only comes up
					// empty when every one of them is spoken for. In the lobby that
					// is nothing to worry about — the meeting simply cannot start
					// over capacity — but with a meeting already running there is
					// no face left to walk in behind.
					<div className="rounded-md bg-zinc-200 p-3 text-sm text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
						<p>
							ミーティングが進行中で、空いているキャラクターがありません。
							誰かが退出すると参加できます。
						</p>
					</div>
				)}

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

				<LobbyVoice />

				<div className="flex flex-wrap items-center gap-4 text-sm">
					{isHost && !meetingStarted && (
						<Tooltip content={startHint}>
							<span>
								<Button
									onClick={startMeeting}
									disabled={!canStart || starting || !session?.sessionId}
								>
									ミーティング開始
								</Button>
							</span>
						</Tooltip>
					)}
					<MicButton />
					<SettingsButton />
					<Tooltip content="URLをコピー">
						{/* The tooltip is not a name — it lives in a portal and only
						    appears on hover — so the button says so itself. */}
						<CopyButton
							contentValue={roomUrl}
							copiedMessage={<VisuallyHidden>コピーしました</VisuallyHidden>}
						>
							<VisuallyHidden>URLをコピー</VisuallyHidden>
						</CopyButton>
					</Tooltip>
				</div>

				{!meetingStarted && !starting && (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						{!isHost
							? 'ルーム管理者がミーティングを開始するのを待っています…'
							: missingParticipants > 0
								? `ミーティング開始には${minimumParticipants}人以上必要です。URLを共有して招待してください。`
								: `「ミーティング開始」を押すと${startCountdownMs / 1000}秒後に始まります。まだ選び終わっていない人の分は自動で決まります。`}
					</p>
				)}

				<ul className="flex flex-wrap gap-2">
					{participants.map((user) => (
						<li
							key={user.id}
							className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
						>
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
