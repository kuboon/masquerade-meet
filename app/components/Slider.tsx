import { useId } from 'react'
import { cn } from '~/utils/style'
import { Label } from './Label'

/**
 * A labelled numeric control: a range for sweeping and a number box for
 * typing an exact value.
 *
 * Both are wired to the same state because neither is enough on its own —
 * a range is how you find a setting by ear, and a box is how you write one
 * down or nudge it by a single step.
 */
export function Slider({
	label,
	value,
	min,
	max,
	step,
	unit,
	onChange,
	className,
}: {
	label: string
	value: number
	min: number
	max: number
	step: number
	unit?: string
	onChange: (value: number) => void
	className?: string
}) {
	const id = useId()
	const commit = (raw: string) => {
		const parsed = Number(raw)
		if (Number.isFinite(parsed)) onChange(parsed)
	}

	return (
		<div className={cn('space-y-1', className)}>
			<div className="flex items-baseline justify-between gap-2">
				<Label htmlFor={id} className="text-xs">
					{label}
				</Label>
				<span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
					{unit}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<input
					id={id}
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => commit(e.currentTarget.value)}
					className="h-1 w-full cursor-pointer accent-orange-500"
				/>
				<input
					type="number"
					aria-label={`${label} (数値)`}
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => commit(e.currentTarget.value)}
					className="w-20 shrink-0 rounded border-2 border-zinc-500 bg-zinc-50 px-1 py-0.5 text-right text-xs tabular-nums text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
				/>
			</div>
		</div>
	)
}
