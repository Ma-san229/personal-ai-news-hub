# 知識収集エージェント

このリポジトリ（personal-ai-news-hub）が、知識収集エージェントの本拠地です。2026-11-19 に、これまで別々だった次の資産を1つにまとめる方針が決まりました。

| 元 | 取り込み方 |
|---|---|
| 本リポジトリ（RSS収集・日次レポート・OpenRouter要約・GitHub Pages） | そのまま本体 |
| PR 4（点数付け・採用履歴） | マージ後に本体へ |
| mametech-news（prompts・schemas・事実/示唆の型） | `knowledge-agent/` に取り込み済み（本PR）。X収集とCloudflare D1は動いていないため、段階5の任意の収集元に回す |
| research_info | ライセンス表示が確認できないため、コードは使わない。考え方だけ参考にする |
| personal-skills-mcp | 統合しない（目的が別。スキルを配るMCP） |
| Manome_Brain | 採用した知識の書き出し先（段階6、設計のみ） |

## 文書

- [構成図と目標アーキテクチャ](20261119_knowledge-agent-architecture.md)
- [外部接続担当への指示書](20261119_handoff-external-connection.md)
- [統合の方針と実施手順](20261119_consolidation-plan.md)

## 取り込んだ資産

`knowledge-agent/prompts/` と `knowledge-agent/schemas/`。出どころは mametech-news の `feat/skeleton`（89c8a57）。同じ所有者の自作で、本文は変更していません。プロンプト本文の正本はここです。コードやActionsに埋めません。
