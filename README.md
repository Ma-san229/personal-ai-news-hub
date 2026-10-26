# Personal AI News Hub（Signal Shelf）

AI整体師向け・エンジニア向けのニュースを、RSS / Atomから定期収集して一覧する個人用ニュースポータルです。公開サイトは GitHub Pages 上の静的ページで、DBもサーバーも使いません。

公開URL: https://ma-san229.github.io/personal-ai-news-hub/

## 仕組み

GitHub Actions（`Collect RSS News`）が6時間ごとに `scripts/collect-static-news.mjs` を実行し、`pages/data/feeds.json` に登録された有効なフィードを取得して `pages/data/news.json` を更新し、コミットします。そのコミットを受けて `Deploy GitHub Pages` が `pages/` を公開します。記事はURLのハッシュで重複排除され、新しい順に最大500件を保持します。1フィードあたりの取り込みは最新30件までです（フィードごとに `maxItems` で変更できます）。

```
feeds.json ──▶ collect-static-news.mjs ──▶ news.json ──▶ pages/（静的サイト）
   （GitHub Actions 6時間ごと）                         （GitHub Pages）
```

## 情報源

登録は `pages/data/feeds.json` で管理します。カテゴリは画面のタブに対応する `ai_seitaishi`（AI整体師向け）と `engineer`（エンジニア向け）の2種類です。

| 区分 | 内容 |
| --- | --- |
| 有効 | Engineer's Digest、Zenn（AI / LLM / Claude Code）、OpenAI News、Google AI Blog、Google DeepMind Blog、Hugging Face Blog、GitHub Blog AI/ML、AWS Machine Learning Blog、LangChain Blog、Import AI |
| 停止中（候補） | Microsoft AI、Microsoft Research、Meta Engineering、NVIDIA 2本、TechCrunch AI、MIT Technology Review AI、arXiv cs.AI / cs.CL、VentureBeat AI |
| 停止中（URL未確認） | AI整体師（正式なRSS / Atom URLが判明後に登録する） |

arXiv は日あたりの件数が多く個人用の一覧が埋まるため、VentureBeat は取得時に HTTP 429 が返ったため、停止中にしています（2026-10-26 時点）。追加・変更の手順は [GITHUB_PAGES.md](GITHUB_PAGES.md) を参照してください。

## 関連リポジトリ

[beniyasan/research_info](https://github.com/beniyasan/research_info)（AI Researcher）は、同じ「AI情報の個人向け収集」を別の方法で行う姉妹プロジェクトです。Python + Docker で毎朝実行し、Gemini が採用記事を選んでレポート化し、Discordの評価で選定を改善します。この hub は「選ばずに並べて検索・既読管理する」軽量な静的サイトで、役割が異なります。hub の初期情報源のうち、RSS / Atom として取得できる公式ブログ・開発者向け・日本語技術メディアは、research_info の `config/sources.json` を出典として取り込みました。Qiita API、Hacker News、HTMLのみで配信される Anthropic / Meta AI / Mistral / LlamaIndex は RSS ではないため対象外です。

## ディレクトリ構成

| パス | 内容 |
| --- | --- |
| `pages/` | 公開する静的サイト（`index.html`、`app.js`、`styles.css`、`data/`、`daily/`） |
| `pages/data/feeds.json` | 情報源の登録と直近の取得状態 |
| `pages/data/news.json` | 収集済み記事（Actionsが自動更新） |
| `scripts/collect-static-news.mjs` | RSS / Atom 収集スクリプト |
| `.github/workflows/` | `ci.yml`（型検査・テスト・ビルド）、`collect-news.yml`（収集）、`deploy-pages.yml`（公開） |
| `client/`、`server/`、`shared/`、`drizzle/` | DBを使う動的版アプリ。公開サイトでは使っておらず、手順は [OPERATIONS.md](OPERATIONS.md) |

## 手元で試す

```bash
pnpm install
node scripts/collect-static-news.mjs   # feeds.json と news.json を更新
pnpm check && pnpm test                # 型検査とユニットテスト
```

## ドキュメント

[GITHUB_PAGES.md](GITHUB_PAGES.md) は公開版の運用、[OPERATIONS.md](OPERATIONS.md) は動的版の運用、[research-notes.md](research-notes.md) は情報源の調査メモ、[todo.md](todo.md) は残作業です。
