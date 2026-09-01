/**
 * Hearing a character before anybody has to sit through it.
 *
 * A page publishing a character set can put a play button beside each face
 * and let a visitor hear what they would sound like. It runs the exact graph
 * a masquerade room runs — same pitch shifter, same filters, same numbers —
 * so what is heard here is what would be heard there.
 *
 * ```ts
 * import { createVoicePreview, recordVoice } from '@kuboon/masquerade-character-set/preview'
 *
 * // Anything decodable: a clip you ship, or the visitor's own voice.
 * const preview = await createVoicePreview()
 * await preview.load(await (await fetch('sample.mp3')).arrayBuffer())
 * playButton.onclick = () => preview.play(lion.voice)
 * ```
 *
 * Two things to know before wiring it up. The audio graph can only be built
 * inside a user gesture — browsers hand back a suspended context otherwise —
 * so build it in the click handler, not on load. And the pitch shifter is
 * 110 kB of WASM fetched on first use, from masq's origin by default; a page
 * that never previews anything never fetches it.
 */

import {
	applyVoiceParams,
	createVoiceGraph,
	disposeVoiceGraph,
} from './graph.ts'
import type { VoiceParams } from './mod.ts'

/** A voice that is not one: what a preview starts on before it is told. */
const silentStart: VoiceParams = {
	size: 0,
	weight: 0,
	nasal: 0,
	roughness: 0,
	throat: 0,
}

export interface VoicePreview {
	/** the context it was built in, in case a page has its own plans for it */
	readonly context: AudioContext
	/** Decodes and keeps a clip. Replaces whatever was loaded before. */
	load(audio: ArrayBuffer | AudioBuffer): Promise<void>
	/**
	 * Plays the loaded clip in this voice, from the top, looping.
	 *
	 * Called again with a different voice while it is playing, it retargets
	 * the live graph rather than starting over — which is the whole point of
	 * being able to hear two characters one after the other.
	 */
	play(voice: VoiceParams): Promise<void>
	stop(): void
	/** Give back the audio hardware. The preview cannot be used after this. */
	close(): Promise<void>
}

/**
 * Builds a preview. Call it from a click handler.
 *
 * @param options.context an `AudioContext` of your own, if you have one
 * @param options.stretchUrl where to fetch the pitch shifter from
 */
export async function createVoicePreview(options?: {
	context?: AudioContext
	stretchUrl?: string
}): Promise<VoicePreview> {
	const context = options?.context ?? new AudioContext()
	await context.resume().catch(() => {})
	const graph = await createVoiceGraph(context, {
		voice: silentStart,
		stretchUrl: options?.stretchUrl,
	})
	graph.output.connect(context.destination)

	let buffer: AudioBuffer | undefined
	let source: AudioBufferSourceNode | undefined
	let closed = false

	const stop = () => {
		// A buffer source is single-use: stopping one means the next play
		// builds another, which is why this is not a pause.
		source?.stop()
		source?.disconnect()
		source = undefined
	}

	return {
		context,
		async load(audio) {
			buffer =
				audio instanceof AudioBuffer
					? audio
					: await context.decodeAudioData(audio.slice(0))
		},
		async play(voice) {
			if (closed) throw new Error('preview is closed')
			if (buffer === undefined) throw new Error('nothing loaded to play')
			await applyVoiceParams(graph, voice)
			if (source !== undefined) return
			source = context.createBufferSource()
			source.buffer = buffer
			source.loop = true
			source.connect(graph.input)
			source.start()
		},
		stop,
		async close() {
			closed = true
			stop()
			disposeVoiceGraph(graph)
			if (options?.context === undefined) await context.close()
		},
	}
}

/**
 * A few seconds of the visitor's own voice, to hear themselves disguised.
 *
 * Optional in every sense: a page can ship a clip instead and never ask for
 * a microphone. But hearing *your own voice* come back as the lion is the
 * thing that sells a character set, and a recorded loop is safe to play out
 * loud — there is no live path from the microphone to the speakers, so it
 * cannot feed back.
 *
 * The recording never leaves the page.
 */
export async function recordVoice(seconds = 5): Promise<ArrayBuffer> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
	const recorder = new MediaRecorder(stream)
	const chunks: Blob[] = []
	recorder.ondataavailable = (event) => chunks.push(event.data)

	const finished = new Promise<void>((resolve) => {
		recorder.onstop = () => resolve()
	})
	recorder.start()
	const timer = setTimeout(() => recorder.stop(), seconds * 1000)
	await finished
	clearTimeout(timer)
	// Otherwise the browser keeps showing the page as recording, which is
	// alarming and true.
	for (const track of stream.getTracks()) track.stop()

	return new Blob(chunks, { type: recorder.mimeType }).arrayBuffer()
}
