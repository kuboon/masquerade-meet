import { Input } from './Input'
import { Label } from './Label'

/**
 * Somewhere to paste a roster somebody else published.
 *
 * Folded away, because almost nobody arrives here meaning to use it: the
 * ordinary way in is a button on the other site, which lands on `/new` with
 * the address already attached and never shows this page at all. It is here
 * so that an author can try their own file before they publish it, and so
 * that a link handed round in chat can be pasted rather than retyped as a
 * URL by hand.
 *
 * The warning is not boilerplate. The artwork is fetched from that site by
 * every participant's browser, so whoever runs it learns that these people
 * are in a meeting together — which is a thing to know before choosing one.
 */
export function ExternalSetField() {
	return (
		<details className="text-sm">
			<summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">
				外部のキャラクターセットを使う
			</summary>
			<div className="space-y-1 pt-2">
				<Label htmlFor="set-url">キャラセットの URL</Label>
				<Input
					id="set-url"
					name="setUrl"
					type="url"
					inputMode="url"
					autoComplete="off"
					placeholder="https://example.com/masquerade.json"
				/>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">
					JSON ファイルか、それを埋め込んだページの URL
					を指定します（上の選択より優先されます）。
					キャラクターの絵は参照先のサイトから読み込まれるので、参加者がそのサイトにアクセスしたことが相手に伝わります。
					信頼できる配布元だけを指定してください。
				</p>
			</div>
		</details>
	)
}
