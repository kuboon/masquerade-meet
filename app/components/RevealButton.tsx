import { useState } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import AlertDialog from './AlertDialog'
import { Button } from './Button'
import { Tooltip } from './Tooltip'

/**
 * Host-only control that drops everyone's disguise after a countdown.
 * It is confirmed first because there is no way back: once the room has been
 * revealed, real names and cameras stay on.
 */
export function RevealButton() {
	const { masquerade } = useRoomContext()
	const [open, setOpen] = useState(false)

	if (!masquerade.isHost) return null
	const armed = masquerade.phase === 'masquerade'

	return (
		<AlertDialog.Root open={open} onOpenChange={setOpen}>
			<Tooltip content="全員のボイスチェンジを一斉に解除します">
				<span>
					<AlertDialog.Trigger asChild>
						<Button displayType="danger" disabled={!armed}>
							正体を明かす
						</Button>
					</AlertDialog.Trigger>
				</span>
			</Tooltip>
			<AlertDialog.Portal>
				<AlertDialog.Overlay />
				<AlertDialog.Content className="bg-white dark:bg-zinc-900">
					<AlertDialog.Title>正体を明かしますか？</AlertDialog.Title>
					<AlertDialog.Description>
						5秒のカウントダウンのあと、全員のボイスチェンジが一斉に解除され、
						本名とカメラ映像が表示されます。元に戻すことはできません。
					</AlertDialog.Description>
					<AlertDialog.Actions>
						<AlertDialog.Cancel asChild>
							<Button displayType="secondary">やめる</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<Button
								displayType="danger"
								onClick={() => masquerade.startReveal()}
							>
								カウントダウン開始
							</Button>
						</AlertDialog.Action>
					</AlertDialog.Actions>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}
