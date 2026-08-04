import { createGrid } from 'good-grid'
import { useGridDimensions } from 'good-grid/react'
import { useId, useRef } from 'react'
import { Flipper } from 'react-flip-toolkit'
import type { Tile } from '~/utils/stage'
import { Participant } from './Participant'
import { VacantSeat } from './VacantSeat'

export function ParticipantLayout({
	tiles,
	gap,
	aspectRatio,
}: {
	tiles: Tile[]
	gap: number
	aspectRatio: string
}) {
	const $el = useRef<HTMLDivElement>(null)

	// hook that listens to resize of the element
	// and returns it's dimensions
	const dimensions = useGridDimensions($el)

	const { width, height, getPosition } = createGrid({
		dimensions,
		count: tiles.length,
		aspectRatio,
		gap,
	})

	const id = useId()

	// No empty check here on purpose: good-grid's useGridDimensions throws if
	// the element it was handed never renders, so returning null on an empty
	// grid takes the whole room down with it. Callers keep this out of the
	// tree instead.
	return (
		<Flipper flipKey={id + tiles.length}>
			<div
				className="absolute inset-[--gap] h-[--height] w-[--width] isolate flex flex-wrap justify-around"
				ref={$el}
				style={
					{
						'--gap': '-' + gap + 'px',
						height: `calc(100% + ${gap}px + ${gap}px`,
						width: `calc(100% + ${gap}px + ${gap}px`,
					} as any
				}
			>
				{tiles.map((tile, i) => {
					const { top, left } = getPosition(i)
					const style = {
						width,
						height,
						top,
						left,
						position: 'absolute' as const,
						transition: '0.4s all',
					}
					return tile.user ? (
						<Participant style={style} key={tile.id} user={tile.user} />
					) : (
						<VacantSeat style={style} key={tile.id} seatId={tile.id} />
					)
				})}
			</div>
		</Flipper>
	)
}
