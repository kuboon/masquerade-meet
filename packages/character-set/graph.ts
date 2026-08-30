/**
 * The disguise itself: the Web Audio graph a masquerade voice is played
 * through.
 *
 * The same graph the app builds for a live microphone, which is the only
 * reason it is worth having — a preview that approximates the room is a
 * preview that lies about it. What it needs from its caller is a context to
 * build in and somewhere to fetch the pitch shifter from.
 *
 * ```
 * input → stretch → ring → low → mid → high → output
 *                    ↑
 *          carrier → depth
 * ```
 */

import type { VoiceParams } from './mod.ts'
import { toEngineParams } from './voice.ts'

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

/**
 * Where the pitch shifter is served from.
 *
 * A URL rather than a bundled import: it carries 110 kB of WASM that only
 * matters once somebody actually puts a mask on, and this way a page that
 * never previews a voice never fetches it. The default is the copy masq
 * serves, which is CORS-open for exactly this — pass your own if you would
 * rather not depend on somebody else's origin.
 *
 * https://github.com/Signalsmith-Audio/signalsmith-stretch (MIT)
 */
export const DEFAULT_STRETCH_URL =
	'https://masq.kbn.one/voice/SignalsmithStretch.mjs'

/** The part of the shifter's interface this graph uses. */
export interface StretchNode extends AudioWorkletNode {
	schedule(change: {
		output?: number
		active?: boolean
		semitones?: number
		tonalityHz?: number
		formantSemitones?: number
		formantCompensation?: boolean
		formantBaseHz?: number
	}): Promise<void>
	configure(config: {
		blockMs?: number | null
		intervalMs?: number
		splitComputation?: boolean
		preset?: 'default' | 'cheaper'
	}): Promise<void>
	/** processing delay in live-input mode, in seconds */
	latency(): Promise<number>
	start(when?: number): Promise<void>
	stop(when?: number): Promise<void>
}

type CreateStretchNode = (
	context: BaseAudioContext,
	options?: AudioWorkletNodeOptions
) => Promise<StretchNode>

const stretchLoaders = new Map<string, Promise<CreateStretchNode>>()

function loadStretch(url: string) {
	let loader = stretchLoaders.get(url)
	if (loader === undefined) {
		loader = import(/* @vite-ignore */ url).then(
			(m) => m.default as CreateStretchNode
		)
		stretchLoaders.set(url, loader)
	}
	return loader
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
	context: C,
	{
		voice,
		stretchUrl = DEFAULT_STRETCH_URL,
	}: {
		/**
		 * The voice to start on. Required rather than defaulted, because a
		 * graph handed back before it has been told anything renders silence
		 * — see the note at the end of this function.
		 */
		voice: VoiceParams
		/** where to fetch the pitch shifter from */
		stretchUrl?: string
	}
): Promise<VoiceGraph<C>> {
	const SignalsmithStretch = await loadStretch(stretchUrl)
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
	await applyVoiceParams(graph, voice)
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
export function applyVoiceParams(
	graph: VoiceGraph,
	params: VoiceParams
): Promise<void> {
	const now = graph.context.currentTime
	const engine = toEngineParams(params)

	// The shifter eases into a scheduled change by itself, so this is the one
	// control that does not want a ramp of ours on top.
	const scheduled = graph.stretch.schedule({
		active: true,
		semitones: engine.semitones,
		// Always compensated, so that `formantSemitones` is measured from
		// where the formants started rather than from the shifted pitch. That
		// makes "travel with the pitch" the case where the two numbers are
		// equal, and everything else a throat that does not match the voice.
		//
		// Measured rather than assumed: compensating and asking for exactly
		// the pitch shift renders identically to not compensating at all —
		// see `e2e-tests/voice-changer.spec.ts`, which pins that, because it
		// is what keeps every character written before `throat` sounding the
		// way it always did.
		formantCompensation: true,
		formantSemitones: engine.formantSemitones,
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

export function disposeVoiceGraph(graph: VoiceGraph): void {
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
