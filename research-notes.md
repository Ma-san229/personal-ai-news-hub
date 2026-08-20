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
