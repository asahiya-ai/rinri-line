# コケコッコーリンちゃんアプリ 作業メモ

## アプリ概要
倫理法人会モーニングセミナーの内容をClaude AIで要約して
LINEに自動投稿するアプリ「コケコッコーのリンちゃん」

## ファイル構成
- index.html：フロントエンド（会場選択・講話者入力・要約・保存）
- gas/code.gs：GASバックエンド（要約・保存・LINE送信・Webhook）
- images/flyer.png：LINE投稿用モーニングセミナーフライヤー画像

## 重要なURL
- GitHubリポジトリ：https://github.com/asahiya-ai/rinri-line
- 画像URL：https://asahiya-ai.com/rinri-line/images/flyer.png
- スプレッドシートID：1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w
- GASデプロイURL：https://script.google.com/macros/s/AKfycbxwR2xQUquQhWhfKtHIOS3SxOiIkK-NJDewwS356ODyS1NGR7an80am8mArJv0viv0o/exec

## GASスクリプトプロパティ
| キー | 内容 |
|------|------|
| CLAUDE_API_KEY | Claude APIキー |
| LINE_TOKEN_佐世保 | 佐世保LINEトークン |
| LINE_GROUP_ID_テスト | テスト用グループLINEのID |
| LINE_GROUP_ID_佐世保 | 本番佐世保グループLINEのID（本番運用時に追加） |
| LINE_TOKEN_○○ | 他会場追加時はこの形式で追加 |

## スプレッドシート構成
- タブ名 = 会場名（例：佐世保、伊万里有田）
- 列構成：参加日／会場／参加者数／講話者／LINEテキスト／メモ／投稿済み／記録日時
- 新会場を選んで保存すると自動でタブが作成される
- 「グループID記録」タブ：Webhookで受信したグループIDを自動記録

## LINE送信方式
- **push送信（グループ指定）**：グループLINEに直接投稿
- broadcast（全友だち一斉）は廃止済み
- 送信先グループIDはスクリプトプロパティで管理

## LINE自動送信の仕組み
- 毎週木曜9時に sendWeeklyLine が自動実行
- 現在の自動送信対象：佐世保のみ（LINE_SEND_VENUES で管理）
- 未投稿（FALSE）の中で最新の行を送信
- 送信後に投稿済みフラグが TRUE になる
- 送信内容：テキスト → フライヤー画像の順

## LINEグループIDの取得方法
1. LINE Developersコンソールでグループ参加を許可
2. GASにWebhookエンドポイント（doPost）を設定
3. WebhookURLをLINE Developersに登録・ONにする
4. リンちゃんをグループに招待
5. グループ内で誰かがメッセージを送信
6. スプレッドシートの「グループID記録」タブにIDが自動記録される

## 会場を追加するときの手順
1. index.html の select タグに option を追加
2. GASスクリプトプロパティに LINE_TOKEN_○○ を追加
3. グループIDを取得して LINE_GROUP_ID_○○ を追加
4. 自動送信したい場合は gas/code.gs の LINE_SEND_VENUES に会場名を追加
5. GASを再デプロイ

## テスト方法
- GASエディタで testSendLatest を実行
- 佐世保タブの未投稿データをテストグループに送信（投稿済みフラグは変わらない）
- 何度でも実行できる

## GAS関数一覧
| 関数名 | 役割 |
|--------|------|
| doPost | フロントからのリクエスト受付 ＋ LINEのWebhook受信（統合） |
| handleLineWebhook | グループIDをスプレッドシートに記録 |
| handleSummarize | Claude APIで要約生成 |
| handleSave | スプレッドシートに保存（会場タブ自動作成） |
| sendWeeklyLine | 全対象会場のLINE自動送信 |
| sendLineForVenue | 会場ごとのLINE送信処理（push送信） |
| testLineSend | テキストのみのテスト送信 |
| testSendLatest | 佐世保の最新データをテストグループに送信（フラグ変更なし） |
| setWeeklyTrigger | 木曜9時タイマーの設定 |

## 本番運用に向けて残っている作業
- [ ] 本番グループ（佐世保倫理法人会）にリンちゃんを招待
- [ ] グループIDを取得して LINE_GROUP_ID_佐世保 に登録
- [ ] sendLineForVenue の送信先を本番グループIDに変更確認
- [ ] GitHubにcode.gsの最新版をpush

## 更新履歴
- 2026/04/24：初版作成・基本機能完成
- 2026/04/24：フライヤー画像のLINE投稿機能追加
- 2026/04/27：会場選択機能追加・会場ごとのシートタブ自動作成
- 2026/04/27：LINE_TOKEN を LINE_TOKEN_佐世保 に変更（多拠点対応）
- 2026/04/27：テキスト→画像の順に変更
- 2026/04/27：broadcast → push送信（グループ指定）に変更
- 2026/04/27：LINEグループWebhook機能追加・グループID取得完了
- 2026/04/27：テストグループへの送信確認済み