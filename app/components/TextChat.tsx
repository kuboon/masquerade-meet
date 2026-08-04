import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useEffect, useRef, useState } from 'react'
import type { User } from '~/types/Messages'
import { chatSenderName, type ChatMessage } from '~/utils/textChat'
import { Button } from './Button'
import { Icon } from './Icon/Icon'
import { Input } from './Input'

function timeOf(at: number) {
	return new Date(at).toLocaleTimeString('ja-JP', {
		hour: '2-digit',
		minute: '2-digit',
	})
}

/**
 * The chat log, over the meeting rather than beside it.
 *
 * Sender names are resolved on every render instead of being baked into the
 * message, which is what makes the whole log flip from character names to
 * real ones the moment the masks come off.
 */
export function TextChat({
	messages,
	users,
	selfId,
	onSend,
	onClose,
}: {
	messages: ChatMessage[]
	users: User[]
	selfId?: string
	onSend: (body: string) => void
	onClose: () => void
}) {
	const [draft, setDraft] = useState('')
	const bottomRef = useRef<HTMLDivElement>(null)

	// Follow the conversation. Nothing clever about staying put when the
	// reader has scrolled up — the log is short and lives one meeting.
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: 'end' })
	}, [messages.length])

	return (
		<aside
			aria-label="チャット"
			className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
		>
			<div className="flex items-center justify-between border-b border-zinc-200 p-2 dark:border-zinc-700">
				<h2 className="px-1 text-sm font-bold">チャット</h2>
				<Button
					displayType="secondary"
					className="px-2 py-1 text-xs"
					onClick={onClose}
				>
					閉じる
				</Button>
			</div>

			<div className="flex-grow space-y-3 overflow-y-auto p-3">
				{messages.length === 0 && (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						まだ発言はありません。ここでの発言はこのミーティング限りで、保存されません。
					</p>
				)}
				{messages.map((message) => (
					<div key={message.id} className="text-sm">
						<div className="flex items-baseline gap-2">
							<span
								className={
									message.from === selfId
										? 'font-bold text-orange-600 dark:text-orange-400'
										: 'font-bold'
								}
							>
								{chatSenderName(message, users)}
							</span>
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								{timeOf(message.at)}
							</span>
						</div>
						{/* Line breaks are kept, and long unbroken strings wrap
						    rather than stretching the panel. */}
						<p className="whitespace-pre-wrap break-words">{message.body}</p>
					</div>
				))}
				<div ref={bottomRef} />
			</div>

			<form
				className="flex items-center gap-2 border-t border-zinc-200 p-2 dark:border-zinc-700"
				onSubmit={(e) => {
					e.preventDefault()
					onSend(draft)
					setDraft('')
				}}
			>
				<VisuallyHidden>
					<label htmlFor="chat-input">メッセージ</label>
				</VisuallyHidden>
				<Input
					id="chat-input"
					autoComplete="off"
					placeholder="メッセージを入力"
					value={draft}
					onChange={(e) => setDraft(e.currentTarget.value)}
				/>
				<Button
					type="submit"
					// The shared button is built for a toolbar, where nothing is
					// competing for the width. Next to a text field it needs to be
					// told to hold its ground.
					className="shrink-0 whitespace-nowrap px-3 py-1 text-xs"
					disabled={draft.trim() === ''}
				>
					送信
				</Button>
			</form>
		</aside>
	)
}

/** Opens the chat, and says how much of it has gone unread meanwhile. */
export function ChatButton({
	open,
	unread,
	onClick,
}: {
	open: boolean
	unread: number
	onClick: () => void
}) {
	return (
		<Button
			displayType={open ? 'primary' : 'secondary'}
			className="relative"
			onClick={onClick}
		>
			<Icon type="chat" />
			<VisuallyHidden>
				{unread > 0 ? `チャット（未読${unread}件）` : 'チャット'}
			</VisuallyHidden>
			{unread > 0 && (
				<span
					aria-hidden
					className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1 text-xs leading-5 text-white"
				>
					{unread > 99 ? '99+' : unread}
				</span>
			)}
		</Button>
	)
}
