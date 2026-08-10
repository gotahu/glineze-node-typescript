# 設定・管理画面 実装仕様書

## 1. 目的

Glineze の運用担当者が、Discord コマンドや Notion Configuration DB の生データを直接編集せずに、日常的な設定変更と稼働確認を安全に行える管理画面を提供する。

管理画面のログイン入口は、管理者だけが閲覧できる Notion ページに置く。有効期限付きログインリンクをアプリケーションが定期更新し、リンク検証後は管理画面専用のセッション Cookie に交換する。

## 2. 基本方針

- 既存の Express 5 サーバー内に、サーバーサイドレンダリング方式で実装する。
- Notion Configuration DB を、画面から変更可能な設定の永続ストアとして維持する。
- `.env` の秘密情報や起動設定は画面から変更しない。
- 汎用 CRUD 管理画面は導入せず、このアプリケーションに必要な操作だけを提供する。
- Discord の管理コマンドと管理画面は、同じ設定ユースケースと検証処理を利用する。
- 管理画面には任意の設定キーを作成・削除する機能を持たせない。

## 3. 対象範囲

### 3.1 MVP に含める機能

1. Notion の定期更新ログインリンクによる認証
2. ログイン後のセッション管理とログアウト
3. 稼働状況の表示
4. カウントダウン設定の表示・更新
5. 練習連絡と場所取り通知先の表示・更新
6. 練習連絡テンプレートの状態表示、プレビュー、再読込
7. Notion DB ID など詳細設定の表示・更新
8. Sesame 設定の表示・更新。ただし秘密値は常にマスクする
9. Configuration DB からの設定再読込
10. 設定変更結果とエラーの画面表示
11. 認証、入力検証、更新、トークン更新の自動テスト

### 3.2 MVP に含めない機能

- ユーザー、グループ、ロールの管理
- 個人単位の認証、権限停止、操作人物の特定
- `.env` の編集
- Discord Bot Token、Notion Token、Webhook 検証トークンの表示・変更
- 任意の設定キーの作成・削除
- ログ全文の閲覧
- デプロイ、再起動、Git 操作
- Notion データベース本体のレコード管理
- 複数アプリケーションインスタンス間のセッション共有

## 4. 想定利用者と権限モデル

- 管理者限定 Notion ページを閲覧できる人を、管理画面の管理者として扱う。
- MVP の管理者権限は一種類とし、すべての管理者が同じ操作を行える。
- ログインリンクは Bearer Credential である。転送・漏えいした場合は、有効期限内であれば第三者も利用できる。
- 個人単位の監査や即時失効が必要になった場合は、Discord OAuth2 と Discord Administrator 権限確認への移行を別途検討する。

## 5. 画面仕様

管理画面のベースパスは `/admin` とする。すべての管理画面レスポンスに `Cache-Control: no-store` を付与する。

### 5.1 ダッシュボード `/admin`

- 全体状態
- Discord 接続状態
- Web API 状態
- Notion Automation の有効・無効
- Sesame 連携の有効・無効
- 起動日時、稼働時間、当日リクエスト数
- Configuration DB の最終再読込結果
- ログインリンクの次回更新予定時刻と有効期限

既存の `createStatusSnapshot()` 相当の情報を共通サービスとして再利用する。

### 5.2 カウントダウン `/admin/settings/countdown`

| 設定キー | 表示名 | 入力形式 | 検証 |
|---|---|---|---|
| `countdown_title` | イベント名 | テキスト | 空文字不可 |
| `countdown_date` | 開催日 | date | 実在する `YYYY-MM-DD` |
| `countdown_channelid` | 通知先 | テキスト | Discord ID 形式 |
| `countdown_notify_days` | 通知日 | カンマ区切り整数 | 0〜3650、重複排除、降順正規化 |
| `countdown_message` | 通知文 | textarea | 空文字不可、長さ上限を設定 |

更新成功後に Bot プロフィールを更新する。Discord API 側の更新失敗は設定保存の失敗とは分けて表示する。

### 5.3 通知先 `/admin/settings/notifications`

| 設定キー | 表示名 |
|---|---|
| `practice_remind_threadid` | 練習連絡の送信先 |
| `bashotori_remind_threadid` | 場所取り通知の送信先 |
| `discord_general_channelid` | 標準チャンネル |

ID 入力と確認ボタンを提供する。確認成功時は Discord 上の送信先を `サーバー名・チャンネル名` 形式で表示する。将来、Discord API から選択肢を取得するセレクト UI に拡張できる設計にする。

