# 参照サイト・初期フィード調査メモ

## AI BASE

- 参照URL: https://aibase.yamanashi.dev/index.html
- 「AI関連のニュースや情報を共有し、月次で振り返る」コミュニティサイトとして、月別サマリーの一覧を掲載している。
- 画面構成は、明るい背景、余白を大きく取ったカード、控えめなアクセントカラー、月別の情報アーカイブを中心とする。
- 本プロジェクトでは、この情報の見通しの良さを参照しつつ、記事検索・フィルタ・既読管理を備えた個人用ダッシュボードに発展させる。

## ponkou.dev

- 2026-08-20時点で https://ponkou.dev は名前解決できず、RSS公開URLを自動検出できなかった。
- フィード管理画面では任意のRSS URLを登録できるようにし、正しい公開URLが判明後に初期ソースとして追加できる設計とする。

## ponkotsu.dev

- 正式URL: https://www.ponkotsu.dev/
- サイト名は「Engineer's Digest - 忙しいエンジニアのための技術情報ダイジェスト」。日付単位のダイジェスト記事と、AI・Claude Code・LLM・セキュリティなどのカテゴリを公開している。
- はてなブログの公開サイトであり、HTMLの自動検出リンクからAtomフィード `https://www.ponkotsu.dev/feed` とRSS 2.0フィード `https://www.ponkotsu.dev/rss` を確認した。
- Atomフィードは取得でき、サイトの最新ダイジェスト記事を返すことを確認済み。アプリの初期フィードにはAtom URLを「エンジニア向け」として有効化する。

## AI整体師

- 公開チャンネル: https://www.youtube.com/channel/UCVAkt5l6kD4igMdVoEGTGIg
- チャンネルでは「AIニュース」シリーズを継続的に公開しており、生成AIを整体院の仕事に活用する文脈の情報源として扱える。
- 初期フィードには、このチャンネルIDを用いたYouTube公式の動画フィード `https://www.youtube.com/feeds/videos.xml?channel_id=UCVAkt5l6kD4igMdVoEGTGIg` を「AI整体師向け」カテゴリで登録する。

## research_info（AI Researcher）

- 参照URL: https://github.com/beniyasan/research_info
- Python + Docker で毎朝実行するAI記事の収集・レポート生成ツール。Gemini（Vertex AI）が採用記事を選び、Web検索で裏取りし、日次・週次・月次のMarkdownレポートを作る。Google Drive同期とDiscord通知、Discordでの記事評価（刺さる／追う／既知／弱い／方向違い）による選定の補正を備える。
- 本プロジェクトとの違い: 本プロジェクトは選定をせず、収集した記事を静的サイトで検索・既読管理する。research_info は選定とレポート化が中心で、実行にDockerとGoogle Cloudの設定が必要。
- 取り込み: `config/sources.json` のRSS / Atom 25本を2026-10-26に取得確認し、Speaker Deck 4本を除く21本を `pages/data/feeds.json` へ登録した（有効11本、停止中10本）。VentureBeat AI は取得時に HTTP 429 が返ったため停止中とした。Qiita API・Hacker News・HTMLのみの配信元（Anthropic、Meta AI、Mistral、LlamaIndex、The Batch）はRSS / Atomではないため、取り込まなかった。Speaker Deck 4本は記事ではなくスライドのため対象外とした。
