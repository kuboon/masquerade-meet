import useBroadcastStatus from '~/hooks/useBroadcastStatus'
import { useRoomContext } from '~/hooks/useRoomContext'
import { AudioIndicator } from './AudioIndicator'
import { Label } from './Label'
import { PullAudioTracks, usePulledAudioTrack } from './PullAudioTracks'
import { Toggle } from './Toggle'

/**
 * The one voice the lobby carries: the host's, and undisguised.
 *
 * Somebody has to be able to say "we start in a minute, put your name in",
 * and typing it to a room that has no chat yet does not work. So the host is
 * heard, as themselves.
 *
 * The cost is the host's own reveal. Anybody who knows their voice knows who
 * is running the room from the lobby onwards, and this is the one place in
 * the app where an unprocessed microphone reaches the server at all. That is
 * a deliberate trade and it is the host's alone: everyone else's microphone
 * reaches nobody until the meeting starts, disguise and all.
 */
export function LobbyVoice() {
	const { masquerade } = useRoomContext()
	// Only while the room is actually waiting. Anybody who never gave a name is
	// left behind in the lobby when the meeting starts, and neither half of
	// this may reach into a meeting they are not in — a lobby that kept
	// pulling the host's track would be an open line to the room.
	if (masquerade.phase !== 'lobby') return null
	return masquerade.isHost ? <HostVoice /> : <ListeningToTheHost />
}

/**
 * The switch that opens the host's microphone, and the reason to think first.
 *
 * Off until they turn it on. Everything about this costs the host their own
 * reveal and sends an unprocessed microphone to the server, so it is not
 * something to discover after the fact — and it is why the switch controls
 * both halves at once. While it is off nothing is announced, so nobody could
 * pull the audio even knowing where to look.
 */
function HostVoice() {
	const { speakingInLobby, setSpeakingInLobby } = useRoomContext()

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<Toggle
					id="speak-in-lobby"
					checked={speakingInLobby}
					onCheckedChange={(checked) => setSpeakingInLobby(checked === true)}
				/>
				<Label htmlFor="speak-in-lobby" className="text-sm">
					待っている人に声をかける
				</Label>
			</div>
			<p className="text-xs text-zinc-500 dark:text-zinc-400">
				{speakingInLobby
					? 'あなたの声がそのまま全員に聞こえています。声で正体が分かってしまうことに注意してください。ミーティングが始まるとキャラクターの声に変わります。'
					: 'オンにすると、変換なしの地声で全員に話せます。段取りを伝えるためのもので、そのぶん自分の正体は先に明かすことになります。'}
			</p>
			{speakingInLobby && <HostMicrophone />}
		</div>
	)
}

/**
 * Says where to find the host's audio.
 *
 * `joined` is false: they are announcing a microphone, not taking a seat.
 * Unmounting takes the announcement back, which is what turning the switch
 * off has to do.
 */
function HostMicrophone() {
	const { userMedia, partyTracks, pushedTracks, room } = useRoomContext()
	useBroadcastStatus({
		userMedia,
		partyTracks,
		websocket: room.websocket,
		identity: room.identity,
		pushedTracks,
		raisedHand: false,
		speaking: false,
		joined: false,
	})

	if (userMedia.audioEnabled) return null
	return (
		<p className="text-xs text-orange-700 dark:text-orange-400">
			マイクがオフです。オンにしないと声は届きません。
		</p>
	)
}

/** Everyone else: listening, with nothing of their own going out. */
function ListeningToTheHost() {
	const { masquerade } = useRoomContext()
	const host = masquerade.participants.find((u) => u.id === masquerade.hostId)
	// Only while they are actually broadcasting: muting takes the track off
	// the SFU, and asking for one that is gone gets nothing back.
	const track = host?.tracks.audioEnabled ? host.tracks.audio : undefined

	return (
		<PullAudioTracks audioTracks={track ? [track] : []}>
			<HostSpeaking track={track} />
		</PullAudioTracks>
	)
}

function HostSpeaking({ track }: { track?: string }) {
	const audioTrack = usePulledAudioTrack(track)
	if (!audioTrack) return null

	return (
		<p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
			<AudioIndicator audioTrack={audioTrack} />
			ルーム管理者が話しています
		</p>
	)
}
