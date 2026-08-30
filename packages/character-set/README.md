# @kuboon/masquerade-character-set

[マスカレード](https://masq.kbn.one) のキャラクターセットを自分のサイトで配布するためのパッケージ。

キャラクターの一覧を JSON で公開し、`https://masq.kbn.one/new?set=<その URL>` にリンクを張れば、押した人のルームがあなたのキャラクターで開きます。masq 側への登録・申請はありません。

書式そのものの説明は [docs/character-sets.md](https://github.com/kuboon/masquerade-meet/blob/main/docs/character-sets.md) にあります。

## 入れる

```
deno add jsr:@kuboon/masquerade-character-set
npx jsr add @kuboon/masquerade-character-set     # npm / pnpm / yarn / bun
```

masq 本体もこのパッケージを同じ名前で読んでいます。ルームが走らせる検証コードと、会議が鳴らす音声グラフは、ここに入っているものそのものです。

## 型だけ使う

```ts
import type { CharacterSetDocument } from '@kuboon/masquerade-character-set'

const set: CharacterSetDocument = {
	name: 'サーカス団',
	tagline: '天幕の下に集まった、はぐれ者の一座',
	characters: [
		{
			id: 'lion',
			name: 'ライオン',
			emoji: '🦁',
			tagline: 'ごろごろ重低音',
			image: 'lion.png',
			voice: { size: -0.95, weight: -0.6, nasal: -0.05, roughness: 0.2 },
		},
	],
}
```

ルートの export は型だけです。実行時のコードは何も入っていないので、import してもバンドルは1バイトも増えません。

## 公開前に確かめる

**ルームがあなたのセットを使えなかったとき、リンクを踏んだ人には何も言いません。** 標準のキャラクターで開くだけです。だから確かめる場所はここしかありません。

```
deno run -A jsr:@kuboon/masquerade-character-set/cli ./set.json
deno run -A jsr:@kuboon/masquerade-character-set/cli https://example.com/set.json
```

https の URL を渡すと、ルームがやるのとまったく同じ手順で取りに行きます。ローカルのファイルを渡した場合は、画像が本当にそこにあるかどうかだけ確かめられません。

```
✓ サーカス団
  15人 = このセットで開いたルームの定員

  🦁 ライオン       -11.4半音 / かすれ 0.2
  🎩 だんちょう     -9.6半音
  🔥 火吹き男       -7.7半音 / かすれ 0.6
```

プログラムから呼ぶなら:

```ts
import { checkCharacterSet } from '@kuboon/masquerade-character-set/check'

const { set, problems } = checkCharacterSet(
	document,
	new URL('https://example.com/set.json')
)
if (!set) throw new Error(problems.join('\n'))
```

### いちばん引っかかるところ

**変装になっていない声のキャラクターが1体でもあると、セット全体が拒否されます。**

各キャラクターは次のどれかを満たす必要があります。

- `size` が ±0.17 以上（2半音以上）
- `throat` が ±0.25 以上
- `roughness` が 0.3 以上

`weight` と `nasal` をいくら振っても変装にはなりません。全部 0 のセットを配ると、参加者は変装しているつもりで地声を流すことになり、しかも本人はそれに気づけません。だから警告ではなく拒否です。

## 声を聴かせる

キャラクターの絵の横に再生ボタンを置いて、その声を聴かせられます。**ルームで走るのとまったく同じグラフ**（同じピッチシフタ、同じフィルタ、同じ数値）なので、ここで聴こえたものがそのまま会議で聴こえます。

```ts
import {
	createVoicePreview,
	recordVoice,
} from '@kuboon/masquerade-character-set/preview'

// クリックの中で作ること。ユーザー操作の外で作った AudioContext は
// suspended で返ってきます。
playButton.onclick = async () => {
	const preview = await createVoicePreview()
	await preview.load(await (await fetch('sample.mp3')).arrayBuffer())
	await preview.play(lion.voice)
}
```

再生中に別の声で `play()` を呼ぶと、鳴らし直さずに切り替わります。

自分の声で聴かせたいなら:

```ts
await preview.load(await recordVoice(5))
```

録音した音のループ再生なので、スピーカーから出してもハウリングしません。録音はページの外に出ません。

ピッチシフタ（[Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch)、MIT、110 kB の WASM）は最初に再生したときだけ masq のオリジンから取りに行きます。プレビューを使わないページは1バイトも読みません。自分のところに置いたものを使うなら `stretchUrl` を渡してください。

## 声の5軸

0 が「変えない」、±1 が振り切りです。

|             | 範囲     | 意味                                                                         |
| ----------- | -------- | ---------------------------------------------------------------------------- |
| `size`      | −1 〜 +1 | 体の大きさ。±1 で1オクターブ。**変装を担うのはこれ**                         |
| `weight`    | −1 〜 +1 | 声の重心。−1 で暗く太く、+1 で細く明るく                                     |
| `nasal`     | −1 〜 +1 | −1 で箱の中、+1 で鼻にかかった声                                             |
| `roughness` | 0 〜 1   | しゃがれ具合。省略可                                                         |
| `throat`    | −1 〜 +1 | 声の高さに対する口の大きさのちぐはぐさ。人間には出せない声になります。省略可 |

`size` は声の高さと一緒にフォルマントも動かします（体ごと大きくなる）。`throat` はフォルマントだけを動かします。

半音に直したいときは `/voice` の `VOICE_RANGE` と `toEngineParams` を使ってください。

## キャラクターの id は変えないこと

ルームは id を保存します。**一度公開した id を変えると、動いているルームが壊れます。** 増やすのは安全です。

## 制限

|                    |                               |
| ------------------ | ----------------------------- |
| JSON / ページ全体  | 64 KB                         |
| 取得のタイムアウト | 5 秒                          |
| キャラクター数     | 2〜40（＝ルーム定員）         |
| 画像               | `https:` のみ。`data:` は不可 |

画像は参加者のブラウザがあなたのサイトから直接読み込みます。**あなたのサーバーには参加者のアクセスが残ります。**