### 5.4 練習連絡テンプレート `/admin/settings/practice-template`

- `practice_announcement_template_page_id` の表示・更新
- 組み込みテンプレート / Notion テンプレートの利用状態
- 現在のテンプレートのプレビュー
- 利用可能なプレースホルダー一覧
- テンプレート再読込ボタン
- 再読込に失敗した場合、最終正常版を維持して理由を表示

### 5.5 詳細設定 `/admin/settings/advanced`

以下を通常設定と分け、注意書き付きで表示する。

- `practice_databaseid`
- `facility_databaseid`
- `shukin_databaseid`
- `discord_and_notion_pairs_databaseid`
- その他、型付き設定レジストリで `advanced` に分類した既存キー

`shukin_databaseid` は「集金データベース」と表示する。ID は UUID 表記揺れを許容し、Notion のデータベースURLが入力された場合はパスからDB IDを抽出する。`v` クエリはビューIDなのでDB IDとして扱わない。各データベースに確認ボタンを提供し、Notion API で存在とBotの閲覧権限を確認してデータベース名を表示する。

### 5.6 Sesame `/admin/settings/sesame`

起動時は `SESAME_ENABLED` を初期値として扱い、設定画面で保存した `sesame_enabled` を以後の有効状態として優先する。無効時も接続設定は編集可能にする。

- `sesame_enabled`
- `sesame_app_api_url`
- `sesame_app_api_key`
- `sesame_device_uuid`
- `sesame_device_publickey`
- `sesame_message_when_locked`
- `sesame_message_when_unlocked`
- `sesame_message_when_loading`

API Key と公開鍵は保存済みの値をレスポンスへ含めず、`設定済み` とだけ表示する。空欄で保存した場合は既存値を維持する。更新成功後に `SesameService.reloadConfiguration()` を実行し、Discord コマンド、Cron、稼働状況表示へランタイムで反映する。既存の設定DBに `sesame_enabled` がない場合は初回保存時に作成する。

### 5.7 システム設定 `/admin/settings/system`

`.env` の値そのものは表示せず、次だけを読み取り専用で表示する。

- 動作環境
- Notion Automation の有効・無効
- Sesame の有効・無効
- 必須認証情報の設定済み・未設定
- ブランチ名

Configuration DB の再読込ボタンを置く。

## 6. 設定管理の内部仕様

### 6.1 型付き設定レジストリ

設定ごとに次のメタデータを一か所で定義する。

- キー
- TypeScript 上の値型
- Zod スキーマ
- 表示名と説明
- カテゴリ
- 入力 UI の種類
- 秘密値かどうか
- 更新後に必要な副作用
- 管理画面から編集可能かどうか

文字列による `getConfig('...')` の直接利用を段階的に減らし、Discord コマンドと管理画面の検証を共通化する。

### 6.2 コンポーネント分割

- `ConfigRepository`: Notion Configuration DB の読み書き
- `ConfigStore`: 検証済み実行時設定の保持
- `ConfigService`: 読込、単一更新、複数更新、副作用の調整
- `ConfigDefinition`: キー、型、表示、検証の定義

既存の公開 API を一度に削除せず、互換ラッパーを設けて段階移行する。

### 6.3 複数設定更新

Notion API には複数ページ更新のトランザクションがないため、厳密な原子性は保証できない。

1. すべての入力を先に検証する。
2. 現在値を保持してから Notion 更新を順番に実行する。
3. 全更新成功後に実行時ストアへ反映する。
4. 途中失敗時は Configuration DB を再読込し、実際の永続状態と実行時状態を一致させる。
5. 画面には一部更新の可能性と再読込結果を明示する。

## 7. 認証仕様

### 7.1 追加環境変数

| 変数 | 必須条件 | 内容 |
|---|---|---|
| `ADMIN_ENABLED` | 常時 | 管理画面機能フラグ。既定値 `false` |
| `ADMIN_BASE_URL` | 有効時 | HTTPS の公開 URL |
| `ADMIN_AUTH_SECRET` | 有効時 | 32 byte 以上の十分にランダムな秘密値 |
| `ADMIN_NOTION_LOGIN_BLOCK_ID` | 有効時 | ログインリンクを書き込む Notion ブロック ID |
| `ADMIN_TOKEN_ROTATION_CRON` | 任意 | 既定値 `5 4 * * *`、Asia/Tokyo |
| `ADMIN_TOKEN_TTL_HOURS` | 任意 | 既定値 48 |
| `ADMIN_SESSION_TTL_HOURS` | 任意 | 既定値 12 |

