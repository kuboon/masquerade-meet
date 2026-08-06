import type { MetaFunction } from '@remix-run/cloudflare'
import { useState } from 'react'
import { useLocalStorage } from 'react-use'
import { AudioIndicator } from '~/components/AudioIndicator'
import { Button } from '~/components/Button'
import { Label } from '~/components/Label'
import { Option, Select } from '~/components/Select'
import { Slider } from '~/components/Slider'
import { TextArea } from '~/components/TextArea'
import { Toggle } from '~/components/Toggle'
import useVoicePreview, { RECORD_SECONDS } from '~/hooks/useVoicePreview'
import {
	characterSets,
	defaultCharacterSetId,
	getCharacterSet,
} from '~/utils/characterSets'
import type { Character, CharacterSet, VoiceParams } from '~/utils/characters'
import { cn } from '~/utils/style'
import { VOICE_AXES } from '~/utils/voiceAxes'

export const meta: MetaFunction = () => [
	{ title: 'ボイス調整ツール' },
	// Not linked from anywhere and not meant to be found.
	{ name: 'robots', content: 'noindex' },
]

const DRAFTS_KEY = 'masquerade:dev:voice-drafts'

type Drafts = Record<string, Record<string, VoiceParams>>

const round = (value: number) => Number(value.toFixed(4))

function voiceParamsEqual(a: VoiceParams, b: VoiceParams) {
	return JSON.stringify(a) === JSON.stringify(b)
}

/** The same shape the character files are written in, ready to paste. */
function toSource(v: VoiceParams) {
	const args = [v.size, v.weight, v.nasal, v.roughness].map(round)
	// The fourth is optional in the helper, and most characters are clean.
	const written = v.roughness === 0 ? args.slice(0, 3) : args
	return `voice: voice(${written.join(', ')}),`
}

/**
 * Every character in the set, in file order, each block labelled with the id
 * it belongs to. Dialling in a set means fifteen edits to one file, and
 * hunting them down one character at a time is how one gets forgotten.
 */
function toSetSource(
	set: CharacterSet,
	voiceOf: (c: Character) => VoiceParams
) {
	return set.characters
		.map((c) => `// ${c.id} — ${c.name}\n${toSource(voiceOf(c))}`)
		.join('\n\n')
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
	// Whatever is current for a character: the draft if it has one, otherwise
	// what the source file says. Both the export and the whole-set snippet are
	// built from this, so an untouched character still comes out.
	const voiceOf = (c: Character) => drafts?.[characterSet.id]?.[c.id] ?? c.voice

	const [wholeSet, setWholeSet] = useState(false)

	const preview = useVoicePreview(voice)
	const {
		recording,
		secondsLeft,
		recordingTrack,
		hasRecording,
		playing,
		bypass,
		setBypass,
		error,
	} = preview

	const update = (next: VoiceParams) =>
		setDrafts({
			...drafts,
			[characterSet.id]: { ...drafts?.[characterSet.id], [character.id]: next },
		})

	const setField = (key: keyof VoiceParams) => (value: number) =>
		update({ ...voice, [key]: value })

	const reset = () => {
		const forSet = { ...drafts?.[characterSet.id] }
		delete forSet[character.id]
		setDrafts({ ...drafts, [characterSet.id]: forSet })
	}

	const download = () => {
		const voices = Object.fromEntries(
			characterSet.characters.map((c) => [c.id, voiceOf(c)])
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
				<Button onClick={preview.record} disabled={recording}>
					{recording ? `録音中… ${secondsLeft}` : '自分の声を録音'}
				</Button>
				{recording && (
					<>
						<Button
							displayType="secondary"
							onClick={() => preview.stopRecording()}
						>
							停止
						</Button>
						{recordingTrack && <AudioIndicator audioTrack={recordingTrack} />}
					</>
				)}
				<Button
					displayType="secondary"
					disabled={!hasRecording || recording}
					onClick={() => (playing ? preview.stop() : preview.play())}
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
					{VOICE_AXES.map((axis) => (
						<Slider
							key={axis.key}
							label={axis.label}
							unit={axis.unit}
							min={axis.min}
							max={axis.max}
							step={0.01}
							value={voice[axis.key]}
							onChange={setField(axis.key)}
						/>
					))}
				</div>
			</div>

			<div className="space-y-2 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Label htmlFor="snippet">書き出し</Label>
					<div className="flex items-center gap-3">
						<Toggle
							id="whole-set"
							checked={wholeSet}
							onCheckedChange={(checked) => setWholeSet(checked === true)}
						/>
						<Label htmlFor="whole-set" className="text-sm">
							セット全体
						</Label>
						<Button className="text-xs" onClick={download}>
							セット全体を JSON で保存
						</Button>
					</div>
				</div>
				<TextArea
					id="snippet"
					readOnly
					rows={wholeSet ? 20 : 9}
					className="font-mono text-xs"
					value={
						wholeSet ? toSetSource(characterSet, voiceOf) : toSource(voice)
					}
				/>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					JSON は常にセット全体（{characterSet.characters.length}
					体）を含みます。上のテキストは「セット全体」で全員分、オフなら選択中の
					1 体だけです。 編集していないキャラクターはソースの値のまま出ます。
					貼り戻し先は <code>
						app/utils/characterSets/{characterSet.id}.ts
					</code>{' '}
					です。
				</p>
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
