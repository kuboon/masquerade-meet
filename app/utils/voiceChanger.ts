import { BehaviorSubject, Observable, type Subscription } from 'rxjs'
import { neutralVoice, type VoiceParams } from './characters'

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

const WORKLET_URL = '/voice/voice-changer-worklet.js'
// Short enough to feel instant, long enough to avoid a click.
const RAMP_SECONDS = 0.03

interface ToneNodes {
	low: BiquadFilterNode
	mid: BiquadFilterNode
	high: BiquadFilterNode
}

function ramp(param: AudioParam, value: number, now: number) {
	param.cancelScheduledValues(now)
	param.setTargetAtTime(value, now, RAMP_SECONDS)
}

function applyParams(
	context: BaseAudioContext,
	node: AudioWorkletNode,
	toneNodes: ToneNodes,
	params: VoiceParams
) {
	const now = context.currentTime
	const get = (name: string) => node.parameters.get(name)

	ramp(get('pitchRatio')!, params.pitchRatio, now)
	ramp(get('vibratoRate')!, params.vibratoRate, now)
	ramp(get('vibratoDepth')!, params.vibratoDepth, now)
	ramp(get('ringModHz')!, params.ringModHz, now)
	ramp(get('ringModDepth')!, params.ringModDepth, now)

	ramp(toneNodes.low.gain, params.tone.low, now)
	ramp(toneNodes.mid.frequency, params.tone.midFreq, now)
	ramp(toneNodes.mid.gain, params.tone.midGain, now)
	ramp(toneNodes.mid.Q, params.tone.midQ, now)
	ramp(toneNodes.high.gain, params.tone.high, now)
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

		const low = context.createBiquadFilter()
		low.type = 'lowshelf'
		low.frequency.value = 320
		low.gain.value = 0

		const mid = context.createBiquadFilter()
		mid.type = 'peaking'
		mid.frequency.value = neutralVoice.tone.midFreq
		mid.Q.value = neutralVoice.tone.midQ
		mid.gain.value = 0

		const high = context.createBiquadFilter()
		high.type = 'highshelf'
		high.frequency.value = 3200
		high.gain.value = 0

		let workletNode: AudioWorkletNode | undefined
		let paramsSubscription: Subscription | undefined
		let torndown = false

		// Some browsers hand back a suspended context when it wasn't created
		// during a user gesture.
		context.resume().catch(() => {})

		context.audioWorklet
			.addModule(WORKLET_URL)
			.then(() => {
				if (torndown || context.state === 'closed') return
				workletNode = new AudioWorkletNode(context, 'voice-changer', {
					numberOfInputs: 1,
					numberOfOutputs: 1,
					outputChannelCount: [1],
				})
				source
					.connect(workletNode)
					.connect(low)
					.connect(mid)
					.connect(high)
					.connect(destination)
				paramsSubscription = voiceParams$.subscribe((params) =>
					applyParams(context, workletNode!, { low, mid, high }, params)
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
