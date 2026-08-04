import { Form, useLocation } from '@remix-run/react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Disclaimer } from './Disclaimer'
import { Input } from './Input'
import { Label } from './Label'
import { StillImagePicker } from './StillImagePicker'

/**
 * Asks for a display name before letting anyone into a room.
 *
 * This used to be a page of its own that every route redirected to, which
 * meant the first thing a newcomer saw was a bare name box with no idea
 * what they were signing up for. Asking here means the room URL explains
 * itself first.
 *
 * It gates the whole room subtree, so no websocket opens and no character
 * is handed out until there is a name to attach them to — which the Durable
 * Object requires on connect.
 */
export function EnsureUsername({
	username,
	roomName,
	children,
}: {
	username: string | null
	roomName: string
	children: ReactNode
}) {
	const location = useLocation()
	if (username) return <>{children}</>

	return (
		<div className="mx-auto flex h-full max-w-prose flex-col justify-center gap-6 p-4">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold">🎭 マスカレード</h1>
				<p className="text-sm text-zinc-600 dark:text-zinc-300">
					ルーム「{roomName}」に参加します。
				</p>
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					参加者はキャラクターに変装し、声も見た目もそのキャラクターとして話します。
					声はこのブラウザの中で変換されるので、生の声は誰にも届きません。
					管理者が合図すると全員の変装が一斉に解け、そこで正体が分かります。
				</p>
			</div>

			<Form method="post" action="/api/username" className="space-y-4">
				<input
					type="hidden"
					name="return-url"
					value={location.pathname + location.search}
				/>
				<div className="space-y-2">
					<Label htmlFor="username">名前</Label>
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						変装が解けるまで誰にも見えません。表示されるのはキャラクター名だけです。
					</p>
					<Input
						autoComplete="off"
						autoFocus
						required
						type="text"
						id="username"
						name="username"
					/>
				</div>
				<StillImagePicker />
				<Button type="submit">参加する</Button>
			</Form>

			<Disclaimer />
		</div>
	)
}
