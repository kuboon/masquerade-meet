import { AudioIndicator } from '~/components/AudioIndicator'
import useVoicePreview, { RECORD_SECONDS } from '~/hooks/useVoicePreview'
import { isDisguised, type VoiceParams } from '~/utils/characters'
import { VOICE_AXES } from '~/utils/voiceAxes'
import { Button } from './Button'
import { Label } from './Label'
import { Slider } from './Slider'
import { Toggle } from './Toggle'

/**
 * Hear yourself as somebody else, and change who that is.
 *
 * The four sliders are the whole voice, not an adjustment to the character's:
 * whoever tunes one here keeps it when the draw hands them a different face.
 * The character only decides where the sliders start.
 */
export function VoicePreview({
	voice,
	onVoiceChange,
	onReset,
	customised,
}: {
	voice: VoiceParams
	onVoiceChange: (voice: VoiceParams) => void
	/** back to whatever the character says */
	onReset: () => void
	customised: boolean
}) {
	const preview = useVoicePreview(voice)

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-3">
				{preview.recording ? (
					<>
						<Button displayType="danger" onClick={preview.stopRecording}>
							録音を止める
						</Button>
						<span className="text-sm tabular-nums">
							あと {preview.secondsLeft} 秒
						</span>
						{preview.recordingTrack && (
							<AudioIndicator audioTrack={preview.recordingTrack} />
						)}
					</>
				) : (
					<Button displayType="secondary" onClick={preview.record}>
						{preview.hasRecording ? '録音し直す' : '声を録音する'}
					</Button>
				)}

				{preview.hasRecording && !preview.recording && (
					<Button onClick={preview.playing ? preview.stop : preview.play}>
						{preview.playing ? '停止' : '変換した声を聴く'}
					</Button>
				)}
			</div>

			{!preview.hasRecording && !preview.recording && (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					{RECORD_SECONDS}
					秒だけ録音して、その場で繰り返し再生します。録音はこのブラウザから出ません。
				</p>
			)}

			{preview.error && <p className="text-xs text-red-500">{preview.error}</p>}

			{preview.hasRecording && (
				<>
					<div className="flex items-center gap-2">
						<Toggle
							id="voice-bypass"
							checked={preview.bypass}
							onCheckedChange={(checked) => preview.setBypass(checked === true)}
						/>
						<Label htmlFor="voice-bypass" className="text-sm">
							変換なしで聴く
						</Label>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						{VOICE_AXES.map((axis) => (
							<Slider
								key={axis.key}
								label={axis.label}
								unit={axis.unit}
								min={axis.min}
								max={axis.max}
								step={0.01}
								value={voice[axis.key]}
								onChange={(value) =>
									onVoiceChange({ ...voice, [axis.key]: value })
								}
							/>
						))}
					</div>

					{!isDisguised(voice) && (
						// Nothing stops them leaving it here, but nobody should walk
						// into a masquerade thinking they are hidden when they are not.
						<p className="text-xs text-orange-700 dark:text-orange-400">
							いまの設定では地声とほとんど変わりません。「体の大きさ」を動かすか、「かすれ」を足してください。
						</p>
					)}

					<div className="flex flex-wrap items-center gap-3">
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							{customised
								? 'この声は、抽選でどのキャラクターになっても引き継がれます。'
								: 'いまはキャラクターの声です。動かすとあなたの声になります。'}
						</p>
						{customised && (
							<Button
								displayType="secondary"
								className="px-2 py-1 text-xs"
								onClick={onReset}
							>
								キャラクターの声にもどす
							</Button>
						)}
					</div>
				</>
			)}
		</div>
	)
}
