import useBroadcastStatus from '~/hooks/useBroadcastStatus'
import { useRoomContext } from '~/hooks/useRoomContext'
import { AudioIndicator } from './AudioIndicator'
import { PullAudioTracks, usePulledAudioTrack } from './PullAudioTracks'

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
 * Says where to find the host's audio, and warns them it is going out.
 *
 * `joined` is false: they are announcing a microphone, not taking a seat.
 */
function HostVoice() {
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

	return (
		<p className="text-xs text-zinc-500 dark:text-zinc-400">
			{userMedia.audioEnabled
				? '待っている人には、あなたの声がそのまま聞こえています。ミーティングが始まるとキャラクターの声に変わります。'
				: 'マイクをオンにすると、待っている人に声を届けられます。ロビーでは変換されず、地声のまま届きます。'}
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
