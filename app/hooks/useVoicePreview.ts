import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceParams } from '~/utils/characters'
import {
	applyVoiceParams,
	createToneNodes,
	createVoiceChangerNode,
	type ToneNodes,
} from '~/utils/voiceChanger'

/** Long enough for a sentence, short enough to loop without getting tiresome. */
export const RECORD_SECONDS = 5

interface Graph {
	context: AudioContext
	worklet: AudioWorkletNode
	tone: ToneNodes
}

/**
 * Hearing yourself as somebody else, without a meeting.
 *
 * The graph is the production one — the same worklet and the same tone stack,
 * built from the same helpers — with a recorded loop where the microphone
 * would be. That is the point: a voice that sounds right here has to sound
 * the same in a meeting.
 *
 * A loop rather than live monitoring, and deliberately so. Anybody listening
 * on speakers with an open microphone would otherwise be handed a howl, and
 * the whole business here is people turning their volume up to listen
 * closely.
 *
 * Two things it does not reproduce: the optional noise suppression transform
 * is not in this chain, and the sample rate is whatever this machine's output
 * runs at, while the worklet's grain size is counted in samples — so
 * artefacts shift a little between devices.
 */
export default function useVoicePreview(voice: VoiceParams) {
	const [recording, setRecording] = useState(false)
	const [secondsLeft, setSecondsLeft] = useState(RECORD_SECONDS)
	const [recordingTrack, setRecordingTrack] = useState<MediaStreamTrack>()
	const [hasRecording, setHasRecording] = useState(false)
	const [playing, setPlaying] = useState(false)
	const [bypass, setBypass] = useState(false)
	const [error, setError] = useState<string>()

	const graphRef = useRef<Graph>()
	const bufferRef = useRef<AudioBuffer>()
	const sourceRef = useRef<AudioBufferSourceNode>()

	// Built on a click, never on mount: a context created outside a user
	// gesture comes back suspended in Chrome and Safari.
	const ensureGraph = useCallback(async () => {
		if (graphRef.current) {
			await graphRef.current.context.resume().catch(() => {})
			return graphRef.current
		}
		const context = new AudioContext()
		const worklet = await createVoiceChangerNode(context)
		const tone = createToneNodes(context)
		worklet.connect(tone.low).connect(tone.mid).connect(tone.high)
		tone.high.connect(context.destination)
		graphRef.current = { context, worklet, tone }
		return graphRef.current
	}, [])

	useEffect(
		() => () => {
			sourceRef.current?.stop()
			graphRef.current?.context.close().catch(() => {})
		},
		[]
	)

	// Retarget the live graph on every change, with production's ramp, so
	// dragging a control does not click.
	useEffect(() => {
		const graph = graphRef.current
		if (!graph) return
		applyVoiceParams(graph.context, graph.worklet, graph.tone, voice)
	}, [voice])

	const stop = useCallback(() => {
		sourceRef.current?.stop()
		sourceRef.current = undefined
		setPlaying(false)
	}, [])

	const play = useCallback(async () => {
		const buffer = bufferRef.current
		if (!buffer) return
		const graph = await ensureGraph()
		applyVoiceParams(graph.context, graph.worklet, graph.tone, voice)

		sourceRef.current?.stop()
		const source = graph.context.createBufferSource()
		source.buffer = buffer
		source.loop = true
		source.connect(bypass ? graph.context.destination : graph.worklet)
		source.start()
		sourceRef.current = source
		setPlaying(true)
	}, [bypass, ensureGraph, voice])

	// Flip the disguise in and out without interrupting the loop.
	useEffect(() => {
		const graph = graphRef.current
		const source = sourceRef.current
		if (!graph || !source) return
		source.disconnect()
		source.connect(bypass ? graph.context.destination : graph.worklet)
	}, [bypass])

	// Set while a recording is in flight so it can be cut short.
	const stopRecordingRef = useRef(() => {})

	const record = useCallback(async () => {
		setError(undefined)
		let stream: MediaStream
		try {
			// Default constraints, matching how the meeting opens the mic.
			stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		} catch (e) {
			setError('マイクを開けませんでした: ' + String(e))
			return
		}

		stop()
		setRecording(true)
		setSecondsLeft(RECORD_SECONDS)
		setRecordingTrack(stream.getAudioTracks()[0])

		const recorder = new MediaRecorder(stream)
		const chunks: Blob[] = []
		recorder.ondataavailable = (e) => chunks.push(e.data)
		recorder.onstop = async () => {
			stream.getTracks().forEach((t) => t.stop())
			setRecordingTrack(undefined)
			setRecording(false)
			try {
				const graph = await ensureGraph()
				bufferRef.current = await graph.context.decodeAudioData(
					await new Blob(chunks).arrayBuffer()
				)
				setHasRecording(true)
			} catch (e) {
				// Stopping almost immediately can leave too little audio to
				// decode. Say so rather than leaving the play button dead.
				setError('録音を読み込めませんでした: ' + String(e))
			}
		}
		recorder.start()

		const interval = setInterval(
			() => setSecondsLeft((left) => Math.max(0, left - 1)),
			1000
		)
		const timeout = setTimeout(() => {
			clearInterval(interval)
			if (recorder.state !== 'inactive') recorder.stop()
		}, RECORD_SECONDS * 1000)

		stopRecordingRef.current = () => {
			clearInterval(interval)
			clearTimeout(timeout)
			if (recorder.state !== 'inactive') recorder.stop()
		}
	}, [ensureGraph, stop])

	const stopRecording = useCallback(() => stopRecordingRef.current(), [])

	return {
		record,
		stopRecording,
		recording,
		secondsLeft,
		recordingTrack,
		hasRecording,
		play,
		stop,
		playing,
		bypass,
		setBypass,
		error,
	}
}
