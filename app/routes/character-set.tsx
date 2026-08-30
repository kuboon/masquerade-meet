import {
	fetchCharacterSet,
	isCharacterSetUrl,
} from '@kuboon/masquerade-character-set/check'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { Form, useLoaderData, useNavigation } from '@remix-run/react'
import { useState } from 'react'
import { AudioIndicator } from '~/components/AudioIndicator'
import { Button, ButtonLink } from '~/components/Button'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { Toggle } from '~/components/Toggle'
import useVoicePreview, { RECORD_SECONDS } from '~/hooks/useVoicePreview'
import type { CharacterSet } from '~/utils/characters'
import { cn } from '~/utils/style'

export const meta: MetaFunction = () => [{ title: 'キャラセットを確かめる' }]

/**
 * The page somebody writing a character set actually needs.
 *
 * A room that cannot use a set says nothing to whoever followed the link —
 * it opens with the built-in faces instead. So the author has to be able to
 * ask, and this is where they ask: the set is fetched and checked **by
 * exactly the code a room runs**, and then played back through exactly the
 * graph a meeting runs. Nothing here is a second implementation of either,
 * because a checker that disagrees with the room is worse than none.
 *
 * The fetch is on the server rather than in the page on purpose. It means an
 * author does not have to serve CORS headers to check their own file, and it
 * means what is checked is what a room would see rather than what a browser
 * would let this page see. Nothing of the response is passed back except a
 * set that passed or the reasons it did not.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url).searchParams.get('url')?.trim() ?? ''
	if (url === '') return json({ url, set: null, problems: [] as string[] })
	if (!isCharacterSetUrl(url)) {
		return json({
			url,
			set: null,
			problems: ['https:// で始まる URL を入れてください'],
		})
	}
	const { set, problems } = await fetchCharacterSet(url)
	return json({ url, set: set ?? null, problems: problems as string[] })
}

export default function CharacterSetChecker() {
	const { url, set, problems } = useLoaderData<typeof loader>()
	const checking = useNavigation().state !== 'idle'

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-4">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold">キャラセットを確かめる</h1>
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					自分のサイトに置いたキャラセットが、ルームで使える形になっているか確かめます。
					ルームが読み込みに失敗しても、リンクを踏んだ人には何も表示されません（標準のキャラクターで開きます）。
					気づけるのはここだけです。
				</p>
			</div>

			<Form method="get" className="space-y-2">
				<Label htmlFor="url">キャラセットの URL</Label>
				<div className="flex gap-2">
					<Input
						id="url"
						name="url"
						type="url"
						inputMode="url"
						autoComplete="off"
						defaultValue={url}
						placeholder="https://example.com/masquerade.json"
					/>
					<Button
						type="submit"
						disabled={checking}
						className="shrink-0 text-sm"
					>
						{checking ? '確認中…' : '確かめる'}
					</Button>
				</div>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					JSON ファイルか、
					<code>
						&lt;script
						type=&quot;application/masquerade-character-set+json&quot;&gt;
					</code>
					を埋め込んだページの URL。
				</p>
			</Form>

			{problems.length > 0 && (
				<div className="space-y-2 rounded-md bg-orange-100 p-4 text-sm text-zinc-900 dark:bg-orange-900 dark:text-zinc-100">
					<p className="font-bold">このままではルームで使えません</p>
					<ul className="list-inside list-disc space-y-1">
						{problems.map((problem) => (
							<li key={problem}>{problem}</li>
						))}
					</ul>
				</div>
			)}

			{set && <Passed set={set} url={url} />}
		</div>
	)
}

function Passed({ set, url }: { set: CharacterSet; url: string }) {
	const [characterId, setCharacterId] = useState(set.characters[0].id)
	const character =
		set.characters.find((c) => c.id === characterId) ?? set.characters[0]
	const {
		record,
		recording,
		secondsLeft,
		recordingTrack,
		hasRecording,
		playing,
		play,
		stop,
		bypass,
		setBypass,
		error,
	} = useVoicePreview(character.voice)

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<p className="text-sm font-bold text-green-700 dark:text-green-400">
					✓ このセットはルームで使えます
				</p>
				<p className="text-sm">
					{set.name} — {set.characters.length}人
					<span className="text-zinc-500 dark:text-zinc-400">
						（このセットで開いたルームの定員）
					</span>
				</p>
			</div>

			{/* Recorded and looped rather than monitored live, so that listening
			    on speakers with the microphone open cannot produce a howl. */}
			<div className="space-y-2 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
				<p className="text-sm font-semibold">自分の声で聴いてみる</p>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						displayType={hasRecording ? 'secondary' : 'primary'}
						className="text-sm"
						disabled={recording}
						onClick={record}
					>
						{recording ? `録音中… ${secondsLeft}` : `${RECORD_SECONDS}秒 録音`}
					</Button>
					{recordingTrack && <AudioIndicator audioTrack={recordingTrack} />}
					<Button
						className="text-sm"
						disabled={!hasRecording}
						onClick={playing ? stop : play}
					>
						{playing ? '停止' : `${character.name}の声で再生`}
					</Button>
					<Toggle
						id="bypass"
						checked={bypass}
						onCheckedChange={(checked) => setBypass(checked === true)}
					/>
					<Label htmlFor="bypass" className="text-sm">
						素の声で聴く
					</Label>
				</div>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					録音した声をループ再生します。録音はこのページの外に出ません。
					再生中にキャラクターを選ぶと、鳴らし直さずに切り替わります。
				</p>
				{error && (
					<p className="text-sm text-red-700 dark:text-red-400">{error}</p>
				)}
			</div>

			<ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
				{set.characters.map((c) => (
					<li key={c.id}>
						<button
							type="button"
							onClick={() => setCharacterId(c.id)}
							className={cn(
								'w-full overflow-hidden rounded-lg border-2 text-left transition',
								c.id === character.id
									? 'border-orange-500'
									: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'
							)}
						>
							{/* Loaded straight from the author's own host, which is
							    also what every participant's browser will do. A
							    broken image here is a broken face in a meeting. */}
							<img src={c.image} alt={c.name} className="w-full" />
							<span className="block truncate px-1 py-1 text-xs">
								{c.emoji} {c.name}
							</span>
						</button>
					</li>
				))}
			</ul>

			<ButtonLink
				to={`/new?set=${encodeURIComponent(url)}`}
				className="text-sm"
			>
				このキャラセットでルームを作る
			</ButtonLink>
		</div>
	)
}
