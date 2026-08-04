import { useObservableAsValue } from 'partytracks/react'
import { useRef, useState } from 'react'
import { fileToDataUrl, setStillImage, stillImage$ } from '~/utils/stillImage'
import { Button } from './Button'
import { Label } from './Label'

/**
 * Registers the picture shown in place of the camera after the reveal.
 *
 * Saved as soon as it is picked rather than on submit: the name form is a
 * real POST, and the reload would otherwise throw the choice away.
 */
export function StillImagePicker({ className }: { className?: string }) {
	const image = useObservableAsValue(stillImage$, null)
	const inputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string>()

	return (
		<div className={className}>
			<Label htmlFor="still-image">変装解除後の画像（任意）</Label>
			<p className="pb-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
				変装が解けたあともカメラを出したくないときに、映像の代わりに送る画像です。
				この画像はブラウザに保存されるだけで、サーバーには送りません。
			</p>
			<div className="flex items-center gap-3">
				{image && (
					<img
						src={image}
						alt="登録した画像"
						className="h-16 w-16 rounded-lg object-cover"
					/>
				)}
				<input
					ref={inputRef}
					id="still-image"
					type="file"
					accept="image/*"
					className="text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs dark:file:bg-zinc-700 dark:file:text-zinc-100"
					onChange={async (e) => {
						const file = e.currentTarget.files?.[0]
						if (!file) return
						setError(undefined)
						try {
							setStillImage(await fileToDataUrl(file))
						} catch (err) {
							setError('画像を読み込めませんでした: ' + String(err))
						}
					}}
				/>
				{image && (
					<Button
						type="button"
						displayType="secondary"
						className="text-xs"
						onClick={() => {
							setStillImage(null)
							if (inputRef.current) inputRef.current.value = ''
						}}
					>
						削除
					</Button>
				)}
			</div>
			{error && <p className="pt-1 text-xs text-red-500">{error}</p>}
		</div>
	)
}
