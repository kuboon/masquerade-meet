import { useEffect, useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { dealtDeck, maxRoleCount, roleTally } from '~/utils/roles'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Label } from './Label'
import { Option, Select } from './Select'

/**
 * The value the picker uses for "let the room decide".
 *
 * A sentinel rather than an empty string because Radix reserves that, and a
 * word nobody could type as a card because the parser drops anything with a
 * space in it and this has none of its own — it is only ever compared
 * against, never dealt.
 */
const RANDOM = '__random__'

/**
 * Role cards, set up in the lobby.
 *
 * Everybody sees what is in the deck: which cards are in play is the one
 * thing a table has to agree on out loud. Nobody sees who is holding what,
 * including — unless they are the game master — after the deal.
 *
 * The whole component is invisible in a room that is not playing a game,
 * which is most of them: the host is the only one offered the field, and
 * everyone else sees nothing until the host has typed something into it.
 */
export function RoleDeck({
	plan,
	onPlanChange,
}: {
	/** the game master's answers so far, by connection id */
	plan: Record<string, string>
	onPlanChange: (plan: Record<string, string>) => void
}) {
	const { masquerade } = useRoomContext()
	const {
		isHost,
		isGameMaster,
		gameMasterId,
		roleDeck,
		participants,
		starting,
		setRoleDeck,
		setGameMaster,
	} = masquerade

	// Mirrors the room until the host types, and after that the host wins.
	// Reading the room back into the field while somebody is typing in it
	// would fight them for the cursor every time the round trip landed.
	const [typed, setTyped] = useState<string>()
	const value = typed ?? roleDeck.join(' ')
	useEffect(() => {
		if (typed === undefined) return
		const timeout = setTimeout(() => setRoleDeck(typed), 300)
		return () => clearTimeout(timeout)
	}, [typed, setRoleDeck])

	// The game master deals rather than plays, so they are not in the count
	// the deal is sized against.
	const players = participants.filter((u) => u.id !== gameMasterId)
	const deal = dealtDeck(roleDeck, players.length)

	if (!isHost && roleDeck.length === 0) return null

	return (
		<div className="space-y-2">
			<h2 className="text-sm font-semibold">役職カード（任意）</h2>

			{isHost && (
				<div className="space-y-1">
					<Label htmlFor="role-deck">配るカード</Label>
					<Input
						id="role-deck"
						type="text"
						autoComplete="off"
						placeholder="人狼 占い師 村人"
						disabled={starting}
						value={value}
						onChange={(e) => setTyped(e.currentTarget.value)}
					/>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						スペース区切り（全角も可）。人数が足りないときは最後のカードを複数人に配ります。空欄なら役職なしで進みます。
					</p>
				</div>
			)}

			{deal.length > 0 && (
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					いまの{players.length}人なら{' '}
					{roleTally(deal)
						.map(({ role, count }) => `${role}${count}`)
						.join('・')}
				</p>
			)}
			{isHost && roleDeck.length >= maxRoleCount && (
				<p className="text-xs text-orange-700 dark:text-orange-400">
					カードは{maxRoleCount}枚までです。それ以降は無視されます。
				</p>
			)}

			{isHost && (
				<div className="flex items-start gap-2">
					<Checkbox
						id="game-master"
						className="mt-0.5 shrink-0"
						checked={isGameMaster}
						disabled={starting}
						onCheckedChange={(checked) => setGameMaster(checked === true)}
					/>
					<div>
						<Label htmlFor="game-master" className="text-sm">
							自分はゲームマスター
						</Label>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							自分にはカードを配らず、誰にどのカードが渡ったかを把握します。声も変換されません（進行役の声が変わっていると案内になりません）。
						</p>
					</div>
				</div>
			)}

			{isGameMaster && roleDeck.length > 0 && (
				<RolePlanner deal={deal} plan={plan} onPlanChange={onPlanChange} />
			)}
		</div>
	)
}

/**
 * Who gets what, decided in advance by the game master.
 *
 * Only for people who have taken a character: the whole point of naming
 * somebody here is to name them by the face they will be wearing, and a face
 * that is still a wish may belong to somebody else by the time the meeting
 * starts.
 *
 * Nothing is sent as it is filled in. The answers travel with the start, so
 * what the game master is looking at when they press the button is exactly
 * what the room will deal — and there is never a moment where the room is
 * holding the plan with nothing to do with it.
 */
function RolePlanner({
	deal,
	plan,
	onPlanChange,
}: {
	/** the cards actually going out, one per player */
	deal: string[]
	plan: Record<string, string>
	onPlanChange: (plan: Record<string, string>) => void
}) {
	const { masquerade } = useRoomContext()
	const { gameMasterId, roleDeck, participants, starting } = masquerade
	const players = participants.filter((u) => u.id !== gameMasterId)
	const cards = [...new Set(roleDeck)]

	// More of a card promised than the deal has to give. The room settles it
	// by putting the extras back in the draw, which is a strange thing to
	// discover afterwards, so it is said here instead.
	const oversubscribed = cards.filter(
		(card) =>
			Object.entries(plan).filter(
				([id, role]) => role === card && players.some((u) => u.id === id)
			).length > deal.filter((c) => c === card).length
	)

	return (
		<div className="space-y-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
			<p className="text-xs font-semibold">誰にどのカードを渡すか</p>
			<ul className="space-y-1">
				{players.map((user) => (
					<li key={user.id} className="flex items-center justify-between gap-2">
						<span className="truncate text-sm">
							{user.characterConfirmed ? (
								user.name
							) : (
								<span className="text-zinc-500 dark:text-zinc-400">
									キャラクター確定待ち
								</span>
							)}
						</span>
						<Select
							value={plan[user.id] ?? RANDOM}
							disabled={starting || !user.characterConfirmed}
							onValueChange={(next) => {
								const { [user.id]: _dropped, ...rest } = plan
								onPlanChange(
									next === RANDOM ? rest : { ...rest, [user.id]: next }
								)
							}}
						>
							<Option value={RANDOM}>ランダム</Option>
							{cards.map((card) => (
								<Option key={card} value={card}>
									{card}
								</Option>
							))}
						</Select>
					</li>
				))}
			</ul>
			{oversubscribed.length > 0 && (
				<p className="text-xs text-orange-700 dark:text-orange-400">
					{oversubscribed.join('・')}
					の枚数が足りません。あふれた人にはランダムで配られます。
				</p>
			)}
			<p className="text-xs text-zinc-500 dark:text-zinc-400">
				指定しなかった人にはランダムで配られます。この内訳はあなたにしか見えません。
			</p>
		</div>
	)
}
