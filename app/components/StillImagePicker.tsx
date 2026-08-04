import { useObservableAsValue } from 'partytracks/react'
import { useRef, useState } from 'react'
import { fileToDataUrl, setStillImage, stillImage$ } from '~/utils/stillImage'
import { Button } from './Button'
import { Label } from './Label'

/**
 * Registers the picture shown in place of the camera after the reveal.
 *
 * The file input is deliberately kept out of sight once there is a picture.
 * A browser will not report a previously stored file as "chosen", so an
 * input sitting next to a thumbnail says "no file selected" underneath the
 * very picture it is describing — which reads as "this did not save".
 */
export function StillImagePicker({ className }: { className?: string }) {
	const image = useObservableAsValue(stillImage$, null)
	const inputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string>()

	const choose = async (file: File | undefined) => {
		if (!file) return
		setError(undefined)
		try {
			setStillImage(await fileToDataUrl(file))
		} catch (err) {
			setError('画像を読み込めませんでした: ' + String(err))
		}
	}

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
					// Hidden rather than removed once something is registered, so
					// the label and the "変更" button below still have it to drive.
					className={
						image
							? 'sr-only'
							: 'text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs dark:file:bg-zinc-700 dark:file:text-zinc-100'
					}
					onChange={(e) => choose(e.currentTarget.files?.[0])}
				/>
				{image && (
					<>
						<p className="text-xs text-green-700 dark:text-green-400">
							登録済み
						</p>
						<Button
							type="button"
							displayType="secondary"
							className="text-xs"
							onClick={() => inputRef.current?.click()}
						>
							変更
						</Button>
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
					</>
				)}
			</div>
			{error && <p className="pt-1 text-xs text-red-500">{error}</p>}
		</div>
	)
}
