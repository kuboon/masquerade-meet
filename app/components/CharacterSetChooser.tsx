import { characterSets, defaultCharacterSetId } from '~/utils/characterSets'

/**
 * Picks the roster a new room will hide behind.
 *
 * Native radios rather than a Radix control, because the room-creation form
 * has to keep working before the JavaScript arrives — the browser submits
 * `?set=` to /new on its own, and the checked state comes from
 * `peer-checked:` instead of from React.
 *
 * Only a few characters are shown per set: fifteen thumbnails each would
 * turn the landing page into a sprite sheet.
 */
const PREVIEW_COUNT = 4

export function CharacterSetChooser() {
	return (
		<fieldset className="space-y-2">
			<legend className="pb-2 text-sm font-semibold">キャラクター</legend>
			<div className="grid gap-2 sm:grid-cols-2">
				{characterSets.map((set) => (
					<label key={set.id} className="cursor-pointer">
						<input
							type="radio"
							name="set"
							value={set.id}
							defaultChecked={set.id === defaultCharacterSetId}
							className="peer sr-only"
						/>
						<div className="rounded-lg border-2 border-zinc-200 p-3 transition peer-checked:border-orange-500 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 dark:border-zinc-700 dark:peer-checked:border-orange-500">
							<div className="flex gap-1">
								{set.characters.slice(0, PREVIEW_COUNT).map((character) => (
									<img
										key={character.id}
										src={character.image}
										alt=""
										className="h-10 w-10 rounded object-contain"
									/>
								))}
							</div>
							<p className="pt-2 text-sm font-medium">{set.name}</p>
							<p className="text-xs text-zinc-500 dark:text-zinc-400">
								{set.tagline}
							</p>
						</div>
					</label>
				))}
			</div>
		</fieldset>
	)
}
