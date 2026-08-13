import type { Character } from '~/utils/characters'
import { cn } from '~/utils/style'
import { CharacterAvatar } from './CharacterAvatar'

interface Props {
	/** the roster of the room's character set */
	characters: Character[]
	selectedId?: string
	/** taken by somebody else, and no longer anybody's to pick */
	confirmedIds?: string[]
	disabled?: boolean
	onSelect: (characterId: string) => void
}

export function CharacterPicker({
	characters,
	selectedId,
	confirmedIds = [],
	disabled = false,
	onSelect,
}: Props) {
	const gone = new Set(confirmedIds)

	return (
		<ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
			{characters.map((character) => {
				const selected = character.id === selectedId
				// Gone even if it is still what you were wishing for: somebody
				// beat you to it, and the wish is worth nothing now.
				const taken = gone.has(character.id)
				const unavailable = disabled || taken
				return (
					<li key={character.id}>
						<button
							type="button"
							disabled={unavailable}
							onClick={() => onSelect(character.id)}
							aria-pressed={selected}
							title={
								taken
									? `${character.name} — ほかの人が確定しました`
									: `${character.name} — ${character.tagline}`
							}
							className={cn(
								'group relative w-full overflow-hidden rounded-lg border-2 transition',
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
								selected
									? 'border-orange-500 shadow-lg'
									: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600',
								unavailable && 'cursor-not-allowed opacity-35'
							)}
						>
							<CharacterAvatar character={character} />
							{taken && (
								<span className="absolute inset-x-0 top-0 bg-zinc-900/70 py-0.5 text-center text-[10px] font-medium text-white">
									確定済み
								</span>
							)}
							<span className="block truncate bg-zinc-100 px-1 py-1 text-[11px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
								{character.name}
							</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}
