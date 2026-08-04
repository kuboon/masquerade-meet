import type { MetaFunction } from '@remix-run/cloudflare'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'react-use'
import { AudioIndicator } from '~/components/AudioIndicator'
import { Button } from '~/components/Button'
import { Label } from '~/components/Label'
import { Option, Select } from '~/components/Select'
import { Slider } from '~/components/Slider'
import { TextArea } from '~/components/TextArea'
import { Toggle } from '~/components/Toggle'
import {
	characterSets,
	defaultCharacterSetId,
	getCharacterSet,
} from '~/utils/characterSets'
import type { VoiceParams } from '~/utils/characters'
import { cn } from '~/utils/style'
import {
	applyVoiceParams,
	createToneNodes,
	createVoiceChangerNode,
	type ToneNodes,
} from '~/utils/voiceChanger'

export const meta: MetaFunction = () => [
	{ title: 'ボイス調整ツール' },
	// Not linked from anywhere and not meant to be found.
	{ name: 'robots', content: 'noindex' },
]

/** Long enough for a sentence, short enough to loop without getting tiresome. */
const RECORD_SECONDS = 5

const DRAFTS_KEY = 'masquerade:dev:voice-drafts'

type Drafts = Record<string, Record<string, VoiceParams>>

interface Graph {
	context: AudioContext
	worklet: AudioWorkletNode
	tone: ToneNodes
}

const round = (value: number) => Number(value.toFixed(4))

function voiceParamsEqual(a: VoiceParams, b: VoiceParams) {
	return JSON.stringify(a) === JSON.stringify(b)
}

/** The same shape the character files are written in, ready to paste. */
function toSource(voice: VoiceParams) {
	const { tone } = voice
	return [
		'voice: {',
		`\tpitchRatio: ${round(voice.pitchRatio)},`,
		`\tvibratoRate: ${round(voice.vibratoRate)},`,
		`\tvibratoDepth: ${round(voice.vibratoDepth)},`,
		`\tringModHz: ${round(voice.ringModHz)},`,
		`\tringModDepth: ${round(voice.ringModDepth)},`,
		`\ttone: tone(${round(tone.low)}, ${round(tone.midFreq)}, ${round(tone.midGain)}, ${round(tone.midQ)}, ${round(tone.high)}),`,
		'},',
	].join('\n')
}

/**
 * Dials in a character's voice by ear.
 *
 * The graph below is the production one — the same worklet and the same tone
 * stack, built from the same helpers — with a recorded loop where the mic
 * would be. That is the whole point: a setting that sounds right here has to
 * sound the same in a meeting.
 *
 * Two things it does NOT reproduce. The optional noise suppression transform
 * is not in this chain, and the sample rate here is whatever this machine's
 * output runs at, while the worklet's grain size is counted in samples — so
 * artefacts shift a little between devices.
 */
