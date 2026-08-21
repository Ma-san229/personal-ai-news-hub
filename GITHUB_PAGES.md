# GitHub Pages版の運用

GitHub Pages版は、DBを使わない静的ニュースポータルです。GitHub ActionsがRSS / Atomを6時間ごとに取得し、`pages/data/news.json` と `pages/data/feeds.json` を更新してコミットします。そのコミットを契機に、別のGitHub Actionsが `pages/` をGitHub Pagesへ公開します。

## 公開URL

公開サイトは [https://ma-san229.github.io/personal-ai-news-hub/](https://ma-san229.github.io/personal-ai-news-hub/) です。2026年8月21日に、Engineer's Digest（ponkotsu.dev）のAtomフィードから31件の記事が表示されることを確認しました。

## 情報源を追加・変更する

`pages/data/feeds.json` の `feeds` 配列に、`id`、`name`、`url`、`category`、`enabled` を登録します。カテゴリ値は `ai_seitaishi` または `engineer` のいずれかです。URL確認前の情報源は、`enabled` を `false` に設定してください。

| 項目 | 内容 |
| --- | --- |
| `url` | RSSまたはAtomの公開URL |
| `category` | `ai_seitaishi` または `engineer` |
| `enabled` | `true` のフィードだけを定期取得 |
| `lastStatus` | 直近のActions実行で更新される取得状態 |

## 手動実行

GitHubの **Actions** タブから **Collect RSS News** を選び、**Run workflow** を実行すると即時に記事を更新できます。更新後のコミットにより、GitHub Pagesも自動公開されます。

> GitHub Actionsのスケジュール実行はGitHub側で遅延する場合があります。更新を急ぐ場合は手動実行を使用してください。
