# 設定・管理画面 実装仕様書

この文書は管理画面の設計仕様です。実際の起動設定と運用手順は[ADMIN_CONSOLE.md](./ADMIN_CONSOLE.md)を参照してください。

## 1. 目的

Glinezeの運用担当者が、日常の設定変更と稼働確認を安全に行える管理画面を提供する。DiscordコマンドやNotion Configuration DBの生データを直接編集せずに操作できるようにする。

管理画面のログイン入口は、管理者だけが閲覧できるNotionページに置く。アプリケーションが有効期限付きのログインリンクを定期的に更新する。リンクを検証した後は、管理画面専用のセッションCookieに交換する。

## 2. 基本方針

管理画面は既存のExpress 5サーバー内に、サーバーサイドレンダリング方式で実装する。画面から変更できる設定は、引き続きNotion Configuration DBに保存する。`.env`の秘密情報と起動設定は画面から変更しない。

汎用のCRUD管理画面は導入せず、このアプリケーションに必要な操作だけを提供する。任意の設定キーを作成・削除する機能は設けない。Discordの管理コマンドと管理画面では、同じ設定ユースケースと検証処理を使う。

## 3. 対象範囲

### 3.1 MVPに含める機能

1. Notionの定期更新ログインリンクによる認証
2. ログイン後のセッション管理とログアウト
3. 稼働状況の表示
4. カウントダウン設定の表示・更新
5. 練習連絡と場所取り通知先の表示・更新
6. 練習連絡テンプレートの状態表示、プレビュー、再読込
7. Notion DB IDなど詳細設定の表示・更新
8. Sesame設定の表示・更新。ただし秘密値は常にマスクする
9. Configuration DBからの設定再読込
10. 設定変更結果とエラーの画面表示
11. 認証、入力検証、更新、トークン更新の自動テスト

### 3.2 MVPに含めない機能

- ユーザー、グループ、ロールの管理
- 個人単位の認証、権限停止、操作人物の特定
- `.env`の編集
- Discord Bot Token、Notion Token、Webhook検証トークンの表示・変更
- 任意の設定キーの作成・削除
- ログ全文の閲覧
- デプロイ、再起動、Git操作
- Notionデータベース本体のレコード管理
- 複数アプリケーションインスタンス間のセッション共有

## 4. 想定利用者と権限モデル

管理者限定Notionページを閲覧できる人を、管理画面の管理者として扱う。MVPの管理者権限は一種類とし、すべての管理者が同じ操作を行える。

ログインリンクはBearer Credentialとして扱う。転送・漏えいした場合は、有効期限内であれば第三者も利用できる。個人単位の監査や即時失効が必要になった場合は、Discord OAuth2とDiscord Administrator権限確認への移行を別途検討する。

## 5. 画面仕様

管理画面のベースパスは`/admin`とする。すべての管理画面レスポンスに`Cache-Control: no-store`を付与する。

### 5.1 ダッシュボード`/admin`

- 全体状態
- Discord接続状態
- Web API状態
- Notion Automationの有効・無効
- Sesame連携の有効・無効
- 起動日時、稼働時間、当日リクエスト数
- Configuration DBの最終再読込結果
- ログインリンクの次回更新予定時刻と有効期限

既存の`createStatusSnapshot()`相当の情報を共通サービスとして再利用する。

### 5.2 カウントダウン`/admin/settings/countdown`

| 設定キー                | 表示名     | 入力形式         | 検証                              |
| ----------------------- | ---------- | ---------------- | --------------------------------- |
| `countdown_title`       | イベント名 | テキスト         | 空文字不可                        |
| `countdown_date`        | 開催日     | date             | 実在する`YYYY-MM-DD`              |
| `countdown_channelid`   | 通知先     | テキスト         | Discord ID形式                    |
| `countdown_notify_days` | 通知日     | カンマ区切り整数 | 0〜3650、重複を除去し降順に並べる |
| `countdown_message`     | 通知文     | textarea         | 空文字不可、長さ上限を設定        |

設定の更新に成功した後、Botプロフィールを更新する。Discord APIで更新に失敗した場合は、設定保存の失敗と区別して表示する。

### 5.3 通知先`/admin/settings/notifications`

