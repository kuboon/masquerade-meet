import type { Character } from '~/utils/characters'
import { cn } from '~/utils/style'
import { CharacterAvatar } from './CharacterAvatar'

interface Props {
	/** the roster of the room's character set */
	characters: Character[]
	selectedId?: string
	disabled?: boolean
	onSelect: (characterId: string) => void
}

export function CharacterPicker({
	characters,
	selectedId,
	disabled = false,
	onSelect,
}: Props) {
	return (
		<ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
			{characters.map((character) => {
				const selected = character.id === selectedId
				return (
					<li key={character.id}>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onSelect(character.id)}
							aria-pressed={selected}
							title={`${character.name} — ${character.tagline}`}
							className={cn(
								'group relative w-full overflow-hidden rounded-lg border-2 transition',
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
								selected
									? 'border-orange-500 shadow-lg'
									: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600',
								disabled && 'cursor-not-allowed opacity-35'
							)}
						>
							<CharacterAvatar character={character} />
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
