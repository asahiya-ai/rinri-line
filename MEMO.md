# コケコッコーリンちゃんアプリ 作業メモ

## アプリ概要
倫理法人会モーニングセミナーの内容をClaude AIで要約して
LINEに自動投稿するアプリ

## ファイル構成
- index.html：フロントエンド（会場選択・講話者入力・要約・保存）
- gas.js：GASバックエンド（要約・保存・LINE送信）
- images/flyer.png：LINE投稿用モーニングセミナーフライヤー画像

## 重要なURL
- GitHubリポジトリ：https://github.com/asahiya-ai/rinri-line
- 画像URL：https://asahiya-ai.com/rinri-line/images/flyer.png
- スプレッドシートID：1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w

## GASスクリプトプロパティ
| キー | 内容 |
|------|------|
| CLAUDE_API_KEY | Claude APIキー |
| LINE_TOKEN_佐世保 | 佐世保LINEトークン |
| LINE_TOKEN_○○ | 他会場追加時はこの形式で追加 |

## スプレッドシート構成
- タブ名 = 会場名（例：佐世保、伊万里有田）
- 列構成：参加日／会場／参加者数／講話者／LINEテキスト／メモ／投稿済み／記録日時
- 新会場を選んで保存すると自動でタブが作成される

## LINE自動送信の仕組み
- 毎週木曜9時に sendWeeklyLine が自動実行
- 現在の自動送信対象：佐世保のみ（LINE_SEND_VENUES で管理）
- 未投稿（FALSE）の中で最新の行を送信
- 送信後に投稿済みフラグが TRUE になる
- 送信内容：テキスト → フライヤー画像の順

## 会場を追加するときの手順
1. index.html の select タグに option を追加
2. GASスクリプトプロパティに LINE_TOKEN_○○ を追加
3. 自動送信したい場合は gas.js の LINE_SEND_VENUES に会場名を追加
4. GASを再デプロイ

## テスト方法
- GASエディタで testSendLatest を実行
- 佐世保タブの未投稿データをLINE送信（投稿済みフラグは変わらない）
- 何度でも実行できる

## GAS関数一覧
| 関数名 | 役割 |
|--------|------|
| doPost | フロントからのリクエスト受付 |
| handleSummarize | Claude APIで要約生成 |
| handleSave | スプレッドシートに保存（会場タブ自動作成） |
| sendWeeklyLine | 全対象会場のLINE自動送信 |
| sendLineForVenue | 会場ごとのLINE送信処理 |
| testSendLatest | テスト送信（フラグ変更なし） |
| setWeeklyTrigger | 木曜9時タイマーの設定 |

## 更新履歴
- 2026/04/24：初版作成・基本機能完成
- 2026/04/24：フライヤー画像のLINE投稿機能追加
- 2026/04/27：会場選択機能追加・会場ごとのシートタブ自動作成
- 2026/04/27：LINE_TOKEN を LINE_TOKEN_佐世保 に変更（多拠点対応）
- 2026/04/27：テキスト→画像の順に変更
