import { Input } from './Input'
import { Label } from './Label'
import { StillImagePicker } from './StillImagePicker'

/** Matches the Durable Object's own limit, so nothing is silently trimmed. */
const MAX_NAME_LENGTH = 40

/**
 * What everyone finds out at the end: the name, and optionally a picture to
 * show instead of a camera.
 *
 * Asked for here rather than on a screen of its own before the room. Both
 * answers only matter after the unmasking, so this is the moment they make
 * sense — and it means somebody who gave a name weeks ago is still offered
 * the picture rather than being waved straight through.
 */
export function UnmaskedIdentity({
	name,
	onNameChange,
	disabled,
}: {
	name: string
	onNameChange: (name: string) => void
	disabled?: boolean
}) {
	return (
		<div className="space-y-2">
			<h2 className="text-sm font-semibold">
				アンマスク後に表示する名前と画像
			</h2>
			<div className="space-y-1">
				<Label htmlFor="display-name">名前</Label>
				<Input
					id="display-name"
					type="text"
					autoComplete="off"
					required
					maxLength={MAX_NAME_LENGTH}
					disabled={disabled}
					value={name}
					onChange={(e) => onNameChange(e.currentTarget.value)}
				/>
			</div>
			<StillImagePicker />
			<p className="text-xs text-zinc-500 dark:text-zinc-400">
				どちらも変装が解けるまで誰にも見えません。名前を入れるまで準備完了にはできません。
			</p>
		</div>
	)
}
