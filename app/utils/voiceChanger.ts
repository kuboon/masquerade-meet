import {
	applyVoiceParams,
	createVoiceGraph,
	disposeVoiceGraph,
	type VoiceGraph,
} from '@kuboon/masquerade-character-set/graph'
import { BehaviorSubject, Observable, type Subscription } from 'rxjs'
import { neutralVoice, type VoiceParams } from './characters'

/**
 * The disguise itself lives in `@kuboon/masquerade-character-set`, alongside
 * the rules a published set is checked against. It has to: what `size: -0.95`
 * sounds like is part of what this app promises anybody writing a character
 * on their own site, and a second copy of the graph here would be a second
 * answer. What is left in this file is the part that is only ours — the live
 * microphone, and the one voice it is currently wearing.
 */

/**
 * The copy of the pitch shifter this app serves.
 *
 * `public/voice/` rather than an npm import so that it is a URL: the quality
 * test in `e2e-tests/voice-changer.spec.ts` renders audio through the very
 * file that ships, which it could not do with a bundler chunk. It also means
 * the 110 kB of WASM is fetched when somebody actually puts a mask on, and
 * cached at the edge from then on, instead of riding along in a JS chunk
 * everyone downloads.
 *
 * The copy is made by `npm run voice:vendor` and pinned by a test, so it
 * cannot drift from the version in package.json. Same-origin, so a page of
 * ours never depends on the CORS headers that let other people's pages use
 * it too.
 */
export const STRETCH_URL = '/voice/SignalsmithStretch.mjs'

export {
	applyVoiceParams,
	createVoiceGraph,
	disposeVoiceGraph,
	NASAL_FREQUENCY,
	STRETCH_BLOCK_MS,
	type VoiceGraph,
} from '@kuboon/masquerade-character-set/graph'
export {
	toEngineParams,
	type EngineParams,
} from '@kuboon/masquerade-character-set/voice'

/** Builds the app's own graph: the served shifter, and the current voice. */
export function createAppVoiceGraph<C extends BaseAudioContext>(context: C) {
	return createVoiceGraph(context, {
		voice: voiceParams$.value,
		stretchUrl: STRETCH_URL,
	})
}

/**
 * The voice disguise currently applied to the local mic.
 *
 * This is module state on purpose. `partytracks` identifies a transform by
 * function reference, so the transform itself has to be a single stable
 * function; it reads its settings from here instead of being re-created.
 * Pushing a new value re-targets the live graph, which means switching
 * characters — or dropping the mask entirely — happens on the running audio
 * graph with no track renegotiation and no audible gap.
 */
export const voiceParams$ = new BehaviorSubject<VoiceParams>(neutralVoice)

export function setVoiceParams(params: VoiceParams) {
	voiceParams$.next(params)
}

/**
 * A `partytracks` audio transform that runs the mic through the voice
 * changer. Only ever pass the module-level reference below to
 * `mic.addTransform` / `mic.removeTransform`.
 */
function voiceChangerTransform(
	originalTrack: MediaStreamTrack
): Observable<MediaStreamTrack> {
	return new Observable<MediaStreamTrack>((subscriber) => {
		const context = new AudioContext()
		const source = context.createMediaStreamSource(
			new MediaStream([originalTrack])
		)
		const destination = context.createMediaStreamDestination()

		let graph: VoiceGraph | undefined
		let paramsSubscription: Subscription | undefined
		let torndown = false

		// Some browsers hand back a suspended context when it wasn't created
		// during a user gesture.
		context.resume().catch(() => {})

		createAppVoiceGraph(context)
			.then((built) => {
				if (torndown || context.state === 'closed') {
					disposeVoiceGraph(built)
					return
				}
				graph = built
				source.connect(graph.input)
				graph.output.connect(destination)
				paramsSubscription = voiceParams$.subscribe((params) =>
					applyVoiceParams(graph!, params)
				)
			})
			.catch((error) => {
				console.error('Failed to build the voice changer', error)
				if (torndown || context.state === 'closed') return
				// Better to be heard undisguised than not at all, but make it
				// obvious in the console that the disguise is not in effect.
				source.connect(destination)
			})

		const outputTrack = destination.stream.getAudioTracks()[0]

		// If the mic disappears (device unplugged), take the disguised track
		// down with it so partytracks can react.
		const onEnded = (event: Event) => {
			outputTrack.stop()
			outputTrack.dispatchEvent(new Event(event.type))
		}
		originalTrack.addEventListener('ended', onEnded)

		subscriber.next(outputTrack)

		subscriber.add(() => {
			torndown = true
			originalTrack.removeEventListener('ended', onEnded)
			paramsSubscription?.unsubscribe()
			if (graph) disposeVoiceGraph(graph)
			source.disconnect()
			context.close().catch(() => {})
		})
	})
}

export default voiceChangerTransform
