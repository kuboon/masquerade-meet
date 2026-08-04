import type { ActionFunction, LoaderFunctionArgs } from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import { Form, useLoaderData, useNavigate } from '@remix-run/react'
import { nanoid } from 'nanoid'
import invariant from 'tiny-invariant'
import { Button } from '~/components/Button'
import { CharacterSetChooser } from '~/components/CharacterSetChooser'
import { Disclaimer } from '~/components/Disclaimer'
import { Input } from '~/components/Input'
import { Label } from '~/components/Label'
import { useUserMetadata } from '~/hooks/useUserMetadata'
import { characterSets } from '~/utils/characterSets'
import { ACCESS_AUTHENTICATED_USER_EMAIL_HEADER } from '~/utils/constants'
import getUsername from '~/utils/getUsername.server'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const directoryUrl = context.USER_DIRECTORY_URL
	const username = await getUsername(request)
	invariant(username)
	const usedAccess = request.headers.has(ACCESS_AUTHENTICATED_USER_EMAIL_HEADER)
	return json({ username, usedAccess, directoryUrl })
}

export const action: ActionFunction = async ({ request }) => {
	const room = (await request.formData()).get('room')
	invariant(typeof room === 'string')
	return redirect(room.replace(/ /g, '-'))
}

export default function Index() {
	const { username, usedAccess } = useLoaderData<typeof loader>()
	const navigate = useNavigate()
	const { data } = useUserMetadata(username)

	return (
		<div className="flex flex-col items-center justify-center h-full p-4 mx-auto">
			<div className="flex-1"></div>
			<div className="space-y-6 sm:min-w-96">
				<div>
					<h1 className="text-3xl font-bold">🎭 Masquerade Meet</h1>
					<p className="pt-1 text-sm text-zinc-500 dark:text-zinc-400">
						キャラクターに変装して話す、正体あてミーティング
					</p>
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							ログイン中: {data?.displayName}
						</p>
						{!usedAccess && (
							<a
								className="block text-sm underline text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
								href="/set-username"
							>
								Change
							</a>
						)}
					</div>
				</div>
				<Form
					method="get"
					action="/new"
					className="space-y-4"
					onSubmit={(e) => {
						// We shouldn't need a whole server visit to start a new room,
						// so let's just do a redirect here
						e.preventDefault()
						const set = new FormData(e.currentTarget).get('set')
						navigate(
							`/${nanoid(8)}` + (typeof set === 'string' ? `?set=${set}` : '')
						)
						// if someone submits this before the js has loaded then the
						// browser posts to /new, which does the same redirect server side
					}}
				>
					{characterSets.length > 1 && <CharacterSetChooser />}
					<Button className="text-sm" type="submit">
						あたらしいルームを作る
					</Button>
				</Form>
				<details className="cursor-pointer">
					<summary className="text-zinc-500 dark:text-zinc-400">
						ルーム名を入力して参加する
					</summary>
					<Form
						className="grid items-end gap-4 grid-cols-[1fr_auto] w-full pt-4"
						method="post"
					>
						<div className="space-y-2">
							<Label htmlFor="room">ルーム名</Label>
							<Input name="room" id="room" required />
						</div>
						<Button className="text-xs" type="submit" displayType="secondary">
							参加
						</Button>
					</Form>
				</details>
			</div>
			<div className="flex flex-col justify-end flex-1">
				<Disclaimer className="pt-6" />
			</div>
		</div>
	)
}