| 設定キー                    | 表示名               |
| --------------------------- | -------------------- |
| `practice_remind_threadid`  | 練習連絡の送信先     |
| `bashotori_remind_threadid` | 場所取り通知の送信先 |
| `discord_general_channelid` | 標準チャンネル       |

IDの入力欄と確認ボタンを設ける。確認成功時はDiscord上の送信先を`サーバー名・チャンネル名`形式で表示する。将来はDiscord APIから選択肢を取得し、選択式のUIに拡張できる設計にする。

### 5.4 練習連絡テンプレート`/admin/settings/practice-template`

- `practice_announcement_template_page_id`の表示・更新
- 組み込みテンプレート / Notionテンプレートの利用状態
- 現在のテンプレートのプレビュー
- 利用可能なプレースホルダー一覧
- テンプレート再読込ボタン
- 再読込に失敗した場合、最終正常版を維持して理由を表示

### 5.5 詳細設定`/admin/settings/advanced`

次の設定は通常設定と分け、注意書きを付けて表示する。

- `practice_databaseid`
- `facility_databaseid`
- `shukin_databaseid`
- `discord_and_notion_pairs_databaseid`
- その他、型付き設定レジストリで`advanced`に分類した既存キー

`shukin_databaseid`は「集金データベース」と表示する。IDはUUIDの表記揺れを許容する。NotionのデータベースURLが入力された場合は、パスからDB IDを抽出する。`v`クエリはビューIDなのでDB IDとして扱わない。各データベースに確認ボタンを設ける。Notion APIでデータベースの存在とBotの閲覧権限を確認し、データベース名を表示する。

### 5.6 Sesame `/admin/settings/sesame`

起動時は`SESAME_ENABLED`を初期値として扱い、設定画面で保存した`sesame_enabled`を、それ以降の有効状態として優先する。無効時も接続設定は編集可能にする。

- `sesame_enabled`
- `sesame_app_api_url`
- `sesame_app_api_key`
- `sesame_device_uuid`
- `sesame_device_publickey`
- `sesame_message_when_locked`
- `sesame_message_when_unlocked`
- `sesame_message_when_loading`

API Keyと公開鍵は、保存済みの値をレスポンスに含めず`設定済み`とだけ表示する。空欄で保存した場合は既存値を維持する。更新に成功した後、`SesameService.reloadConfiguration()`を実行する。Discordコマンド、Cron、稼働状況表示には実行時に反映する。既存の設定DBに`sesame_enabled`がない場合は初回保存時に作成する。

### 5.7 システム設定`/admin/settings/system`

`.env`の値そのものは表示せず、次だけを読み取り専用で表示する。

- 動作環境
- Notion Automationの有効・無効
- Sesameの有効・無効
- 必須認証情報の設定済み・未設定
- ブランチ名

Configuration DBの再読込ボタンを置く。

## 6. 設定管理の内部仕様

### 6.1 型付き設定レジストリ

各設定のメタデータを一か所にまとめて定義する。

- キー
- TypeScript上の値型
- Zodスキーマ
- 表示名と説明
- カテゴリ
- 入力UIの種類
- 秘密値かどうか
- 更新後に必要な副作用
- 管理画面から編集可能かどうか

文字列による`getConfig('...')`の直接利用を段階的に減らし、Discordコマンドと管理画面の検証を共通化する。

### 6.2 コンポーネント分割

- `ConfigRepository`: Notion Configuration DBの読み書き
- `ConfigStore`: 検証済み実行時設定の保持
- `ConfigService`: 読込、単一更新、複数更新、副作用の調整
- `ConfigDefinition`: キー、型、表示、検証の定義

既存の公開APIを一度に削除せず、互換ラッパーを設けて段階的に移行する。

### 6.3 複数設定更新

Notion APIには複数ページ更新のトランザクションがないため、厳密な原子性は保証できない。

1. すべての入力を先に検証する。
2. 現在の値を保持してから、Notionの更新を順番に実行する。
3. すべての更新に成功した後、実行時ストアに反映する。
4. 途中で失敗した場合はConfiguration DBを再読み込みし、保存されている値と実行時の値を一致させる。
5. 画面には一部だけ更新された可能性と、再読み込みの結果を明示する。

## 7. 認証仕様

### 7.1 追加環境変数

