# セットアップ手順（バックエンド：Supabase）

コードは実装済みです。以下の作業（約15分・無料枠でOK）を行うと、
Googleログイン＋データのクラウド保存が有効になります。
**設定しない間は今までどおり localStorage モードで動きます。**

## 1. Supabase プロジェクトを作る

1. https://supabase.com で Sign up（GitHubアカウント可）
2. 「New project」でプロジェクト作成（リージョンは Tokyo 推奨）
3. 作成後、**Project Settings → API** を開き、次の2つを控える
   - Project URL（`https://xxxx.supabase.co`）
   - anon public キー

## 2. テーブルを作る

1. Supabase の **SQL Editor** を開く
2. このフォルダの `supabase/schema.sql` の中身を貼り付けて **Run**
   - tasks テーブルと、本人の行しか読み書きできない RLS ポリシーが作られます

## 3. Google ログインを有効にする

1. Supabase の **Authentication → Sign In / Up → Google** を有効化
   - 画面に表示される **Callback URL**（`https://xxxx.supabase.co/auth/v1/callback`）を控える
2. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   （カレンダー連携で使ったものと同じプロジェクトでOK）で
   OAuth クライアントID（ウェブアプリケーション）を**もう1つ**作成
   - 承認済みのリダイレクト URI：手順1の Callback URL
   - 承認済みの JavaScript 生成元：`http://localhost:3000`
3. 発行された クライアントID と シークレット を Supabase の Google 設定に貼り付けて保存

## 4. アプリに環境変数を設定する

1. `.env.local.example` をコピーして `.env.local` を作る
2. 手順1で控えた URL と anon キーを書き込む
3. dev サーバーを再起動（起動し直すと自動で読み込まれます）

→ アプリを開くとログイン画面が表示され、Googleログイン後に
自分のタスクだけが表示・保存されるようになります。

## 動作確認のポイント

- ログイン後にタスクを作成 → Supabase の **Table Editor → tasks** に行が増える
- 別ブラウザで同じアカウントでログイン → 同じタスクが見える
- ログアウト → ログイン画面に戻る

※ 以前 localStorage に保存したタスクは自動では移行されません。必要なら移行機能を作ります。

---

# 今後の進め方（ロードマップ案）

要件定義書の残り機能を、依存関係の順に並べたものです。

## フェーズ1：公開（次の一歩におすすめ）
- GitHub リポジトリ作成 → Vercel 連携でデプロイ
- 本番URLを Google OAuth（カレンダー用・ログイン用）と Supabase に追加登録
- PWA化（manifest・アイコン・ホーム画面追加）→ 受入基準11

## フェーズ2：リマインダー・通知
- タスクごとの通知時刻設定UI（登録フォームに追加）
- Web Push（service worker ＋ push_subscriptions テーブル）
- サーバーの定期ジョブ（Vercel Cron か Supabase Edge Functions）で通知判定
- メール通知（Resend などのメール配信サービス選定）→ 受入基準の通知系

## フェーズ3：Googleカレンダー同期の本格化
- 現在の「ブラウザから都度読み込み」を、サーバー側 Webhook（変更通知）＋差分同期に
- Google予定ごとのステータス管理（オン/オフ選択、Supabase に保存）→ 受入基準4・5

## フェーズ4：移動支援の自動化
- 経路検索API（Google Maps Routes API など）の選定・課金確認
- 住所から移動時間を自動計算（現在は手動入力）
- 出発推奨時刻 ＝ 開始 − 移動時間 − 余裕時間、の表示と通知
- 交通状況による段階的な再計算 → 受入基準6〜8

## 未決定事項（要件定義書より・決まり次第反映）
- 重複予定の扱い（質問33）※移動中のブロックは実装済み
- 通知時間の選択肢、余裕時間の初期値
- 繰り返しの終了条件、月末日の例外
