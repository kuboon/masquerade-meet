import { useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import AlertDialog from './AlertDialog'
import { Button } from './Button'
import { Tooltip } from './Tooltip'

/**
 * Host-only control that runs the whole thing again with the same people.
 *
 * Only live once the masks are off, which is when a round is actually over.
 * Everyone lands back in the lobby to pick a character again — names stay,
 * so the second round starts with a click rather than a form.
 */
export function RestartButton() {
	const { masquerade } = useRoomContext()
	const [open, setOpen] = useState(false)

	if (!masquerade.isHost) return null

	return (
		<AlertDialog.Root open={open} onOpenChange={setOpen}>
			<Tooltip content="同じメンバーでキャラクター選択からやり直します">
				<span>
					<AlertDialog.Trigger asChild>
						<Button displayType="secondary" disabled={!masquerade.canRestart}>
							最初から
						</Button>
					</AlertDialog.Trigger>
				</span>
			</Tooltip>
			<AlertDialog.Portal>
				<AlertDialog.Overlay />
				<AlertDialog.Content className="bg-white dark:bg-zinc-900">
					<AlertDialog.Title>最初からやり直しますか？</AlertDialog.Title>
					<AlertDialog.Description>
						参加者全員がキャラクター選択の画面に戻り、もう一度変装してミーティングを始められます。
						登録した名前と画像はそのまま残ります。
					</AlertDialog.Description>
					<AlertDialog.Actions>
						<AlertDialog.Cancel asChild>
							<Button displayType="secondary">やめる</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<Button onClick={() => masquerade.restartMeeting()}>
								キャラクター選択に戻る
							</Button>
						</AlertDialog.Action>
					</AlertDialog.Actions>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