export default function DevVoice() {
	const [setId, setSetId] = useState(defaultCharacterSetId)
	const characterSet = getCharacterSet(setId)
	const [characterId, setCharacterId] = useState(characterSet.characters[0].id)
	const character =
		characterSet.characters.find((c) => c.id === characterId) ??
		characterSet.characters[0]

	const [drafts, setDrafts] = useLocalStorage<Drafts>(DRAFTS_KEY, {})
	const draft = drafts?.[characterSet.id]?.[character.id]
	const voice = draft ?? character.voice

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

	// Created on a click, never on mount: a context built outside a user
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

	// Retarget the live graph on every slider move, with production's ramp, so
	// dragging a control does not click.
	useEffect(() => {
		const graph = graphRef.current
		if (!graph) return
		applyVoiceParams(graph.context, graph.worklet, graph.tone, voice)
	}, [voice])

	const stopPlayback = useCallback(() => {
		sourceRef.current?.stop()
		sourceRef.current = undefined
		setPlaying(false)
	}, [])

	const startPlayback = useCallback(async () => {
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

	// Set while a recording is in flight so the 停止 button can cut it short.
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

		stopPlayback()
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
	}, [ensureGraph, stopPlayback])

	const update = (next: VoiceParams) =>
		setDrafts({
			...drafts,
			[characterSet.id]: { ...drafts?.[characterSet.id], [character.id]: next },
		})

	const setField = (key: keyof Omit<VoiceParams, 'tone'>) => (value: number) =>
		update({ ...voice, [key]: value })

	const setTone = (key: keyof VoiceParams['tone']) => (value: number) =>
		update({ ...voice, tone: { ...voice.tone, [key]: value } })

	const reset = () => {
		const forSet = { ...drafts?.[characterSet.id] }
		delete forSet[character.id]
		setDrafts({ ...drafts, [characterSet.id]: forSet })
	}

	const download = () => {
		const voices = Object.fromEntries(
			characterSet.characters.map((c) => [
				c.id,
				drafts?.[characterSet.id]?.[c.id] ?? c.voice,
			])
		)
		const blob = new Blob(
			[
				JSON.stringify(
					{
						characterSetId: characterSet.id,
						exportedAt: new Date().toISOString(),
						voices,
					},
					null,
					'\t'
				),
			],
			{ type: 'application/json' }
		)
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = `voice-${characterSet.id}.json`
		anchor.click()
		URL.revokeObjectURL(url)
	}

	const edited = characterSet.characters.filter((c) =>
		draftDiffers(drafts, characterSet.id, c.id, c.voice)
	).length

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-4">
			<div>
				<h1 className="text-2xl font-bold">ボイス調整ツール</h1>
				<p className="pt-1 text-sm text-zinc-500 dark:text-zinc-400">
					自分の声を{RECORD_SECONDS}
					秒録音してループ再生しながら、キャラクターごとの声色を詰めます。
					会議で使われるのと同じワークレットと EQ
					を通しています。ノイズ抑制は含みません。
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
				<Button onClick={record} disabled={recording}>
					{recording ? `録音中… ${secondsLeft}` : '自分の声を録音'}
				</Button>
				{recording && (
					<>
						<Button
							displayType="secondary"
							onClick={() => stopRecordingRef.current()}
						>
							停止
						</Button>
						{recordingTrack && <AudioIndicator audioTrack={recordingTrack} />}
					</>
				)}
				<Button
					displayType="secondary"
					disabled={!hasRecording || recording}
					onClick={() => (playing ? stopPlayback() : startPlayback())}
				>
					{playing ? '再生を止める' : 'ループ再生'}
				</Button>
				<div className="flex items-center gap-2">
					<Toggle
						id="bypass"
						checked={bypass}
						onCheckedChange={(checked) => setBypass(checked === true)}
					/>
					<Label htmlFor="bypass" className="text-sm">
						素の声で聞く
					</Label>
				</div>
				{!hasRecording && !recording && (
					<span className="text-sm text-zinc-500 dark:text-zinc-400">
						まず録音してください
					</span>
				)}
			</div>

			{error && (
				<p className="rounded-md bg-red-200 p-3 text-sm text-zinc-800 dark:bg-red-700 dark:text-zinc-200">
					{error}
				</p>
			)}

			<div className="space-y-2">
				<Select id="set" value={setId} onValueChange={setSetId}>
					{characterSets.map((set) => (
						<Option key={set.id} value={set.id}>
							{set.name}
						</Option>
					))}
				</Select>
				<ul className="grid grid-cols-5 gap-2 sm:grid-cols-8">
					{characterSet.characters.map((c) => (
						<li key={c.id}>
							<button
								type="button"
								onClick={() => setCharacterId(c.id)}
								title={c.name}
								className={cn(
									'relative w-full overflow-hidden rounded-lg border-2 transition',
									c.id === character.id
										? 'border-orange-500'
										: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
								)}
							>
								<img src={c.image} alt={c.name} className="w-full" />
								{draftDiffers(drafts, characterSet.id, c.id, c.voice) && (
									<span
										className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500"
										title="編集済み"
									/>
								)}
							</button>
						</li>
					))}
				</ul>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					{edited > 0 ? `${edited}体を編集中` : 'ソースの値のままです'}
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-[12rem_1fr]">
				<div className="space-y-2">
					<img
						src={character.image}
						alt={character.name}
						className="w-full rounded-lg"
					/>
					<p className="text-lg font-bold">
						{character.emoji} {character.name}
					</p>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						{character.tagline}
					</p>
					<Button
						displayType="secondary"
						className="text-xs"
						disabled={!draft}
						onClick={reset}
					>
						このキャラをリセット
					</Button>
				</div>

				<div className="space-y-4">
					<Slider
						label="ピッチ比"
						unit="1 = そのまま"
						min={0.25}
						max={4}
						step={0.01}
						value={voice.pitchRatio}
						onChange={setField('pitchRatio')}
					/>
					<Slider
						label="ビブラート速度"
						unit="Hz"
						min={0}
						max={20}
						step={0.1}
						value={voice.vibratoRate}
						onChange={setField('vibratoRate')}
					/>
					<Slider
						label="ビブラート深さ"
						unit="0–1"
						min={0}
						max={1}
						step={0.01}
						value={voice.vibratoDepth}
						onChange={setField('vibratoDepth')}
					/>
					<Slider
						label="リングモジュレータ"
						unit="Hz"
						min={0}
						max={4000}
						step={1}
						value={voice.ringModHz}
						onChange={setField('ringModHz')}
					/>
					<Slider
						label="リングモジュレータ深さ"
						unit="0–1"
						min={0}
						max={1}
						step={0.01}
						value={voice.ringModDepth}
						onChange={setField('ringModDepth')}
					/>
					<hr className="border-zinc-200 dark:border-zinc-700" />
					<Slider
						label="低域"
						unit="dB / 320Hz シェルフ"
						min={-24}
						max={24}
						step={0.5}
						value={voice.tone.low}
						onChange={setTone('low')}
					/>
					<Slider
						label="中域の中心"
						unit="Hz"
						min={200}
						max={6000}
						step={10}
						value={voice.tone.midFreq}
						onChange={setTone('midFreq')}
					/>
					<Slider
						label="中域のゲイン"
						unit="dB"
						min={-24}
						max={24}
						step={0.5}
						value={voice.tone.midGain}
						onChange={setTone('midGain')}
					/>
					<Slider
						label="中域の Q"
						unit="狭さ"
						min={0.1}
						max={10}
						step={0.1}
						value={voice.tone.midQ}
						onChange={setTone('midQ')}
					/>
					<Slider
						label="高域"
						unit="dB / 3200Hz シェルフ"
						min={-24}
						max={24}
						step={0.5}
						value={voice.tone.high}
						onChange={setTone('high')}
					/>
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="snippet">貼り付け用</Label>
					<Button className="text-xs" onClick={download}>
						JSON をダウンロード
					</Button>
				</div>
				<TextArea
					id="snippet"
					readOnly
					rows={9}
					className="font-mono text-xs"
					value={toSource(voice)}
				/>
			</div>
		</div>
	)
}

function draftDiffers(
	drafts: Drafts | undefined,
	setId: string,
	characterId: string,
	source: VoiceParams
) {
	const draft = drafts?.[setId]?.[characterId]
	return draft !== undefined && !voiceParamsEqual(draft, source)
}
