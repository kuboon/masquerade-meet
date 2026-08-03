import type { Character } from '~/utils/characters'
import { cn } from '~/utils/style'

/**
 * Draws a stock character as a parametric SVG. Keeping the artwork as data
 * instead of 15 image files means a character's palette and features live
 * next to its voice settings, and the avatar stays crisp at tile size or
 * full-screen.
 */
export function CharacterAvatar({
	character,
	className,
	showBackground = true,
}: {
	character: Character
	className?: string
	showBackground?: boolean
}) {
	const { base, dark, light, accent, bg } = character.colors
	const { head, ears, eyes, mouth, muzzle, cheeks, mask, mane } = character.face

	const mirrored = (node: JSX.Element, key: string) => (
		<g key={key}>
			{node}
			<g transform="translate(100 0) scale(-1 1)">{node}</g>
		</g>
	)

	const earNodes = () => {
		switch (ears) {
			case 'round':
				return mirrored(
					<g>
						<circle cx="27" cy="31" r="13" fill={dark} />
						<circle cx="27" cy="31" r="7" fill={light} />
					</g>,
					'ear-round'
				)
			case 'pointy':
				return mirrored(
					<g>
						<path d="M19 42 L25 7 L49 27 Z" fill={dark} />
						<path d="M25 38 L28 17 L41 29 Z" fill={light} />
					</g>,
					'ear-pointy'
				)
			case 'long':
				return mirrored(
					<g transform="rotate(-9 36 22)">
						<ellipse
							cx="36"
							cy="22"
							rx="8.5"
							ry="23"
							fill={base}
							stroke={dark}
							strokeWidth="1.5"
						/>
						<ellipse
							cx="36"
							cy="22"
							rx="4"
							ry="16"
							fill={accent}
							opacity="0.55"
						/>
					</g>,
					'ear-long'
				)
			case 'horns':
				return mirrored(
					<path
						d="M25 32 C15 20 18 10 29 5 C25 15 30 23 36 27 Z"
						fill={accent}
						stroke={dark}
						strokeWidth="1.2"
					/>,
					'ear-horns'
				)
			case 'antenna':
				return mirrored(
					<g stroke={dark} strokeWidth="3" strokeLinecap="round">
						<path d="M36 32 L28 10" fill="none" />
						<circle cx="27" cy="8" r="5" fill={accent} stroke="none" />
					</g>,
					'ear-antenna'
				)
			case 'tuft':
				return mirrored(
					<path d="M30 34 L34 14 L45 30 Z" fill={dark} />,
					'ear-tuft'
				)
			default:
				return null
		}
	}

	const headNode = () => {
		const stroke = { fill: base, stroke: dark, strokeWidth: 1.5 }
		switch (head) {
			case 'oval':
				return <ellipse cx="50" cy="57" rx="28" ry="32" {...stroke} />
			case 'egg':
				return (
					<path
						d="M50 25 C68 25 79 42 79 60 C79 78 66 89 50 89 C34 89 21 78 21 60 C21 42 32 25 50 25 Z"
						{...stroke}
					/>
				)
			case 'square':
				return <rect x="20" y="27" width="60" height="59" rx="17" {...stroke} />
			case 'ghost':
				return (
					<path
						d="M50 24 C33 24 21 37 21 55 L21 80 Q28 88 36 80 Q43 73 50 80 Q57 88 65 80 Q72 73 79 80 L79 55 C79 37 67 24 50 24 Z"
						{...stroke}
					/>
				)
			default:
				return <circle cx="50" cy="57" r="31" {...stroke} />
		}
	}

	const eyeNodes = () => {
		switch (eyes) {
			case 'round':
				return mirrored(
					<g>
						<circle
							cx="38"
							cy="53"
							r="8"
							fill="#fff"
							stroke={dark}
							strokeWidth="1"
						/>
						<circle cx="39.5" cy="53.5" r="4" fill={accent} />
						<circle cx="37" cy="51" r="1.6" fill="#fff" />
					</g>,
					'eye-round'
				)
			case 'sleepy':
				return mirrored(
					<path
						d="M31 55 Q38 47 45 55"
						stroke={accent}
						strokeWidth="3.5"
						strokeLinecap="round"
						fill="none"
					/>,
					'eye-sleepy'
				)
			case 'wide':
				return mirrored(
					<g transform="rotate(-12 38 53)">
						<ellipse cx="38" cy="53" rx="9" ry="12" fill={accent} />
						<ellipse
							cx="35"
							cy="49"
							rx="2.6"
							ry="3.6"
							fill="#fff"
							opacity="0.8"
						/>
					</g>,
					'eye-wide'
				)
			case 'bulge':
				return mirrored(
					<g>
						<circle
							cx="34"
							cy="34"
							r="12"
							fill={light}
							stroke={dark}
							strokeWidth="1.5"
						/>
						<circle cx="34" cy="35" r="5" fill={accent} />
					</g>,
					'eye-bulge'
				)
			case 'visor':
				return (
					<g>
						<rect x="24" y="44" width="52" height="17" rx="8.5" fill={dark} />
						<rect x="31" y="50" width="12" height="5" rx="2.5" fill={accent} />
						<rect x="57" y="50" width="12" height="5" rx="2.5" fill={accent} />
					</g>
				)
			case 'star':
				return mirrored(
					<path
						d="M38 44 L41 51 L48.5 51.5 L42.8 56.2 L44.7 63.5 L38 59.4 L31.3 63.5 L33.2 56.2 L27.5 51.5 L35 51 Z"
						fill={accent}
					/>,
					'eye-star'
				)
			default:
				return mirrored(
					<circle cx="38" cy="53" r="4.5" fill={accent} />,
					'eye-dot'
				)
		}
	}

	const mouthNode = () => {
		switch (mouth) {
			case 'beak':
				return (
					<path
						d="M50 61 L62 70 L50 81 L38 70 Z"
						fill={accent}
						stroke={dark}
						strokeWidth="1"
					/>
				)
			case 'wide':
				return (
					<path
						d="M28 68 Q50 85 72 68"
						stroke={accent}
						strokeWidth="3.5"
						strokeLinecap="round"
						fill="none"
					/>
				)
			case 'fang':
				return (
					<g>
						<path
							d="M41 71 Q50 79 59 71"
							stroke={accent}
							strokeWidth="3"
							strokeLinecap="round"
							fill="none"
						/>
						<path d="M44 72 L47 78 L50 72 Z" fill="#fff" />
						<path d="M52 72 L55 78 L58 72 Z" fill="#fff" />
					</g>
				)
			case 'grid':
				return (
					<g>
						<rect x="35" y="67" width="30" height="13" rx="4" fill={dark} />
						<g stroke={accent} strokeWidth="2" strokeLinecap="round">
							<path d="M42 70 L42 77" />
							<path d="M50 70 L50 77" />
							<path d="M58 70 L58 77" />
						</g>
					</g>
				)
			case 'ooo':
				return <ellipse cx="50" cy="71" rx="6" ry="8.5" fill={accent} />
			case 'none':
				return null
			default:
				return (
					<path
						d="M42 71 Q50 78 58 71"
						stroke={accent}
						strokeWidth="3"
						strokeLinecap="round"
						fill="none"
					/>
				)
		}
	}

	const maneNodes = () =>
		Array.from({ length: 13 }, (_, i) => {
			const angle = (i / 13) * Math.PI * 2
			return (
				<circle
					key={i}
					cx={50 + Math.cos(angle) * 33}
					cy={57 + Math.sin(angle) * 33}
					r="12"
					fill={dark}
				/>
			)
		})

	return (
		<svg
			viewBox="0 0 100 100"
			className={cn('h-full w-full', className)}
			role="img"
			aria-label={character.name}
		>
			{showBackground && <rect width="100" height="100" fill={bg} />}
			{mane && <g>{maneNodes()}</g>}
			{earNodes()}
			{headNode()}
			{muzzle && (
				<g>
					<ellipse cx="50" cy="70" rx="16" ry="11" fill={light} />
					<ellipse cx="50" cy="63" rx="5" ry="3.5" fill={accent} />
				</g>
			)}
			{mask &&
				mirrored(
					<ellipse
						cx="38"
						cy="53"
						rx="13"
						ry="10"
						fill={accent}
						opacity="0.8"
						transform="rotate(-8 38 53)"
					/>,
					'mask'
				)}
			{cheeks &&
				mirrored(
					<ellipse
						cx="29"
						cy="66"
						rx="7"
						ry="4.5"
						fill={accent}
						opacity="0.3"
					/>,
					'cheeks'
				)}
			{eyeNodes()}
			{mouthNode()}
		</svg>
	)
}
