# 統合の方針と実施手順

決定日: 2026-11-19（Ma-sanが「hub維持・mametech取り込み」を選択）

## 実施済み（本PR）

1. 設計書3本を `docs/knowledge-agent/` に置いた。
2. mametech-news の `prompts/` 4本と `schemas/` 2本を `knowledge-agent/` に取り込んだ。

## 承認待ち（まだ実施していない）

| 操作 | 内容 | 条件 |
|---|---|---|
| mametech-news のPR 2を閉じる | 骨格は本PRに取り込み済みのため。マージしない方針は元のまま | Ma-sanの承認 |
| mametech-news のアーカイブ化 | GitHubのArchive設定。履歴は残り、いつでも戻せる | 上の後、Ma-sanの承認 |
| Manome_Brain への書き出し | 採用記事を `060-resources` に置く仕組み。外へ出る変更のためPRで別途 | 段階6の設計後 |

## 触らないもの

- リポジトリ名と公開URL（`https://ma-san229.github.io/personal-ai-news-hub/`）
- 動いている `collect-news.yml` / `deploy-pages.yml` / `ci.yml`
- personal-skills-mcp、manome-dev

## 取り込み資産の使いどころ

| 資産 | 使う段階 |
|---|---|
| `daily-report.md` と schema（事実と示唆を分ける） | 日次レポートの選定・要約の出力契約。現行の要約とJSON形が近く、検証を足す時に使う |
| `weekly-summary.md` と schema | 段階3の週次まとめ |
| `morning-collect.md` / `daily-buzz.md` | X収集を足す段階5。現状は未使用 |