| 変数                          | 必須条件 | 内容                                     |
| ----------------------------- | -------- | ---------------------------------------- |
| `ADMIN_ENABLED`               | 常時     | 管理画面機能フラグ。既定値`false`        |
| `ADMIN_BASE_URL`              | 有効時   | HTTPSの公開URL                           |
| `ADMIN_AUTH_SECRET`           | 有効時   | 32 byte以上の十分にランダムな秘密値      |
| `ADMIN_NOTION_LOGIN_BLOCK_ID` | 有効時   | ログインリンクを書き込むNotionブロックID |
| `ADMIN_TOKEN_ROTATION_CRON`   | 任意     | 既定値`5 4 * * *`、Asia/Tokyo            |
| `ADMIN_TOKEN_TTL_HOURS`       | 任意     | 既定値48                                 |
| `ADMIN_SESSION_TTL_HOURS`     | 任意     | 既定値12                                 |

`ADMIN_AUTH_SECRET`と生のログイントークンをログへ出力してはならない。

### 7.2 ログイントークン

暗号学的に保護された、有効期限付きトークンを使用する。ペイロードに用途、発行時刻、有効期限、ランダムなnonceを含める。

URLは`${ADMIN_BASE_URL}/admin/login?token=...`とする。起動時とCron実行時に新しいトークンを発行し、指定Notionブロックのリンクを更新する。

発行済みのトークンは、それぞれの有効期限まで検証できるようにする。更新に失敗した場合でも、期限内は既存のトークンを利用できる。検証失敗時は理由を詳細表示せず、同一の401画面を返す。

ログイン検証ルートにはIP単位のレート制限を設ける。

トークンの実装には`@hapi/iron`を第一候補とする。実装前に最小限の検証を行い、Node.jsのCommonJS構成で期限付きのsealed tokenを扱えることを確認する。適合しない場合はNode.jsの`crypto`を使い、HMAC-SHA-256署名トークンを独立した小さなモジュールとテストで実装する。

### 7.3 ログイン処理

1. `GET /admin/login?token=...`でトークンを検証する。
2. 成功時に新しいセッションを発行する。
3. `303 See Other`で`/admin`へリダイレクトし、アドレスバーからトークンを除去する。
4. トークン付きレスポンスには`Cache-Control: no-store`と`Referrer-Policy: no-referrer`を付ける。

### 7.4 セッション

`express-session`を使用する。単一インスタンス運用を前提に`memorystore`を使用する。

再起動でセッションが失効することを許容する。利用者はNotionのリンクから再ログインする。Cookie名は`__Host-glineze-admin`とする。

Cookie属性は`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`とする。セッション固定攻撃を避けるため、ログイン成功時にセッションIDを再生成する。

セッション有効期限は既定12時間とし、必要以上に延長しない。`POST /admin/logout`でセッションを破棄する。

### 7.5 CSRFとブラウザ保護

すべての状態変更にはPOSTを使用し、GETでは変更しない。`csrf-sync`によるSynchronizer Token Patternを使用する。

Helmetまたは同等の設定でCSP、HSTS、frame-ancestors、nosniffなどを付与する。インラインJavaScriptを原則使用しない。

CSSはnpmで取り込み、自サイトから配信する。管理画面から外部CDNへ接続しない。エラー画面を含む全管理画面で秘密値をHTMLに埋め込まない。

## 8. Notionログインリンク更新

指定ブロックは管理画面リンク専用のparagraphまたはcalloutブロックとする。表示文言は`Glineze 管理画面を開く`とし、リンクURLだけを更新する。

起動時に一度更新し、その後Cronで定期更新する。Notion更新成功後に、発行時刻と有効期限だけをINFOログへ記録する。

更新失敗時は既存リンクを上書きせず、エラーを記録する。一時的なNotion障害ではプロセス全体を停止しない。

次回実行を待つほか、認証済み管理画面から手動再実行できるようにする。

## 9. HTTPルート

| Method | Path                               | 認証              | 用途                       |
| ------ | ---------------------------------- | ----------------- | -------------------------- |
| GET    | `/admin/login`                     | トークン          | トークンをセッションへ交換 |
| GET    | `/admin`                           | セッション        | ダッシュボード             |
| GET    | `/admin/settings/:category`        | セッション        | 設定画面                   |
| POST   | `/admin/settings/:category`        | セッション + CSRF | 設定更新                   |
| POST   | `/admin/actions/reload-config`     | セッション + CSRF | 設定再読込                 |
| POST   | `/admin/actions/reload-template`   | セッション + CSRF | テンプレート再読込         |
| POST   | `/admin/actions/rotate-login-link` | セッション + CSRF | ログインリンク手動更新     |
| POST   | `/admin/logout`                    | セッション + CSRF | ログアウト                 |

