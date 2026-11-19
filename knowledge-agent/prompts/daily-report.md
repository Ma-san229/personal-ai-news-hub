# 日次レポート（daily-report）— AI＋エンジニア

## 目的
今日集めた投稿・バズ候補から、**AIニュース**と**エンジニア向け技術ニュース**の上位項目を選び、中学生でも読める日本語の一目HTML用データにする。

## 文体
- 短い文。専門語は初出で括弧補足（例：LLM（大規模言語モデル））
- 煽らない。わからないことは「未確認」と書く

## 入力
- D1 から直近収集分（または fixtures）の posts / buzz_scores
- 日付（JST の `YYYY-MM-DD`）

## 出力（JSON・schemas/daily-report.schema.json に適合）
```json
{
  "date": "YYYY-MM-DD",
  "timezone": "Asia/Tokyo",
  "title": "MameTech 日次｜YYYY-MM-DD",
  "sections": [
    {
      "id": "ai",
      "label": "AIニュース",
      "items": [
        {
          "headline": "短い見出し",
          "facts": [
            { "text": "検証可能な事実", "source_url": "https://...", "source_date": "YYYY-MM-DD" }
          ],
          "implications": [
            { "text": "自分ごとへの示唆", "confidence": "hypothesis" }
          ],
          "why_it_matters": "一言でなぜ今日読むか"
        }
      ]
    },
    {
      "id": "engineering",
      "label": "エンジニア向け",
      "items": []
    }
  ],
  "skipped": []
}
```

## ルール
- `facts` と `implications` を混ぜない。示唆は必ず `confidence: "hypothesis"` か `"likely"`
- 各セクション 2〜5 件。無理に埋めない（足りなければ `skipped` に理由）
- 出典URLが無い事実は作らない

## 失敗時
スキーマ検証エラーを末尾に追記して **1回だけ** 再生成する。
