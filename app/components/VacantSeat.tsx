import { forwardRef } from 'react'
import { Flipped } from 'react-flip-toolkit'
import { useRoomContext } from '~/hooks/useRoomContext'
import { Button } from './Button'

/**
 * A seat whose occupant is not here.
 *
 * It stays on the stage so that nobody else has to move: a grid that
 * reflows every time somebody's connection hiccups is a grid you have to
 * re-read, and half of what is on screen here is who is where.
 *
 * The host can clear it, which is the only thing that does reflow the room.
 */
export const VacantSeat = forwardRef<
	HTMLDivElement,
	JSX.IntrinsicElements['div'] & { seatId: string }
>(({ seatId, style }, ref) => {
	const { masquerade } = useRoomContext()

	return (
		<div className="grow shrink text-base" ref={ref} style={style}>
			<Flipped flipId={seatId}>
				<div className="relative mx-auto grid h-full max-w-[--participant-max-width] place-items-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-400">
					<div className="space-y-2 p-2 text-center">
						<p className="text-sm">退出中</p>
						{masquerade.isHost && (
							<Button
								displayType="secondary"
								className="px-2 py-1 text-xs"
								onClick={() => masquerade.removeSeat(seatId)}
							>
								枠を削除
							</Button>
						)}
					</div>
				</div>
			</Flipped>
		</div>
	)
})

VacantSeat.displayName = 'VacantSeat'
