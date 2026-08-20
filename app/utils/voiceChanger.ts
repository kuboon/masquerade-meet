import { BehaviorSubject, Observable, type Subscription } from 'rxjs'
import type { StretchNode } from 'signalsmith-stretch'
import { neutralVoice, VOICE_RANGE, type VoiceParams } from './characters'

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

// Short enough to feel instant, long enough to avoid a click.
const RAMP_SECONDS = 0.03

/**
 * How long a window the pitch shifter analyses at once, and therefore how
 * far behind the disguised voice runs.
 *
 * 60 ms, chosen by measurement rather than taste — see
 * `e2e-tests/voice-changer.spec.ts`, which holds the shifter to a floor at
 * both ends of the size slider. Shorter windows cannot resolve a low voice:
 * at 30 ms a fifth down comes apart completely, and at 40 ms it is still
 * worse than what this replaced. Longer ones sound slightly better again at
 * the very bottom of the range and cost latency everybody pays for, in a
 * room where the whole point is talking over each other.
 */
export const STRETCH_BLOCK_MS = 60

/** The engine's own controls, worked out from the four a person sees. */
export interface EngineParams {
	/** how far the whole voice moves, formants and all */
	semitones: number
	ringModHz: number
	ringModDepth: number
	lowGain: number
	midGain: number
	highGain: number
}

/**
 * The four axes a person tunes, turned into the ones the engine takes.
 *
 * The whole point of the split: everything arbitrary lives here, in one
 * function with a test, rather than being spread across thirty character
 * files where nobody can see whether two of them mean the same thing.
 */
export function toEngineParams(params: VoiceParams): EngineParams {
	const rough = Math.max(0, Math.min(1, params.roughness))
	return {
		// Semitones all the way down now: the shifter speaks them, so the
		// exponential that used to live here does not have to exist twice.
		semitones: params.size * VOICE_RANGE.sizeSemitones,
		// Low enough to be heard as a rasp in the voice rather than as a tone
		// beside it, and rising a little so the top of the slider buzzes.
		ringModHz: rough > 0 ? 28 + rough * 45 : 0,
		ringModDepth: rough * VOICE_RANGE.roughnessDepth,
		// The two shelves move opposite ways, which is what makes this tilt
		// rather than volume.
		lowGain: -params.weight * VOICE_RANGE.weightDb,
		highGain: params.weight * VOICE_RANGE.weightDb,
		midGain: params.nasal * VOICE_RANGE.nasalDb,
	}
}

/**
 * Where the nasal peak sits, and how tight it is.
 *
 * Fixed rather than offered: sweeping the frequency is another axis nobody
 * asked for, and 1.8 kHz is where a nose doing too much of the work shows up.
 */
export const NASAL_FREQUENCY = 1800
const NASAL_Q = 1.4

/**
 * The whole disguise, as one thing to connect, retarget and throw away.
 *
 * A graph rather than three loose helpers because two of the pieces have a
 * lifetime now — the shifter has to be told to start, the ring modulator's
 * carrier has to be started and stopped — and three call sites getting that
 * subtly different is how a voice ends up silent in one of them.
 */
export interface VoiceGraph<C extends BaseAudioContext = BaseAudioContext> {
	/**
	 * Kept as the caller's own context type: the preview needs to resume and
	 * close a real `AudioContext`, and an offline render does not have those.
	 */
	context: C
	/** connect the dry signal here */
	input: AudioNode
	/** and take the disguised signal from here */
	output: AudioNode
	stretch: StretchNode
	carrier: OscillatorNode
	/** scales the carrier, and so how deep the modulation goes */
	depth: GainNode
	/** carries the modulation on its gain, which is the multiply */
	ring: GainNode
	low: BiquadFilterNode
	mid: BiquadFilterNode
	high: BiquadFilterNode
}

/**
 * The pitch shifter, served rather than bundled.
 *
 * `public/voice/` rather than an npm import so that it is a URL: the quality
 * test in `e2e-tests/voice-changer.spec.ts` renders audio through the very
 * file that ships, which it could not do with a bundler chunk. It also means
 * the 110 kB of WASM is fetched when somebody actually puts a mask on, and
 * cached at the edge from then on, instead of riding along in a JS chunk
 * everyone downloads.
 *
 * The copy is made by `npm run voice:vendor` and pinned by a test, so it
 * cannot drift from the version in package.json.
 */
export const STRETCH_URL = '/voice/SignalsmithStretch.mjs'

