import { Observable } from 'rxjs'

/**
 * Turns a stored picture into an outgoing video track.
 *
 * This is how a still image reaches other people without ever being
 * uploaded: it is drawn on a canvas here, captured as an ordinary video
 * track, and forwarded by the SFU exactly like a camera feed. Nothing
 * stores it — not the Durable Object, not D1, not the SFU.
 *
 * The image never changes, so the encoder settles at almost no bitrate
 * after the first frame.
 */

/** Long edge of the canvas. Matches the camera's 720p and keeps it cheap. */
const MAX_EDGE = 720
/**
 * A canvas that is drawn once and left alone stops producing frames, and
 * the track goes silent. Redrawing on a timer keeps it alive; a still
 * picture costs the encoder nothing to repeat.
 */
const REDRAW_MS = 1000

/** Odd dimensions upset some encoders. */
const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)

export function stillImageVideoTrack(
	dataUrl: string
): Observable<MediaStreamTrack> {
	return new Observable<MediaStreamTrack>((subscriber) => {
		let interval = -1
		let track: MediaStreamTrack | undefined
		let torndown = false

		const image = new Image()
		image.onload = () => {
			if (torndown) return
			const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
			const canvas = document.createElement('canvas')
			canvas.width = even(image.width * scale)
			canvas.height = even(image.height * scale)

			const context = canvas.getContext('2d')
			if (!context) {
				subscriber.error(new Error('2d canvas is unavailable'))
				return
			}

			const draw = () => {
				context.drawImage(image, 0, 0, canvas.width, canvas.height)
			}
			draw()
			interval = window.setInterval(draw, REDRAW_MS)

			track = canvas.captureStream().getVideoTracks()[0]
			subscriber.next(track)
		}
		image.onerror = () =>
			subscriber.error(new Error('the stored image could not be decoded'))
		image.src = dataUrl

		subscriber.add(() => {
			torndown = true
			clearInterval(interval)
			track?.stop()
		})
	})
}
