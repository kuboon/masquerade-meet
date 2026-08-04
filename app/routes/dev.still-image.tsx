import type { MetaFunction } from '@remix-run/cloudflare'
import { useObservableAsValue } from 'partytracks/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '~/components/Button'
import { StillImagePicker } from '~/components/StillImagePicker'
import useUserMedia, {
	allowStillImage,
	camera,
	outgoingVideoTrack$,
	stillImageActive$,
} from '~/hooks/useUserMedia'
import { stillImage$ } from '~/utils/stillImage'

export const meta: MetaFunction = () => [
	{ title: '静止画送出の確認' },
	{ name: 'robots', content: 'noindex' },
]

/**
 * Watches what the still-image feature actually puts on the wire.
 *
 * The feature itself can only be seen end to end in a real meeting, which
 * needs Cloudflare Realtime credentials and so is out of reach of the test
 * suite — which is exactly how it shipped broken. This subscribes to the
 * same `outgoingVideoTrack$` the room pushes and plays it back, so the two
 * things that can go wrong are visible without a meeting: the wrong track
 * being chosen, and the right track producing no frames.
 */
export default function DevStillImage() {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [track, setTrack] = useState<MediaStreamTrack>()
	const [frames, setFrames] = useState(0)
	const [revealed, setRevealed] = useState(false)

	// Subscribed from the start, the way the room does: it pushes this
	// observable on mount, long before anybody registers a picture or the
	// masks come off. Getting that order wrong is the whole point of this
	// page — a picture registered mid-session has to reach the wire just as
	// reliably as one that was already in localStorage at load.
	useEffect(() => {
		const subscription = outgoingVideoTrack$.subscribe(setTrack)
		return () => subscription.unsubscribe()
	}, [])

	useEffect(() => {
		allowStillImage(revealed)
		return () => allowStillImage(false)
	}, [revealed])

	const active = useObservableAsValue(stillImageActive$, undefined)
	const broadcasting = useObservableAsValue(camera.isBroadcasting$, undefined)
	const cameraTrack = useObservableAsValue(camera.broadcastTrack$, undefined)
	const image = useObservableAsValue(stillImage$, undefined)
	// Read through the hook, not the observables behind it: the camera button
	// consumes these fields, and the bug that broke it was the hook handing
	// out the wrong one under the right name.
	const userMedia = useUserMedia({})

	// Frames are the whole question: a canvas that is drawn once and left
	// alone yields a track that exists but never delivers anything, which
	// looks identical to a working track from the sending side.
	useEffect(() => {
		const video = videoRef.current
		if (!track || !video) return
		video.srcObject = new MediaStream([track])
		video.play().catch(() => {})
		let cancelled = false
		const anyVideo = video as HTMLVideoElement & {
			requestVideoFrameCallback?: (cb: () => void) => number
		}
		const tick = () => {
			if (cancelled) return
			setFrames((n) => n + 1)
			anyVideo.requestVideoFrameCallback?.(tick)
		}
		anyVideo.requestVideoFrameCallback?.(tick)
		return () => {
			cancelled = true
		}
	}, [track])

	return (
		<div className="mx-auto max-w-2xl space-y-6 p-4">
			<div>
				<h1 className="text-2xl font-bold">静止画送出の確認</h1>
				<p className="pt-1 text-sm text-zinc-500 dark:text-zinc-400">
					アンマスク後にカメラの代わりに送られるトラックを、ミーティングを開かずに再生します。
				</p>
			</div>

			<StillImagePicker />

			<div className="flex flex-wrap gap-3">
				<Button onClick={() => setRevealed((r) => !r)}>
					{revealed ? '変装に戻す' : 'アンマスクする'}
				</Button>
				<Button
					displayType="secondary"
					onClick={() =>
						broadcasting
							? camera.stopBroadcasting()
							: camera.startBroadcasting()
					}
				>
					{broadcasting ? 'カメラを止める' : 'カメラを使う'}
				</Button>
			</div>

			<video
				ref={videoRef}
				muted
				playsInline
				className="w-full max-w-sm rounded-lg bg-zinc-200 dark:bg-zinc-700"
				data-testid="outgoing-video"
			/>

			<dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
				<dt className="text-zinc-500 dark:text-zinc-400">トラック</dt>
				<dd data-testid="track-kind">{track ? track.kind : 'なし'}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">ラベル</dt>
				<dd data-testid="track-label">{track?.label ?? '—'}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">状態</dt>
				<dd data-testid="track-state">{track?.readyState ?? '—'}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">受信フレーム</dt>
				<dd data-testid="frame-count">{frames}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">active</dt>
				<dd data-testid="dbg-active">{String(active)}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">カメラ稼働中</dt>
				<dd data-testid="dbg-broadcasting">{String(broadcasting)}</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">
					videoEnabled（カメラボタンが見る値）
				</dt>
				<dd data-testid="dbg-video-enabled">
					{String(userMedia.videoEnabled)}
				</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">映像を送出中</dt>
				<dd data-testid="dbg-outgoing">
					{String(userMedia.outgoingVideoEnabled)}
				</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">cameraTrack</dt>
				<dd data-testid="dbg-camera">
					{cameraTrack ? cameraTrack.label || 'track' : String(cameraTrack)}
				</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">image</dt>
				<dd data-testid="dbg-image">
					{image === undefined ? 'undefined' : image === null ? 'null' : 'set'}
				</dd>
				<dt className="text-zinc-500 dark:text-zinc-400">解像度</dt>
				<dd data-testid="track-size">
					{track
						? `${track.getSettings().width ?? '?'}x${track.getSettings().height ?? '?'}`
						: '—'}
				</dd>
			</dl>
		</div>
	)
}
