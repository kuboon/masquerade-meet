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

## 開発

```sh
npm install
npm run dev
```

[http://127.0.0.1:8787](http://127.0.0.1:8787) を開けば動きます。

Cloudflare Realtime のダッシュボードでアプリケーションを作成し、`.dev.vars` に以下を書いてください。

```
CALLS_APP_ID=<APP_ID_GOES_HERE>
CALLS_APP_SECRET=<SECRET_GOES_HERE>
```

チェック一式:

```sh
npm run check   # lint + typecheck + test
```

## デプロイ

1. `wrangler` にログインします。

```sh
wrangler login
```

2. `wrangler.toml` の `CALLS_APP_ID` を自分の Calls App ID に変更します。

3. シークレットを設定します。

```sh
echo REPLACE_WITH_YOUR_SECRET | wrangler secret put CALLS_APP_SECRET
```

4. 任意で [Cloudflare の TURN サービス](https://developers.cloudflare.com/calls/turn/)（`TURN_SERVICE_ID` / `TURN_SERVICE_TOKEN`）も設定できます。

5. デプロイします。

```sh
npm run deploy
```

## 既知の制限

- 1 ルームの人数上限は実質 15 人です（キャラクターが 15 種類しかないため）。空きキャラクターがない状態で入室した参加者はキャラクターを選べません。
- 画面共有は変装中も使えますが、共有した画面の内容から正体が分かる可能性があります。
- ページをリロードしてもキャラクターと準備状態は保たれます（`sessionStorage` の接続 ID による）。ただし 15 秒以上切断していると席が回収され、別のキャラクターになります。
- 変装解除は不可逆です。もう一度隠れるにはルームを作り直してください。

## ライセンス

このリポジトリのコードは MIT ライセンスです（[LICENSE](./LICENSE)）。

ただし本プロジェクトは [cloudflare/orange](https://github.com/cloudflare/orange)（Apache License 2.0, Copyright (c) 2024 Cloudflare, Inc.）の派生物であり、由来するコードには引き続き Apache License 2.0 が適用されます。原ライセンス全文は [LICENSE.orange](./LICENSE.orange) にあります。
