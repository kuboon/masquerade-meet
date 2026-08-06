import { characterSets, defaultCharacterSetId } from '~/utils/characterSets'

/**
 * Picks the roster a new room will hide behind.
 *
 * Native radios rather than a Radix control, because the room-creation form
 * has to keep working before the JavaScript arrives — the browser submits
 * `?set=` to /new on its own, and the checked state comes from
 * `peer-checked:` instead of from React.
 *
 * One banner per row rather than a grid of two: the set's name is drawn into
 * the artwork, and at half the width it is too small to read.
 */
export function CharacterSetChooser() {
	return (
		<fieldset className="space-y-2">
			<legend className="pb-2 text-sm font-semibold">キャラクター</legend>
			<div className="space-y-2">
				{characterSets.map((set) => (
					<label key={set.id} className="block cursor-pointer">
						<input
							type="radio"
							name="set"
							value={set.id}
							defaultChecked={set.id === defaultCharacterSetId}
							className="peer sr-only"
						/>
						{/* The image is dimmed from out here rather than by a
						    `peer-checked:` of its own: the peer variant reaches the
						    input's siblings, and the image is a level below one. */}
						<div className="overflow-hidden rounded-lg border-2 border-zinc-200 transition peer-checked:border-orange-500 peer-checked:[&_img]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 dark:border-zinc-700 dark:peer-checked:border-orange-500">
							<img
								src={set.banner}
								// The banner says the name; this is for everyone who
								// cannot see it, and it is what names the radio.
								alt={set.name}
								width={1536}
								height={428}
								className="w-full opacity-60 transition"
							/>
							<p className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
								{set.tagline}
							</p>
						</div>
					</label>
				))}
			</div>
		</fieldset>
	)
}
