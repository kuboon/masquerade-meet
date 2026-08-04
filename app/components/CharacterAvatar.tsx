import type { Character } from '~/utils/characters'
import { cn } from '~/utils/style'

/**
 * The face a participant wears while the room is masked.
 *
 * `object-contain` rather than `object-cover`: the artwork is square and the
 * tiles it sits in are not, and cropping a character is a design decision
 * rather than something a layout should do on its own.
 */
export function CharacterAvatar({
	character,
	className,
}: {
	character: Character
	className?: string
}) {
	return (
		<img
			src={character.image}
			alt={character.name}
			className={cn('h-full w-full object-contain', className)}
		/>
	)
}
