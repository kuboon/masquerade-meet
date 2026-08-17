import { useRoomContext } from '~/hooks/useRoomContext'

/**
 * The card in your hand, during the meeting.
 *
 * It sits beside the "you are the bear" pill because it is the same kind of
 * thing: what this one person is, that nobody else can see. Nothing about it
 * is on anybody else's screen — the room sent it to this connection alone.
 *
 * Nothing at all in a room playing no game, which is most of them.
 */
export function RoleCard() {
	const { masquerade } = useRoomContext()
	const { myRole, isGameMaster, revealed, roleDeck } = masquerade

	if (isGameMaster) {
		return (
			<Pill className="bg-orange-500/90">
				あなたはゲームマスターです（カードなし・地声）
			</Pill>
		)
	}
	// After the reveal everybody's card is on their own tile, so a private
	// copy of one of them is just something else in the way.
	if (revealed || myRole === undefined) {
		// Somebody who walked in after the cards went out. Saying so beats
		// leaving them to wonder which card they are holding.
		if (!revealed && roleDeck.length > 0) {
			return <Pill className="bg-zinc-900/70">カードは配られていません</Pill>
		}
		return null
	}

	return <Pill className="bg-orange-600/90">あなたの役職: {myRole}</Pill>
}

function Pill({
	className,
	children,
}: {
	className: string
	children: React.ReactNode
}) {
	return (
		<span className={`rounded-full px-3 py-1 text-xs text-white ${className}`}>
			{children}
		</span>
	)
}
