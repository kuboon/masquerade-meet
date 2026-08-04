import { Form, useNavigate } from '@remix-run/react'
import { nanoid } from 'nanoid'
import { Button } from '~/components/Button'
import { CharacterSetChooser } from '~/components/CharacterSetChooser'
import { Disclaimer } from '~/components/Disclaimer'
import { characterSets } from '~/utils/characterSets'

export default function Index() {
	const navigate = useNavigate()

	return (
		<div className="mx-auto flex min-h-full flex-col items-center justify-center p-4">
			<div className="flex-1"></div>
			<div className="max-w-prose space-y-6">
				<div className="space-y-3">
					<h1 className="text-3xl font-bold">🎭 マスカレード</h1>
					<p className="text-lg text-zinc-600 dark:text-zinc-300">
						誰が誰だかわからない オンライン仮面ミーティング
					</p>
					<ul className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
						<li>
							参加者はそれぞれキャラクターを選び、
							<strong className="font-semibold">
								声も見た目もそのキャラクターになった状態
							</strong>
							でミーティングを始めます。
						</li>
						<li>
							声はブラウザの中で変換されるので、生の声はサーバーにも他の参加者にも届きません。
							カメラも配信されず、名前もキャラクター名しか表示されません。
						</li>
						<li>最後は一斉にアンマスク。意外な一面にびっくりするかも？</li>
					</ul>
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
						ルームを作る
					</Button>
				</Form>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					作成すると URL
					が発行されます。それを共有すれば、受け取った人はそのまま参加できます。
				</p>
			</div>
			<div className="flex flex-1 flex-col justify-end">
				<Disclaimer className="pt-6" />
			</div>
		</div>
	)
}