未認証で管理画面にアクセスした場合は401を返す。トークンのないログイン画面には誘導せず、Notionのリンクからアクセスするよう案内する。

## 10. UI方針

- EtaまたはEJSによるサーバーサイドレンダリング
- Pico CSSをnpm依存として取り込み、静的ファイルとして配信
- JavaScriptが無効でも主要操作を完了できるフォーム
- モバイル表示対応
- 保存前に変更対象を明確に表示
- 成功、入力エラー、外部APIエラーを区別
- 秘密値には`設定済み`、`未設定`の状態だけを表示
- 削除や破壊的操作はMVPに含めない

## 11. ログと監査

認証成功・失敗、ログアウト、設定キー、更新結果を記録する。設定値、ログイントークン、セッションID、CSRFトークンは記録しない。

秘密値でない場合も、変更前後の値を通常ログへ記録しない。共有リンク認証のため、操作した個人は特定できない。記録上のactorは`notion-admin-session`とする。

`initializeConfig()`にある全設定値のDEBUG出力は、管理画面の公開前に削除するか、値を完全に伏せる。

## 12. エラー処理

- 入力エラー: 400。同じ画面に項目単位のエラーを表示
- 未認証・無効トークン: 401
- CSRFエラー: 403
- 存在しない管理画面ルート: 404
- レート制限: 429
- Notion / Discord / Sesameエラー: 502または503。利用者向けには安全な要約を表示
- 内部エラー: 500。スタックトレースや秘密情報を画面へ出さない

## 13. テスト要件

### 13.1 単体テスト

- 設定レジストリの全キーとZod検証
- 日付、通知日、Discord ID、Notion IDの検証
- 秘密値のマスクと空欄更新
- ログイントークンの正常、改ざん、期限切れ、用途違い
- セッション期限と認証ミドルウェア
- CSRF検証
- 複数更新の成功と途中失敗後の再読込
- 更新後に実行する副作用の呼び分け

### 13.2 HTTP結合テスト

- 未認証アクセスが拒否される
- 有効なリンクがセッションへ交換され、URLからトークンが消える
- Cookie属性が仕様どおりである
- GETで状態変更できない
- CSRFなしのPOSTが拒否される
- 秘密値がHTMLとログに現れない
- Notionリンク更新失敗時に既存リンクを上書きしない
- 既存の`/`、`/api/status`、`/health`、`/automation`の挙動を維持する

### 13.3 完了時検証

以下がすべて成功すること。

```sh
npm run typecheck
npm run lint
npm test
```

## 14. 実装順序

1. 設定値DEBUGログの秘匿化
2. 型付き設定レジストリと共通検証の導入
3. `ConfigRepository` / `ConfigStore` / `ConfigService`の分離
4. 既存Discord設定コマンドを共通サービスへ接続
5. 認証トークン、セッション、CSRFの実装
6. Notionログインリンク更新サービスとCronの実装
7. 管理画面ルートとテンプレートの実装
8. 設定更新後の副作用を接続
9. セキュリティ・HTTP結合テスト
10. ドキュメントと運用手順の更新

各段階でtypecheck、lint、testを実行し、既存の挙動を維持する。

## 15. 受け入れ条件

- 管理者がNotionページ上の最新リンクからログインできる。
- ログイン成功後、ブラウザのURLにトークンが残らない。
- トークンが改ざんされているか、有効期限が切れている場合はログインできない。
- ログインリンクが定期更新され、失敗しても既存リンクを上書きしない。
- 日常設定をNotion DBの直接編集なしで変更できる。
- 更新内容がNotion Configuration DBと実行時設定の双方へ反映される。
- 設定ごとの入力検証がDiscordコマンドと管理画面で共通化される。
- 秘密値と認証情報がHTML、JSON、ログへ出ない。
- `.env`は管理画面から変更できない。
- 既存Web API、Discord、Cron、Notion Automationの挙動を維持する。
- 追加テストを含むtypecheck、lint、testが成功する。
