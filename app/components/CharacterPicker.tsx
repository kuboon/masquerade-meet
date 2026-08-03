import { characters } from '~/utils/characters'
import { cn } from '~/utils/style'
import { CharacterAvatar } from './CharacterAvatar'

interface Props {
	selectedId?: string
	/** characters already claimed by somebody else */
	takenIds: Set<string>
	disabled?: boolean
	onSelect: (characterId: string) => void
}

export function CharacterPicker({
	selectedId,
	takenIds,
	disabled = false,
	onSelect,
}: Props) {
	return (
		<ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
			{characters.map((character) => {
				const taken = takenIds.has(character.id)
				const selected = character.id === selectedId
				return (
					<li key={character.id}>
						<button
							type="button"
							disabled={taken || disabled}
							onClick={() => onSelect(character.id)}
							aria-pressed={selected}
							title={
								taken
									? `${character.name}は他の人が使用中です`
									: `${character.name} — ${character.tagline}`
							}
							className={cn(
								'group relative w-full overflow-hidden rounded-lg border-2 transition',
								'focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
								selected
									? 'border-orange-500 shadow-lg'
									: 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600',
								(taken || disabled) && 'cursor-not-allowed opacity-35'
							)}
						>
							<CharacterAvatar character={character} />
							<span className="block truncate bg-zinc-100 px-1 py-1 text-[11px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
								{character.name}
							</span>
							{taken && (
								<span className="absolute inset-x-0 top-1/3 bg-zinc-900/70 py-1 text-center text-[10px] text-white">
									使用中
								</span>
							)}
						</button>
					</li>
				)
			})}
		</ul>
	)
}
