# .design — マスカレード 画面リデザインの元ファイル

「夜の舞踏会」方向で全画面を引き直したデザインキャンバスの、素材となるファイルです。
キャンバス本体（`masquerade-redesign.html`）はここから毎回組み立て直すものなので、
リポジトリには入れていません。

## 中身

- `*.dc.html` — アートボード 1 枚 = 1 ファイル。中身は素の HTML とインラインスタイル。
- `canvas.json` — 盤面の配置、ページ分け、付箋、開いたときに表示する場所。
- `*.webp` — `public/characters/` の絵を 256px / banner を 760px に落としたもの。

## 組み立て直すとき

`.dc.html` を直してから、Claude Code の `/design` が持っているシーダーに
`--template` / `--out` / `--title` / `--artboard` / `--image` / `--canvas` を渡して
`masquerade-redesign.html` を作り直し、同じ Artifact に上書き保存します。

画像を差し替えるときは 70KB 以下に落としてから `--image` に渡してください
（保存のたびにキャンバス全体を送り直すため）。
