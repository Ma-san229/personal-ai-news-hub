# GitHub Pages版の運用

GitHub Pages版は、DBを使わない静的ニュースポータルです。GitHub ActionsがRSS / Atomを6時間ごとに取得し、`pages/data/news.json` と `pages/data/feeds.json` を更新してコミットします。そのコミットを契機に、別のGitHub Actionsが `pages/` をGitHub Pagesへ公開します。

## 公開URL

公開サイトは [https://ma-san229.github.io/personal-ai-news-hub/](https://ma-san229.github.io/personal-ai-news-hub/) です。2026年8月21日に、Engineer's Digest（ponkotsu.dev）のAtomフィードから31件の記事が表示されることを確認しました。

## アーカイブとRSS

`collect-news.yml` は、収集のたびに `pages/archives/`（日付別の記事JSONと `index.json`）と `pages/rss.xml` も更新してコミットします。アーカイブはその日に初めて収集した記事（`collectedAt`）を日本時間の日付で振り分け、同じ日の複数回の収集は追記します。`news.json` は1200件を超えると古い順に消えますが、アーカイブには残ります。2026-10-26より前の記事には `collectedAt` がないため、アーカイブには含まれません。

## 情報源を追加・変更する

`pages/data/feeds.json` の `feeds` 配列に、`id`、`name`、`url`、`category`、`enabled` を登録します。カテゴリ値は `ai_seitaishi`、`engineer`、`event`、`book` のいずれかです（`event` と `book` は専用タブにだけ表示されます）。URL確認前の情報源は、`enabled` を `false` に設定してください。登録前に、手元で `node scripts/collect-static-news.mjs` を実行し、`lastStatus` が `success` になることを確認します。

| 項目 | 内容 |
| --- | --- |
| `url` | RSSまたはAtomの公開URL |
| `category` | `ai_seitaishi` または `engineer` |
| `enabled` | `true` のフィードだけを定期取得 |
| `maxItems` | 1回の取得で取り込む最新記事数の上限（任意。省略時は30件） |
| `lastStatus` | 直近のActions実行で更新される取得状態 |

## 手動実行

GitHubの **Actions** タブから **Collect RSS News** を選び、**Run workflow** を実行すると即時に記事を更新できます。更新後のコミットにより、GitHub Pagesも自動公開されます。

> GitHub Actionsのスケジュール実行はGitHub側で遅延する場合があります。更新を急ぐ場合は手動実行を使用してください。

## 情報源の選定

2026-10-26に、[beniyasan/research_info](https://github.com/beniyasan/research_info)（AI Researcher）の `config/sources.json` のうち、RSS / Atomで取得できる情報源を `feeds.json` へ取り込みました。取得確認ができ、個人用の一覧に適した量のものを有効にし、2026-10-26の追加指示で、候補もすべて有効にしました。件数が多い arXiv は `maxItems` を20にしています。VentureBeat は HTTP 429 で取得できていません。論文のトレンド用に Takara TLDR のフィードも追加しています。新しい `category` 値を足すには画面側（`pages/app.js` のカテゴリ表示とタブ）の変更が必要なため、取り込んだ情報源はすべて `engineer` にしています。
