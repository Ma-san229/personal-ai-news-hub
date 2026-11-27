# 週次まとめ（weekly-summary）

## 目的
直近7日の日次レポートとバズ上位から、横断的な **Facts / Implications** を作る。

## 文体
日次と同じ（中学生でも分かる日本語）。ただし「今週の筋」が見える粒度。

## 出力（JSON・schemas/weekly-summary.schema.json に適合）
- `week_start` / `week_end`（JST）
- `themes[]`: テーマ見出し + facts[] + implications[]
- `top_sources[]`: 参照した主要URL
- `reading_time_minutes`: 目安

## 失敗時
スキーマ検証エラーを追記して **1回だけ** 再生成。
