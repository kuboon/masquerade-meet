import { useRoomContext } from '~/hooks/useRoomContext'
import type { ClientMessage } from '~/types/Messages'
import { AiPushToTalkButtion } from './AiPushToTalkButton'
import { Button } from './Button'
import { Trigger } from './Dialog'
import { InviteAiDialog } from './InviteAiDialog'

function RemoveAiButton() {
	const {
		room: { websocket },
	} = useRoomContext()
	return (
		<Button
			onClick={() =>
				websocket.send(
					JSON.stringify({ type: 'disableAi' } satisfies ClientMessage)
				)
			}
			className="text-xs"
			displayType="secondary"
		>
			Remove AI
		</Button>
	)
}

export function AiButton() {
	const {
		room: {
			roomState: {
				ai: { connectionPending, error },
				users,
			},
		},
	} = useRoomContext()

	const aiUser = users.find((u) => u.id === 'ai')

	return (
		<>
			{error && <span className="text-red-800 dark:text-red-500">{error}</span>}
			{aiUser ? (
				<>
					<RemoveAiButton />
					<AiPushToTalkButtion />
				</>
			) : (
				<InviteAiDialog>
					<Trigger asChild>
						<Button
							className="text-xs flex items-center gap-2"
							disabled={connectionPending}
						>
							<span>Invite AI</span>
						</Button>
					</Trigger>
				</InviteAiDialog>
			)}
		</>
	)
}