type CreateStretchNode = (
	context: BaseAudioContext,
	options?: AudioWorkletNodeOptions
) => Promise<StretchNode>

let stretchLoader: Promise<CreateStretchNode>

function loadStretch() {
	stretchLoader ??= import(/* @vite-ignore */ STRETCH_URL).then(
		(m) => m.default as CreateStretchNode
	)
	return stretchLoader
}

/**
 * Builds the chain: pitch shifter, ring modulator, three-band tone stack.
 *
 * ```
 * input → stretch → ring → low → mid → high → output
 *                    ↑
 *          carrier → depth
 * ```
 *
 * The ring modulator is a multiply, spelled the way Web Audio spells one: an
 * oscillator summed into a gain's own value, so the signal comes out as
 * `signal * (1 - depth + depth * carrier)`. The shifter has no rasp of its
 * own and this is the only part of the old worklet worth keeping.
 */
export async function createVoiceGraph<C extends BaseAudioContext>(
	context: C
): Promise<VoiceGraph<C>> {
	const SignalsmithStretch = await loadStretch()
	const stretch = await SignalsmithStretch(context, {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1],
	})
	await stretch.configure({
		blockMs: STRETCH_BLOCK_MS,
		// Do the work a slice at a time. The alternative is a burst once per
		// block, which is what makes a laptop that is coping in every other
		// respect start dropping audio.
		splitComputation: true,
	})

	const ring = context.createGain()
	const depth = context.createGain()
	depth.gain.value = 0
	const carrier = context.createOscillator()
	carrier.frequency.value = 0
	carrier.connect(depth).connect(ring.gain)
	carrier.start()

	const low = context.createBiquadFilter()
	low.type = 'lowshelf'
	low.frequency.value = 320
	low.gain.value = 0

	const mid = context.createBiquadFilter()
	mid.type = 'peaking'
	mid.frequency.value = NASAL_FREQUENCY
	mid.Q.value = NASAL_Q
	mid.gain.value = 0

	const high = context.createBiquadFilter()
	high.type = 'highshelf'
	high.frequency.value = 3200
	high.gain.value = 0

	stretch.connect(ring).connect(low).connect(mid).connect(high)

	const graph: VoiceGraph<C> = {
		context,
		input: stretch,
		output: high,
		stretch,
		carrier,
		depth,
		ring,
		low,
		mid,
		high,
	}
	// Awaited, unlike every later retarget: `schedule` crosses to the worklet
	// as a message, and until the first one lands the node is not processing
	// at all. Handing back a graph that has not been told to start is a graph
	// that renders silence — which is exactly what an offline render, with no
	// real time in it for the message to arrive, does every few runs.
	await applyVoiceParams(graph, voiceParams$.value)
	return graph
}

function ramp(param: AudioParam, value: number, now: number) {
	param.cancelScheduledValues(now)
	param.setTargetAtTime(value, now, RAMP_SECONDS)
}

/**
 * Retargets a live graph. The returned promise resolves once the shifter has
 * actually taken the change; callers that only care about the sound can
 * ignore it, because it eases in either way.
 */
export function applyVoiceParams(graph: VoiceGraph, params: VoiceParams) {
	const now = graph.context.currentTime
	const engine = toEngineParams(params)

	// The shifter eases into a scheduled change by itself, so this is the one
	// control that does not want a ramp of ours on top.
	const scheduled = graph.stretch.schedule({
		active: true,
		semitones: engine.semitones,
		// Formants travel with the pitch: one axis, one body, growing and
		// shrinking together. Holding them still is what the engine can now
		// do and the sliders cannot yet ask for.
		formantCompensation: false,
	})

	ramp(graph.carrier.frequency, engine.ringModHz, now)
	ramp(graph.depth.gain, engine.ringModDepth, now)
	// What is left of the signal when the carrier is at its lowest. The two
	// together are the multiply; moving only one would change the volume.
	ramp(graph.ring.gain, 1 - engine.ringModDepth, now)

	ramp(graph.low.gain, engine.lowGain, now)
	ramp(graph.mid.gain, engine.midGain, now)
	ramp(graph.high.gain, engine.highGain, now)

	return scheduled
}

export function disposeVoiceGraph(graph: VoiceGraph) {
	try {
		graph.carrier.stop()
	} catch {
		// Already stopped, which is not worth caring about on the way out.
	}
	for (const node of [
		graph.stretch,
		graph.carrier,
		graph.depth,
		graph.ring,
		graph.low,
		graph.mid,
		graph.high,
	]) {
		node.disconnect()
	}
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

		createVoiceGraph(context)
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
