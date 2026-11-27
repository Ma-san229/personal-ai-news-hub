# 日次バズ（daily-buzz）

## 目的
当日の posts に engagement スコアを付け、翌日の日次レポートの種にする。

## スコア（例）
`score = likes + 2*reposts + 0.5*replies + 0.01*views`（欠損は0）

## 出力
- `post_external_id`, `score`, `rank`, `scored_on`（JST日付）
- 上位 N（既定30）を D1 `buzz_scores` に書く
