# 朝の収集（morning-collect）

## 目的
ウォッチリスト上の X（Twitter）投稿を取得し、D1 `posts` に upsert する材料を作る。

## 入力
- ウォッチリスト（D1 `watch_accounts`。個人アカウントは git に書かない）
- 取得窓：直近 24 時間（JST）

## 出力（JSON配列の各要素）
- `platform`: `"x"`
- `external_id`: 投稿ID
- `author_handle`: ハンドル（@なし可）
- `text`: 本文
- `url`: 投稿URL
- `posted_at`: ISO8601
- `metrics`: `{ likes, reposts, replies, views }`（取れる範囲）
- `tags`: 推定タグ（`ai` / `engineering` / `other`）

## 制約
- 要約や意見は書かない（収集のみ）
- 失敗したアカウントはスキップしてログに残す