`ADMIN_AUTH_SECRET` と生のログイントークンをログへ出力してはならない。

### 7.2 ログイントークン

- 暗号学的に保護された、有効期限付きトークンを使用する。
- ペイロードに用途、発行時刻、有効期限、ランダム nonce を含める。
- URL は `${ADMIN_BASE_URL}/admin/login?token=...` とする。
- 起動時と Cron 実行時に新しいトークンを発行し、指定 Notion ブロックのリンクを更新する。
- 既発行トークンはそれぞれの有効期限まで検証可能とし、更新失敗時の猶予を確保する。
- 検証失敗時は理由を詳細表示せず、同一の 401 画面を返す。
- ログイン検証ルートには IP 単位のレート制限を設ける。

トークン実装には `@hapi/iron` を第一候補とする。Node.js の CommonJS 構成を維持したまま、期限付きの sealed token を扱えることを実装前に最小検証する。適合しない場合は、Node.js `crypto` を用いた HMAC-SHA-256 署名トークンを、独立した小さなモジュールとテストで実装する。

### 7.3 ログイン処理

1. `GET /admin/login?token=...` でトークンを検証する。
2. 成功時に新しいセッションを発行する。
3. `303 See Other` で `/admin` へリダイレクトし、アドレスバーからトークンを除去する。
4. トークン付きレスポンスには `Cache-Control: no-store` と `Referrer-Policy: no-referrer` を付ける。

### 7.4 セッション

- `express-session` を使用する。
- 単一インスタンス運用を前提に `memorystore` を使用する。
- 再起動でセッションが失効することを許容する。利用者は Notion のリンクから再ログインする。
- Cookie 名は `__Host-glineze-admin` とする。
- Cookie 属性は `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` とする。
- セッション固定攻撃を避けるため、ログイン成功時にセッション ID を再生成する。
- セッション有効期限は既定 12 時間とし、必要以上に延長しない。
- `POST /admin/logout` でセッションを破棄する。

### 7.5 CSRF とブラウザ保護

- すべての状態変更は POST とし、GET では変更しない。
- `csrf-sync` による Synchronizer Token Pattern を使用する。
- Helmet または同等の設定で CSP、HSTS、frame-ancestors、nosniff などを付与する。
- インライン JavaScriptを原則使用しない。
- CSS は npm で取り込み、自サイトから配信する。管理画面から外部 CDN へ接続しない。
- エラー画面を含む全管理画面で秘密値を HTML に埋め込まない。

## 8. Notion ログインリンク更新

- 指定ブロックは管理画面リンク専用の paragraph または callout ブロックとする。
- 表示文言は `Glineze 管理画面を開く` とし、リンク URL だけを更新する。
- 起動時に一度更新し、その後 Cron で定期更新する。
- Notion 更新成功後に、発行時刻と有効期限だけを INFO ログへ記録する。
- 更新失敗時は既存リンクを破壊せず、エラーを記録する。
- 一時的な Notion 障害ではプロセス全体を停止しない。
- 次回実行を待つほか、認証済み管理画面から手動再実行できるようにする。

## 9. HTTP ルート

| Method | Path | 認証 | 用途 |
|---|---|---|---|
| GET | `/admin/login` | トークン | トークンをセッションへ交換 |
| GET | `/admin` | セッション | ダッシュボード |
| GET | `/admin/settings/:category` | セッション | 設定画面 |
| POST | `/admin/settings/:category` | セッション + CSRF | 設定更新 |
| POST | `/admin/actions/reload-config` | セッション + CSRF | 設定再読込 |
| POST | `/admin/actions/reload-template` | セッション + CSRF | テンプレート再読込 |
| POST | `/admin/actions/rotate-login-link` | セッション + CSRF | ログインリンク手動更新 |
| POST | `/admin/logout` | セッション + CSRF | ログアウト |

未認証の管理画面アクセスは、トークンのないログイン画面へ誘導せず 401 を返し、Notion のリンクからアクセスするよう案内する。

## 10. UI 方針

- Eta または EJS によるサーバーサイドレンダリング
- Pico CSS を npm 依存として取り込み、静的ファイルとして配信
- JavaScript が無効でも主要操作を完了できるフォーム
- モバイル表示対応
- 保存前に変更対象を明確に表示
- 成功、入力エラー、外部 API エラーを区別
- 秘密値には `設定済み`、`未設定` の状態だけを表示
- 削除や破壊的操作は MVP に含めない

## 11. ログと監査

