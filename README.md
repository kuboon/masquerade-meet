# 🎭 Masquerade Meet

キャラクターに変装して話す、正体あてミーティング。

Cloudflare の [Orange Meets](https://github.com/cloudflare/orange) をベースに、参加者ごとのボイスチェンジ機能を追加したものです。

- ルームに入った参加者は、あらかじめ用意された **15 種類のストックキャラクター** から 1 人を選びます（早い者勝ち、重複なし）
- **全員の準備が整うまで** ミーティングは始まりません。ルーム管理者が「ミーティング開始」を押すと、全員が同時に入室します
- ミーティング中は全員の **声色が選んだキャラクターの声に変わり**、カメラ映像の代わりに **キャラクターの絵** が表示されます。本名も表示されません
- ルーム管理者の指示で **5 秒のカウントダウン** ののち、ボイスチェンジが **一斉に解除** されます。同時に本名とカメラ映像が現れます

## しくみ

### ボイスチェンジ

`public/voice/voice-changer-worklet.js` の AudioWorklet が、マイクの音声をリアルタイムに変換します。

ピッチシフトは古典的な 2 タップ・ディレイライン方式です。リングバッファを 2 本の読み出しタップが追いかけ、その遅延量が `1 - pitchRatio` に比例して変化します。各タップはレイズドコサイン窓でクロスフェードされ、2 つの窓は半周期ずれているため常に合計がちょうど 1 になります。フォルマントもピッチと一緒に動くので、変装としてはむしろ好都合です。

その上に、キャラクターごとの個性としてビブラート LFO とリングモジュレーターを重ね、さらに main thread 側の 3 バンド EQ（`app/utils/voiceChanger.ts`）で音色を調整しています。

変換は **送信側のブラウザで** 行われるため、生の声は SFU にも他の参加者にも一切届きません。

パラメーターは `voiceParams$`（BehaviorSubject）経由で稼働中の AudioParam に流し込まれます。キャラクターの変更もマスクの解除も、トラックの再ネゴシエーションなしに音声グラフ上で完結します。

### 正体を隠す

本名はブラウザに送られません。Durable Object は `realName` を内部にだけ持ち、ブロードキャストする `name` にはキャラクター名を入れます。DevTools を覗いても正体は分かりません。

同じ理由で、`userUpdate` メッセージのうちクライアントが所有できるのはメディア状態（トラック、挙手、発話中）だけで、名前・キャラクター・準備状態・管理者権限はサーバー側が持ちます。

カメラは解除まで一度も配信されません（`getCamera({ broadcasting: false })`）。

### カウントダウンの同期

Durable Object は解除時刻 `revealAt` を自分の時計で決め、同じメッセージに `serverNow` を添えて配ります。各クライアントは差分 `revealAt - serverNow` だけを使って自分の時計上の期限を作るので、端末の時計がずれていてもカウントダウンはずれません。解除そのものはこの期限からのタイマーで発火するため、状態ブロードキャストが遅れても全員が同じ瞬間にマスクを外します。

### キャラクターの絵

`app/utils/characters.ts` にキャラクターの見た目と声のパラメーターが並んでいて、`app/components/CharacterAvatar.tsx` がそれをパラメトリックな SVG として描画します。画像ファイルを 15 個持たずに済み、タイル表示でも全画面でも輪郭が崩れません。

## セットアップ

[Cloudflare Realtime のダッシュボード](https://dash.cloudflare.com/?to=/:account/realtime)でアプリケーションを 1 つ作り、App ID と Secret を控えます。

```sh
npm install
cp .dev.vars.example .dev.vars   # 控えた 2 つの値を書き込む
```

`.dev.vars` はローカル開発とデプロイの両方で使う唯一の設定ファイルです（gitignore 済み）。

## 開発

```sh
npm run dev
```

[http://127.0.0.1:8787](http://127.0.0.1:8787) を開けば動きます。

チェック一式:

```sh
npm run check   # lint + typecheck + test
```

## デプロイ

```sh
npx wrangler login       # 初回だけ
npm run deploy           # ビルドしてデプロイ
npm run deploy:secrets   # 初回だけ。.dev.vars の値をシークレットとして投入
```

以降の更新は `npm run deploy` だけです。シークレットはデプロイでは消えないので、値を変えたときだけ `npm run deploy:secrets` を叩き直してください。

順番には理由があります。`wrangler secret bulk` は既存の Worker に対して実行するものなので、先に一度デプロイして Worker を作る必要があります。`.dev.vars` に書いた値はすべてシークレットとして送られるので、`OPENAI_API_TOKEN` などを足した場合もそのまま反映されます。

デプロイ先を確認するには:

```sh
npx wrangler deploy --dry-run   # 何も送らずにビルド内容だけ確認
npx wrangler tail               # 本番のログを流す
```

任意で [Cloudflare の TURN サービス](https://developers.cloudflare.com/calls/turn/)を使う場合は、`TURN_SERVICE_ID` と `TURN_SERVICE_TOKEN` を `.dev.vars` に足してから `npm run deploy:secrets` を実行してください。

### ワンクリックで試す

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kuboon/masquerade-meet)

このボタンは自分の GitHub アカウントにリポジトリを複製し、[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) で CI/CD（push ごとの自動デプロイと PR プレビュー URL）まで設定します。ただし Realtime の認証情報は自動では入らないので、デプロイ後に Worker の設定画面か `npm run deploy:secrets` で `CALLS_APP_ID` と `CALLS_APP_SECRET` を追加してください。

## 既知の制限

- 1 ルームの人数上限は実質 15 人です（キャラクターが 15 種類しかないため）。空きキャラクターがない状態で入室した参加者はキャラクターを選べません。
- 画面共有は変装中も使えますが、共有した画面の内容から正体が分かる可能性があります。
- ページをリロードしてもキャラクターと準備状態は保たれます（`sessionStorage` の接続 ID による）。ただし 15 秒以上切断していると席が回収され、別のキャラクターになります。
- 変装解除は不可逆です。もう一度隠れるにはルームを作り直してください。

## ライセンス

Apache License 2.0（[LICENSE](./LICENSE)）。

本プロジェクトは [cloudflare/orange](https://github.com/cloudflare/orange)（Apache License 2.0, Copyright (c) 2024 Cloudflare, Inc.）の派生物です。帰属表示は [NOTICE](./NOTICE) にまとめてあります。
