import { BehaviorSubject, Observable, type Subscription } from 'rxjs'
import { neutralVoice, VOICE_RANGE, type VoiceParams } from './characters'

/**
 * The voice disguise currently applied to the local mic.
 *
 * This is module state on purpose. `partytracks` identifies a transform by
 * function reference, so the transform itself has to be a single stable
 * function; it reads its settings from here instead of being re-created.
 * Pushing a new value re-targets the live AudioParams, which means switching
 * characters — or dropping the mask entirely — happens on the running audio
 * graph with no track renegotiation and no audible gap.
 */
export const voiceParams$ = new BehaviorSubject<VoiceParams>(neutralVoice)

export function setVoiceParams(params: VoiceParams) {
	voiceParams$.next(params)
}

export const VOICE_WORKLET_URL = '/voice/voice-changer-worklet.js'
// Short enough to feel instant, long enough to avoid a click.
const RAMP_SECONDS = 0.03

/** The engine's own controls, worked out from the four a person sees. */
export interface EngineParams {
	pitchRatio: number
	ringModHz: number
	ringModDepth: number
	lowGain: number
	midGain: number
	highGain: number
}

/**
 * The four axes a person tunes, turned into the ten the engine takes.
 *
 * The whole point of the split: everything arbitrary lives here, in one
 * function with a test, rather than being spread across thirty character
 * files where nobody can see whether two of them mean the same thing.
 */
export function toEngineParams(params: VoiceParams): EngineParams {
	const rough = Math.max(0, Math.min(1, params.roughness))
	return {
		// Semitones, because pitch is geometric — the same slider distance has
		// to be the same musical distance at both ends of the range.
		pitchRatio: 2 ** ((params.size * VOICE_RANGE.sizeSemitones) / 12),
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

export interface ToneNodes {
	low: BiquadFilterNode
	mid: BiquadFilterNode
	high: BiquadFilterNode
}

/**
 * The post pitch-shift tone stack: a fixed lowshelf, a sweepable peak, and a
 * fixed highshelf. Exported so the tuner can build the same chain — if the
 * two ever drift, what a developer dials in stops being what anyone hears.
 */
export function createToneNodes(context: BaseAudioContext): ToneNodes {
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

	return { low, mid, high }
}

export async function createVoiceChangerNode(context: BaseAudioContext) {
	await context.audioWorklet.addModule(VOICE_WORKLET_URL)
	return new AudioWorkletNode(context, 'voice-changer', {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1],
	})
}

function ramp(param: AudioParam, value: number, now: number) {
	param.cancelScheduledValues(now)
	param.setTargetAtTime(value, now, RAMP_SECONDS)
}

export function applyVoiceParams(
	context: BaseAudioContext,
	node: AudioWorkletNode,
	toneNodes: ToneNodes,
	params: VoiceParams
) {
	const now = context.currentTime
	const get = (name: string) => node.parameters.get(name)
	const engine = toEngineParams(params)

	ramp(get('pitchRatio')!, engine.pitchRatio, now)
	ramp(get('ringModHz')!, engine.ringModHz, now)
	ramp(get('ringModDepth')!, engine.ringModDepth, now)
	// The worklet's vibrato is left where it defaults, at zero. It is a
	// singing quality rather than a speaking one, and it earned none of the
	// four places on offer.

	ramp(toneNodes.low.gain, engine.lowGain, now)
	ramp(toneNodes.mid.gain, engine.midGain, now)
	ramp(toneNodes.high.gain, engine.highGain, now)
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

		const { low, mid, high } = createToneNodes(context)

		let workletNode: AudioWorkletNode | undefined
		let paramsSubscription: Subscription | undefined
		let torndown = false

		// Some browsers hand back a suspended context when it wasn't created
		// during a user gesture.
		context.resume().catch(() => {})

		createVoiceChangerNode(context)
			.then((node) => {
				if (torndown || context.state === 'closed') return
				workletNode = node
				source
					.connect(workletNode)
					.connect(low)
					.connect(mid)
					.connect(high)
					.connect(destination)
				paramsSubscription = voiceParams$.subscribe((params) =>
					applyVoiceParams(context, workletNode!, { low, mid, high }, params)
				)
			})
			.catch((error) => {
				console.error('Failed to load the voice changer worklet', error)
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
			workletNode?.disconnect()
			low.disconnect()
			mid.disconnect()
			high.disconnect()
			source.disconnect()
			context.close().catch(() => {})
		})
	})
}

export default voiceChangerTransform