- 認証成功・失敗、ログアウト、設定キー、更新結果を記録する。
- 設定値、ログイントークン、セッション ID、CSRF トークンは記録しない。
- 秘密値でない場合も、変更前後の値を通常ログへ記録しない。
- 共有リンク認証のため、操作人物は特定できない。記録上の actor は `notion-admin-session` とする。
- 現在の `initializeConfig()` にある全設定値の DEBUG 出力は、管理画面公開前に削除または完全に秘匿化する。

## 12. エラー処理

- 入力エラー: 400。同じ画面に項目単位のエラーを表示
- 未認証・無効トークン: 401
- CSRF エラー: 403
- 存在しない管理画面ルート: 404
- レート制限: 429
- Notion / Discord / Sesame エラー: 502 または 503。利用者向けには安全な要約を表示
- 内部エラー: 500。スタックトレースや秘密情報を画面へ出さない

## 13. テスト要件

### 13.1 単体テスト

- 設定レジストリの全キーと Zod 検証
- 日付、通知日、Discord ID、Notion ID の検証
- 秘密値のマスクと空欄更新
- ログイントークンの正常、改ざん、期限切れ、用途違い
- セッション期限と認証ミドルウェア
- CSRF 検証
- 複数更新の成功と途中失敗後の再読込
- 更新後副作用の呼び分け

### 13.2 HTTP 結合テスト

- 未認証アクセスが拒否される
- 有効なリンクがセッションへ交換され、URL からトークンが消える
- Cookie 属性が仕様どおりである
- GET で状態変更できない
- CSRF なしの POST が拒否される
- 秘密値が HTML とログに現れない
- Notion リンク更新失敗時に既存リンクを上書きしない
- 既存 `/`, `/api/status`, `/health`, `/automation` の挙動を壊さない

### 13.3 完了時検証

以下がすべて成功すること。

```sh
npm run typecheck
npm run lint
npm test
```

## 14. 実装順序

1. 設定値 DEBUG ログの秘匿化
2. 型付き設定レジストリと共通検証の導入
3. `ConfigRepository` / `ConfigStore` / `ConfigService` の分離
4. 既存 Discord 設定コマンドを共通サービスへ接続
5. 認証トークン、セッション、CSRF の実装
6. Notion ログインリンク更新サービスと Cron の実装
7. 管理画面ルートとテンプレートの実装
8. 設定更新後の副作用を接続
9. セキュリティ・HTTP 結合テスト
10. ドキュメントと運用手順の更新

各段階で typecheck、lint、test を実行し、既存挙動を維持する。

## 15. 受け入れ条件

- 管理者が Notion ページ上の最新リンクからログインできる。
- ログイン成功後、ブラウザの URL にトークンが残らない。
- トークンが改ざん済みまたは期限切れならログインできない。
- ログインリンクが定期更新され、失敗しても既存リンクを壊さない。
- 日常設定を Notion DB の直接編集なしで変更できる。
- 更新内容が Notion Configuration DB と実行時設定の双方へ反映される。
- 設定ごとの入力検証が Discord コマンドと管理画面で共通化される。
- 秘密値と認証情報が HTML、JSON、ログへ出ない。
- `.env` は管理画面から変更できない。
- 既存 Web API、Discord、Cron、Notion Automation の挙動を壊さない。
- 追加テストを含む typecheck、lint、test が成功する。

## 16. Goal 用プロンプト

Codex の Goal には、次の目的文を渡す。

```text
ADMIN_CONSOLE_SPEC.md を唯一の実装仕様として、Glineze の設定・管理画面を実装する。

仕様書の「実装順序」に従って段階的に進め、各段階で既存コードとテストを確認すること。既存の Discord コマンド、Web API、Cron、Notion Automation の挙動を維持し、秘密情報をログ・HTML・テスト fixture に残さないこと。管理画面は既存 Express 5 サーバー上のサーバーサイドレンダリングとし、Notion の定期更新ログインリンク、セッション、CSRF 対策、型付き設定管理、設定画面、必要な自動テストを完成させること。

作業中に仕様と現行実装が矛盾した場合は、安全性と後方互換性を優先して判断内容を仕様書へ追記すること。外部サービスの実値や新しい秘密情報がないと進められない箇所は、安全なプレースホルダーと無効既定値で実装し、必要な環境変数と運用手順を文書化すること。

完了条件は、ADMIN_CONSOLE_SPEC.md の受け入れ条件をすべて満たし、npm run typecheck、npm run lint、npm test が成功すること。単に計画を作るだけで終了せず、実装、テスト、文書更新まで継続すること。コミット、push、PR 作成は行わないこと。
```
