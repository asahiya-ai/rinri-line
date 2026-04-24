# rinri-line 操作手順書 🐔

## プロジェクト概要
倫理法人会モーニングセミナーの講話をClaude AIで要約→LINEグループに毎週木曜9時に自動投稿するアプリ

---

## ファイル構成

```
rinri-line/
├── index.html       ← Webアプリ本体（ブラウザで開いて使う）
├── gas/
│   └── code.gs      ← GASバックエンド（コピー用）
├── images/          ← スクリーンショットなど
├── .gitignore
└── HOWTO.md         ← この手順書
```

---

## 毎週の使い方

1. `index.html` をブラウザで開く
2. セミナー情報・講話者・文字起こしを入力
3. 「🐔 要約する」ボタンをクリック
4. プレビューを確認・編集
5. 「✅ 保存する」でスプレッドシートに記録
6. 木曜9時に自動投稿される（setWeeklyTrigger設定済みの場合）

---

## GASを更新したいとき

### ① GASエディタを開く
→ https://script.google.com でプロジェクトを開く

### ② code.gs を編集して保存（Ctrl+S）

### ③ デプロイを更新
1. 右上「デプロイ」→「デプロイを管理」
2. 鉛筆マーク（✏️）をクリック
3. バージョンを「新しいバージョン」に変更
4. 「デプロイ」を押す

### ④ ローカルの gas/code.gs にも同じ変更を反映してGitHubにプッシュ

---

## GitHubにプッシュするとき

```bash
cd C:\Users\USER\Desktop\asahiya\app\rinri-line
git add .
git commit -m "変更内容を一言で（例：プロンプト改善）"
git push
```

---

## スクリプトプロパティの確認・変更

APIキーやLINEトークンはGASの「金庫」に保存されています。

1. GASエディタ左側の歯車マーク（⚙️）→「プロジェクトの設定」
2. 「スクリプトプロパティ」を開く
3. 以下の2つが登録されているか確認：

| プロパティ名 | 内容 |
|---|---|
| `CLAUDE_API_KEY` | Anthropic APIキー（sk-ant-...） |
| `LINE_TOKEN` | LINE Channel Access Token |

---

## 木曜9時の自動投稿タイマーを設定するとき

GASエディタで以下を実行（一度だけでOK）：

1. 関数のドロップダウンで「`setWeeklyTrigger`」を選択
2. 「▶ 実行」ボタンをクリック
3. 「✅ 毎週木曜9時のタイマーを設定しました」がログに出れば成功

---

## APIキーを変更したいとき

1. https://console.anthropic.com でキーを発行
2. GASのスクリプトプロパティ → `CLAUDE_API_KEY` を更新
3. code.gs 本体は変更不要

---

## LINEトークンを変更したいとき

1. https://developers.line.biz でチャンネルを開く
2. 「Channel access token」を発行
3. GASのスクリプトプロパティ → `LINE_TOKEN` を更新

---

## 重要URL

| 名前 | URL |
|---|---|
| GASエディタ | https://script.google.com |
| GitHubリポジトリ | https://github.com/asahiya-ai/rinri-line |
| スプレッドシート | https://docs.google.com/spreadsheets/d/1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w |
| Anthropic Console | https://console.anthropic.com |
| LINE Developers | https://developers.line.biz |
