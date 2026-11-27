# 知識収集エージェント 構成図と目標アーキテクチャ（案）

作成日: 2026-11-19 / 状態: 案（実装前）

## 1. 結論

Ma-sanの環境（GitHub Actions、GitHub Pages、personal-ai-news-hub、OpenRouter要約、PR 4の点数付け）だけで、参考2件と同じ「集める→選ぶ→要約→配る→反応で育てる」の輪を作れます。専用サーバーは不要です。足りないのは、配る先（Discord）と、反応を受け取る口だけです。この2つは外部接続担当に頼み、GitHub側はこのスレッドが作ります。

## 2. 参考にした記事と、確認できたこと

「91日（9.1年）で知識収集エージェントを作った」という記事は、検索では見つかりませんでした。本文に「91日」「9.1年」の表現があるものも、確認した範囲にはありません（未確認）。確認できた系譜は次の3段です。

| 順 | 資料 | 確認できた内容 |
|---|---|---|
| 1 | [1年間の育休に備えて「勝手に賢くなる」AI情報収集基盤を作った](https://zenn.dev/tokium_dev/articles/20260427_ai_tech_researcher)（TOKIUM、筆者sk） | cron、`claude -p`とSkills、SQLiteでソース管理、WebとSlackを並列収集、日次・週次・月次レポート、PDFをGoogle Driveへ同期。キーワードやチャンネルを、レポートに採用されたかで昇格・降格する。運用は約3週間時点 |
| 2 | [公開情報だけでAIニュース収集とレポート作成を自動化した](https://zenn.dev/njomote/articles/737c279d7f1c19)（jomo、2026-06-08） | 1を参考に、Slackを外して公開情報だけにした版。Docker＋supercronic、規則による点数付け→Gemini 3.5 Flashで選定、Search Groundingで検証、新ソース発見、Discord通知、Drive同期 |
| 3 | [research_info](https://github.com/beniyasan/research_info) | 2に近い構成の実装。SQLite、Discordボットのフィードバック（刺さる／追う／既知／弱い／方向違い）、20件を超えると効き、1記事あたり±0.7まで補正。ライセンス表示は確認できず、コードは流用しない |

2と3が同じ作者・同じ実装かは確認できていません（推測です。構成が一致しているため）。

## 3. 参考構成の図（共通する骨格）

```
        ┌─────────────── 定期実行（cron / supercronic）───────────────┐
        │                                                              │
  収集 ─┴→ 点数付け ─→ LLMで選定 ─→ 要約・検証 ─→ レポート保存 ─→ 配る
 (RSS等)   (規則)      (Gemini等)   (日本語化)    (Markdown)     (Drive/Discord)
   ▲                                                               │
   │                                                               ▼
   └────── 昇格・降格 ◀────── 採用履歴DB ◀────── 読者の反応（刺さる／既知…）
          （キーワード・ソース）   (SQLite)
```

## 4. Ma-sanの環境での目標アーキテクチャ

常時動くサーバーを持たず、実行をGitHub Actions一本にします（OPERATIONS.mdの「定期取得の実行場所は一方に統一」に合わせます）。データはDBではなくリポジトリ内のJSONに置きます。

```
┌────────────────────────── GitHub（ここまで＝このスレッド）──────────────────────────┐
│  Actions: collect-news（6時間ごと・既存）                                              │
│   ① 収集   collect-static-news.mjs      → pages/data/news.json                        │
│   ② 点数   scoring.mjs（PR 4）           → 日次の候補                                  │
│   ③ 選定   build-daily-report.mjs        → pages/daily/日付.json                       │
│   ④ 要約   summarize-daily.mjs（OpenRouter、鍵なしなら飛ばす）                         │
│   ⑤ 配達票 notify-build.mjs（新規）      → pages/data/notify-outbox.json               │
│  Actions: notify-discord（新規・承認制）   outbox を読んで Discordへ送る                │
│  Actions: fetch-feedback（新規・1日数回）  Discordの反応を読んで                        │
│            → pages/data/feedback.jsonl → adoption.json を再計算 → 点数へ反映（PR 4）    │
│  Actions: discover-sources（新規・週1・最後）新ソース候補を candidate で登録            │
│  GitHub Pages: 日次レポート・記事一覧（既存）                                           │
└──────────┬──────────────────────────────────────────────────▲────────────────────────┘
           │ ⑥ 送信（Secrets: Webhook）                         │ ⑦ 反応の読み取り（Secrets: Botトークン）
           ▼                                                   │
┌────────────────── Discord（ここから＝外部接続担当）─────────────────┐
│ #news-daily チャンネル：記事カード（題名・要約・リンク）            │
│ 反応の絵文字: 👍刺さる 👀追う ✅既知 👎弱い ❌方向違い              │
└──────────────────────────────────────────────────────────────────┘
```

Discordの反応は、Botが常駐して受けるのではなく、Actionsが定期的に読みに行きます。常駐サーバーも公開エンドポイントも要りません。代わりに反応の反映は最大で数時間遅れます（個人用なら許容できる、という判断。推測です）。ボタンUIが必要になったら、別途Cloudflare Workersなどの受け口を足します。

## 5. 参考構成とのちがい

| 要素 | 参考 | Ma-sanの案 | 理由 |
|---|---|---|---|
| 実行 | Docker＋cron | GitHub Actions | 常駐不要、既存の6時間収集に乗る |
| 保存 | SQLite | JSON/JSONL（pages/data） | 既存構成と同じ、差分がgitで見える |
| 選定LLM | Gemini 3.5 Flash | まず規則の点数（PR 4）、次にOpenRouterの無料枠モデル | 費用を抑える。モデル名の有効性は未確認 |
| 検証 | Gemini Search Grounding | 初期は入れない | OpenRouterでは同等の検索検証が使えない可能性が高い（推測です） |
| 反応 | Discordボット | 絵文字反応をActionsが読む | サーバー不要 |
| 配信 | Drive同期、Discord | Pages＋Discord | Driveは任意の後段階 |
| 新ソース発見 | Gemini Search | 最後の段階 | 先に点数と反応の輪を回す |

## 6. 段階的な進め方

| 段階 | 内容 | 担当 | 前提 |
|---|---|---|---|
| 0 | PR 4（点数付け・採用履歴）をレビューしてマージ | Ma-san | なし |
| 1 | 配達票の生成と、Discordへ日次1通の送信（鍵なしなら何もしない） | GitHub=このスレッド、Discord準備=外部接続担当 | 段階0、DiscordのWebhook |
| 2 | 記事ごとのカード投稿と、反応の読み取り→feedback.jsonl→採用履歴 | 両方 | Botトークン、チャンネルID |
| 3 | 週次・月次レポート（`knowledge-agent/` の週次プロンプトを使う）、反応が20件を超えたら点数補正（±0.7上限） | このスレッド | 反応データの蓄積 |
| 4 | 新ソース候補の発見（週1、candidate止まりで人が昇格） | このスレッド | 段階3 |
| 5 | 任意: X収集（mametech-news由来、D1が前提）、ボタンUI、Drive同期 | 別途設計 | 必要になったら |
| 6 | 採用した知識をManome_Brainの060-resourcesへ書き出す（設計のみ） | このスレッド | 承認 |

## 7. 担当の分け方（インターフェース契約）

両者は、リポジトリ内のファイルと、GitHubのSecrets名だけで接続します。Secretsの値はチャットに貼らず、Ma-sanがGitHubの設定画面で直接登録します。

| もの | 場所・名前 | 作る側 | 使う側 |
|---|---|---|---|
| 送信待ちの記事 | `pages/data/notify-outbox.json` | このスレッド | 送信Actions |
| 読み取った反応 | `pages/data/feedback.jsonl`（1行1イベント） | このスレッド（読取Actions） | 点数計算 |
| Discord設定（非機密） | `config/discord.json`（チャンネル名、絵文字対応表） | このスレッド | 外部接続担当が値を確認 |
| Webhook | Secret `DISCORD_WEBHOOK_URL` | 外部接続担当が作成 | Ma-sanが登録 |
| Botトークン | Secret `DISCORD_BOT_TOKEN` | 外部接続担当が作成 | Ma-sanが登録 |
| チャンネルID | Variable `DISCORD_CHANNEL_ID` | 外部接続担当 | Ma-sanが登録 |

## 8. リスクと未確認

- 点数付けPR 4はまだマージされていません。段階1以降はこれに依存します。
- GitHub Actionsのスケジュールは遅延することがあります。反応の反映は即時ではありません。
- 記事の題名と抜粋はOpenRouter経由でモデルに渡ります。外部の文章を指示として扱わない指示はありますが、完全な防止ではありません。
- 記事本文や反応の内容はDiscordに出ます。サーバーは本人専用の非公開にしてください。
- OpenRouterの無料モデルの可用性・制限は未確認です。
- Discord APIの仕様（反応の取得方法、必要な権限）は、実装時に公式ドキュメントで確認します。未確認です。
