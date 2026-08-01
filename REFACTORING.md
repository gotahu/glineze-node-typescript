# リファクタリング計画・進捗台帳

## 目的

既存機能の挙動を維持しながら、Discord・Notion・Cron・Web API 間の依存を整理し、機能追加、テスト、障害調査をしやすい構造へ段階的に移行する。

このファイルをリファクタリング作業の唯一の進捗台帳として扱う。各作業では、着手前に対象項目を `IN PROGRESS` にし、完了時に検証結果と判断内容を追記する。

## ステータス定義

- `TODO`: 未着手
- `IN PROGRESS`: 作業中
- `DONE`: 実装と検証が完了
- `BLOCKED`: 外部判断または追加情報が必要
- `WONTFIX`: 調査の結果、対応しないと判断

## 作業原則

1. Phase は P0 から順番に進める。
2. 一度に複数の設計変更を混ぜず、小さく検証可能な単位で変更する。
3. 各変更後に最低限 `typecheck`、`lint`、`test` を実行する。
4. 既存仕様が不明な場合は、先に characterization test（現状挙動を固定するテスト）を追加する。
5. 外部仕様、Discord コマンド名、応答文、Cron 時刻、Notion のプロパティ名は、明示的な変更項目を除いて維持する。
6. 秘密情報、トークン、個人情報をログやテスト fixture に残さない。
7. 各 Phase 完了時に、このファイルのチェックリスト、検証結果、判断記録を更新する。

## 現状ベースライン

確認日: 2026-08-02

- TypeScript ソース: 約 5,200 行
- `npm run build`: 成功
- `npm test`: 21 件成功
- ESLint: 18 errors / 4 warnings
- 現在の主要な巨大ファイル:
  - `src/services/webapi/statusPage.ts`: 773 行
  - `src/services/discord/slashCommands.ts`: 531 行
  - `src/services/webapi/webServerService.ts`: 342 行
  - `src/services/discord/discordService.ts`: 339 行
- テストは Discord の破壊的コマンド、Relay、Webhook Security、無効化された連携、Slash Command の一部へ集中している。
- Config、Cron、Notion のドメイン処理、アプリケーション起動・終了には十分なテストがない。

## 修正すべき箇所

### 1. Discord コマンド境界

対象:

- `src/services/discord/slashCommands.ts`
- `src/services/discord/commands/`
- `src/services/discord/messageHandler.ts`

ステータス: `DONE`（P3）

問題点:

- Slash Command を偽の Discord `Message` に変換し、`as unknown as Message` で型検査を回避している。
- コマンド定義、権限、入力検証、引数変換、実行振り分けが `slashCommands.ts` に集中している。
- Message Command と Slash Command の互換処理が文字列変換に依存している。
- Slash Command Builder 上の権限と実行時の権限判定が二重管理になっている。

対処法:

- Discord.js に依存しない `CommandContext` とコマンド入力型を導入する。
- Message と Interaction は、それぞれ `CommandContext` を作るアダプターとする。
- コマンド定義、権限、入力検証、実行処理をコマンド単位のモジュールへ移す。
- `createMessageAdapter()` と `as unknown as Message` を削除する。

完了条件:

- Message Command と Slash Command が同じユースケースを型安全に呼び出す。
- コマンド追加時に巨大な中央 switch の編集を必要としない。
- 権限定義が一か所で管理される。

### 2. サービス間の循環依存

対象:

- `src/types/types.ts`
- `src/app.ts`
- `src/services/discord/discordService.ts`
- `Services` 型を受け取る各処理

ステータス: `DONE`（P2〜P5）

問題点:

- `Services` が具象サービスを直接参照し、`DiscordService` が自身を含む `Services` を組み立てている。
- 各処理が必要以上に大きな依存オブジェクトを受け取る。
- 単体テストで Discord Client、Notion Client などの大きなモックが必要になる。

対処法:

- `Services` を段階的に廃止する。
- `MessageSender`、`PracticeRepository` など、ユースケースごとの小さなインターフェースを定義する。
- 具象サービスの組み立てを bootstrap 層だけに限定する。
- 機能コードから Discord.js、Notion Client の具象型を排除する。

完了条件:

- 機能処理を外部 API なしで単体テストできる。
- `Services` が廃止されるか、bootstrap 内のみに限定される。

### 3. 設定管理

対象:

- `src/config.ts`
- `src/env.ts`
- `config.getConfig()` / `config.setConfig()` の利用箇所

ステータス: `DONE`（P4）

問題点:

- `config` が環境設定、Notion 通信、キャッシュ、更新、プロパティ変換を兼務している。
- 設定キーが文字列であり、スペルミスをコンパイル時に検出できない。
- 複数の設定更新が逐次実行され、途中で失敗すると部分更新になる。
- キー不存在、設定不備、Notion 障害が明確に区別されていない。

対処法:

- `ConfigStore`、`ConfigRepository`、Notion property mapper に分割する。
- 設定キーと値を TypeScript の型として定義する。
- `updateMany()` 相当の一括更新ユースケースを導入する。
- 設定値の検証を Discord 層から設定・ユースケース層へ移す。

完了条件:

- 主要機能から文字列ベースの `getConfig()` がなくなる。
- Notion なしで設定利用側をテストできる。
- 複数設定更新の一貫性が保証される。

### 4. 起動・終了ライフサイクル

対象:

- `src/app.ts`
- `src/services/webapi/webServerService.ts`
- `src/services/discord/discordService.ts`
- `src/services/cron/CronService.ts`

ステータス: `DONE`（P2）

問題点:

- `WebServerService` がコンストラクタ内で HTTP listen を開始する。
- 生成、イベント登録、外部接続、起動の境界が曖昧である。
- HTTP、Discord、Cron をまとめて停止する処理がない。
- SIGINT / SIGTERM を処理していない。

対処法:

- コンストラクタから外部副作用を除去する。
- 各コンポーネントへ明示的な `start()` / `stop()` を設ける。
- `createApplication()` で依存を組み立てる。
- シグナル受信時に全コンポーネントを安全に停止する。

完了条件:

- インスタンス生成だけでは外部接続や listen が発生しない。
- HTTP、Discord、Cron を明示的に起動・停止できる。
- 起動失敗時に、開始済みコンポーネントを後片付けできる。

### 5. Cron と非同期処理

対象:

- `src/services/cron/CronService.ts`
- `src/services/discord/functions/CountdownFunctions.ts`
- Sesame 定期更新処理

ステータス: `DONE`（P1、P6）

問題点:

- Promise を `await` せずに呼び出す箇所がある。
- 定期ジョブの重複実行防止がない。
- ジョブ単位の実行時間、最終成功時刻、最終失敗情報を保持していない。
- エラーの握りつぶし方が処理ごとに異なる。

対処法:

- Cron callback と呼び出し先を `async` / `await` に統一する。
- ジョブを `ScheduledJob` として定義し、登録処理を共通化する。
- 必要なジョブに多重実行防止を導入する。
- ジョブ名、開始、終了、所要時間、失敗を構造化ログへ記録する。

完了条件:

- すべての非同期ジョブが追跡可能である。
- Promise rejection が取りこぼされない。
- 重複実行の方針がテストされている。

### 6. Web API とステータスページ

対象:

- `src/services/webapi/statusPage.ts`
- `src/services/webapi/webServerService.ts`
- `src/services/webapi/notionAutomationService.ts`

ステータス: `DONE`（P1、P2、P6）

問題点:

- HTML、CSS、JavaScript、API 型が一つの TypeScript ファイルに同居している。
- ルーティング、Webhook、統計、ステータス生成、サーバー起動が一クラスに集中している。
- 環境変数が有効というだけで外部連携を operational と表示する場合がある。

対処法:

- ステータスページを静的アセットへ分離する。
- Express app の構築、route、status provider、server listen を分割する。
- 最終成功時刻と最終エラーに基づく health 情報を導入する。

完了条件:

- HTTP app を listen せずにテストできる。
- ステータスページの表示と API ロジックが独立する。
- health が実際の稼働状態を反映する。

### 7. Notion 関連処理

対象:

- `src/services/notion/`
- `src/utils/notion/`
- `src/utils/notionUtils.ts`

ステータス: `DONE`（P0、P5）

問題点:

- Repository 相当の取得処理と、メッセージ生成・通知処理が混在している。
- データなし、Notion 障害、不正スキーマを、空配列・`undefined`・例外など異なる方法で返している。
- `utils/notionUtils.ts` と `utils/notion/` に関連処理が分散している。
- Notion のプロパティ名が機能コード内へ直接埋め込まれている。

対処法:

- Repository、mapper、ユースケース、通知処理を分離する。
- 外部 API エラーとドメイン上の「データなし」を区別する。
- Notion utility の公開窓口と配置を整理する。
- Notion プロパティ名を mapper または schema 定義へ集約する。

完了条件:

- Notion レスポンスからドメイン型への変換が一か所にまとまる。
- エラー種別が呼び出し側で判別できる。
- 通知文生成を Notion Client なしでテストできる。

### 8. ログ、秘密情報、ハードコード

対象:

- `src/utils/logger.ts`
- `src/services/discord/discordService.ts`
- `src/services/notion/kondate.ts`
- ID、トークン、URL を直接記述している箇所

ステータス: `DONE`（P1）

問題点:

- Discord ログイン失敗時に Bot token の先頭部分をログへ出力する。
- Discord channel ID や Notion database ID のハードコードがある。
- Logger メソッドが同期処理なのに `async` として定義されている。
- `console.log` と logger が混在している。

対処法:

- 秘密値の部分出力を含め、トークンをログへ出さない。
- 環境設定または型付き動的設定へ ID を移す。
- Logger API の同期・非同期契約を実態に合わせる。
- アプリケーションログを logger に統一する。

完了条件:

- 秘密情報がログへ出ない。
- 環境依存 ID がソースコードへ直書きされていない。
- ログ出力方法が統一される。

### 9. 既知のロジック・保守上の問題

ステータス: `DONE`（P0〜P1）

候補:

- `sendEmbedsToChannel()` が受け取る `threadId` が送信処理で使われていない。
- 場所取りリマインドは練習ごとのループ内で対象全件を列挙しており、重複通知になる可能性がある。
- `getConfig('countdown_channelid') ?? ...` は、左辺がキー不存在時に例外を投げるため fallback として機能しない。
- `src/services/notion/kondate.ts`、`src/constants.ts`、一部の型・関数は未使用の可能性がある。
- `process.exit()` がサービス内部にあり、テストと後片付けを難しくしている。

対処法:

- P0 で各挙動の期待値をテストまたは利用箇所調査により確定する。
- バグ修正はリファクタリングと分離し、変更理由が明確な単位で実施する。
- 未使用コードは参照、運用用途、将来用途を確認して `DONE` または `WONTFIX` を記録する。

## Phase 計画

### P0: 現状固定と安全網

ステータス: `DONE`

- [x] `lint` script を追加する。
- [x] `typecheck` script を追加する。
- [x] ESLint 18 errors / 4 warnings を分類する。
- [x] 自動修正可能な formatting と未使用コードを整理する。
- [x] Config の characterization test を追加する。
- [x] Countdown の日数計算・通知判定テストを追加する。
- [x] Practice の取得・通知文・リマインドテストを追加する。
- [x] Cron のジョブ登録・非同期エラーテストを追加する。
- [x] Web app の生成・起動・停止テストを追加する。
- [x] App bootstrap の現状挙動をテスト可能な範囲で固定する。
- [x] 既知のロジック問題について、期待仕様を記録する。
- [x] `npm run typecheck`、`npm run lint`、`npm test` を成功させる。

P0 では原則としてアーキテクチャ変更を行わない。ただし、テスト可能性を確保するための最小限の dependency injection や export 追加は許容し、理由を判断記録へ残す。

### P1: 低リスクな整理

ステータス: `DONE`

- [x] 命名、format、import、エラー型を整理する。
- [x] 秘密情報を含み得るログを削除する。
- [x] ハードコード ID を設定へ移す。
- [x] Cron の未 await を修正する。
- [x] status page の静的アセットを分離する。
- [x] 未使用コードを削除または `WONTFIX` として記録する。
- [x] 既知の小規模なロジック不具合をテスト付きで修正する。

### P2: 起動とライフサイクル

ステータス: `DONE`

- [x] `createApplication()` を導入する。
- [x] Web、Discord、Cron の `start()` / `stop()` を明示する。
- [x] コンストラクタの外部副作用を除去する。
- [x] SIGINT / SIGTERM の graceful shutdown を追加する。
- [x] 起動途中の失敗時に rollback する。

### P3: Discord コマンド境界

ステータス: `DONE`

- [x] `CommandContext` を導入する。
- [x] Message / Slash adapter を実装する。
- [x] コマンドを機能単位のモジュールへ分割する。
- [x] 権限定義を一元化する。
- [x] `createMessageAdapter()` と危険な型アサーションを削除する。

### P4: 設定管理

ステータス: `DONE`

- [x] Config key/value を型付けする。
- [x] Config store と Notion repository を分離する。
- [x] 複数設定の一括更新を導入する。
- [x] 設定エラーを分類する。
- [x] グローバル `config` 依存を段階的に除去する。

### P5: 機能単位への再配置

ステータス: `DONE`

- [x] Countdown を移行する。
- [x] Practice を移行する。
- [x] Collection（集金）を移行する。
- [x] Breakout を移行する。
- [x] Relay を移行する。
- [x] Sesame を移行する。
- [x] `Services` を廃止または bootstrap 内へ限定する。

### P6: 運用安定性

ステータス: `DONE`

- [x] Cron の重複実行防止を追加する。
- [x] 外部 API の timeout / retry 方針を統一する。
- [x] 構造化 health 状態を導入する。
- [x] CI で typecheck / lint / test を必須化する。
- [x] 新構成と開発手順を文書化する。

## 進捗ログ

### 2026-08-02: 計画作成

- リポジトリ構成、主要依存、ファイルサイズ、テスト、lint 状況を確認した。
- `npm test` は 21 件すべて成功した。
- ESLint は 18 errors / 4 warnings であることを確認した。
- Phase P0〜P6 と、修正箇所ごとの問題・対処法・完了条件を作成した。
- コード変更はまだ行っていない。

### 2026-08-02: P0 着手

- P0「現状固定と安全網」を開始した。
- 品質チェック用 npm script、既存の ESLint 違反、テスト可能な境界を順に整備する。
- アーキテクチャ変更や外部仕様変更は P0 の対象外とする。

### 2026-08-02: P0 品質ゲート整備

- `npm run lint` と `npm run typecheck` を追加した。
- ESLint の内訳は formatting 11 件、未使用要素 4 件、元エラーを失う再throw 3 件、明示的 `any` 4 件だった。
- formatting と未使用要素を整理し、再throw へ `cause` を付与した。
- 外部入力の型を `any` から `unknown` と型ガードへ変更した。
- ESLint は 18 errors / 4 warnings から 0 errors / 0 warnings になった。
- `npm run typecheck` と `npm run lint` が成功した。

### 2026-08-02: P0 characterization test 追加

- Config の読み込み、取得、Notion 更新、property mapping を固定した。
- Countdown の JST 日数計算、通知文置換、通知日判定を固定した。
- Practice の Notion page mapping、曜日変換、例外 cause、通知処理を固定した。
- Cron の JST schedule、二重登録防止フラグ、非同期通知エラーの包含を固定した。
- Web server の health / status response と stop を固定した。
- `app.ts` を直接実行した場合だけ自動起動するようにし、`main()` へ初期化関数を注入できる最小限のテスト seam を追加した。通常の `node dist/app.js` による起動仕様は維持される。
- テストは 21 件から 37 件へ増加し、追加後の全 37 件が成功した。

### 2026-08-02: P0 完了

- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（37 tests / 37 passed / 0 failed）
- `git diff --check`: 成功
- P0 の全チェック項目を完了した。
- P1 以降の既知問題は「P0 既知問題の調査結果と期待仕様」へ引き継いだ。
- commit / push は行っていない。

### 2026-08-02: P1 着手

- P1「低リスクな整理」を `codex/refactor-p1-low-risk-cleanup` ブランチで開始した。
- P0 の 37 テストを回帰防止の基準とする。
- 挙動変更を伴う既知問題は、先に望ましい期待値をテストへ定義してから修正する。
- P2 以降のライフサイクル・依存構造変更は行わない。

### 2026-08-02: P1 既知不具合の修正

- 望ましい期待値を先にテストへ追加し、修正前に5件の失敗を確認した。
- Countdown channel が未設定の場合に general channel へ fallback するよう修正した。
- Countdown と Sesame の Cron callback が非同期処理の完了まで待つよう修正した。
- Embed の `threadId` が指定された場合に対象 thread へ送信するよう修正した。
- 場所取りリマインドを施設・日付単位でまとめ、無関係な練習の重複列挙を解消した。
- Breakout room の作成・削除・メンバー移動と、Relay thread へのメンバー追加で Promise の完了を待つよう修正した。

### 2026-08-02: P1 ログ・設定・未使用コード整理

- Config の値一覧、Discord token の先頭部分、Relay message 本文、Sesame URL / API response のログ出力を除去した。
- アプリケーションログを Logger へ集約した。Logger から Discord への転送失敗だけは再帰的な `discordLog` 発火を避けるため、意図的に直接 stderr へ出力する。
- Logger API を実態に合わせて同期メソッドへ変更した。
- Logger channel ID を `DISCORD_LOGGER_CHANNEL_ID` 環境設定へ移した。既存環境の挙動を維持するため従来値をdefaultとする。
- リポジトリ内に参照がない `kondate.ts`、`constants.ts`、Discord の未使用型・型拡張、不要な global ProcessEnv 拡張、`updateChannelTopic()` を削除した。
- `getRelayGuildMember()` を返却内容が明確な `getRelayGuildMemberIds()` へ改名した。

### 2026-08-02: P1 status page 分離

- 773行だった `statusPage.ts` からHTML / CSS / JavaScriptを `assets/status.html` へ移した。
- `statusPage.ts` は status API の型定義31行だけになった。
- build 時に Web asset 一式を `dist/services/webapi/assets` へコピーするよう変更した。
- 開発時とbuild後の両方で `__dirname/assets` を参照するよう配信パスを統一した。
- `/` のHTMLと `/assets/status-operational.png` の配信テストを追加した。

### 2026-08-02: P1 完了

- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（41 tests / 41 passed / 0 failed）
- `git diff --check`: 成功
- P1 の全チェック項目を完了した。
- P2 以降のライフサイクル・依存構造変更は行っていない。
- commit / push は行っていない。

### 2026-08-02: P2 着手

- P2「起動とライフサイクル」を開始した。
- Applicationによる起動順序、逆順停止、起動失敗時rollbackを先に実装する。
- Web / Cron / Discordのコンストラクタから外部起動を除き、明示的な `start()` / `stop()` に統一する。
- P2の品質ゲート完了後にP3へ進む。

### 2026-08-02: P2 完了

- `Application` と `createApplication()` を追加し、依存の組み立てをbootstrapへ移した。
- Discord → Cron → Webの順で起動し、Web → Cron → Discordの逆順で停止する。
- 起動途中の失敗時に開始済みコンポーネントをrollbackし、停止失敗があっても残りの停止を継続する。
- Web constructorからlistenを除去し、Cron taskを停止・破棄できるようにした。Discordは`destroy()`を呼ぶ`stop()`を追加した。
- SIGINT / SIGTERM / unhandledRejection handlerを直接実行時だけ登録し、テストから解除可能にした。
- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（46 tests / 46 passed / 0 failed）
- P3「Discord コマンド境界」へ移行する。

### 2026-08-02: P3 完了

- Discord.jsに依存しない `CommandContext`、`CommandOperations`、`CommandPermission` を追加した。
- Message / Slash adapterがDiscord固有オブジェクトを共通contextへ変換する。
- Breakout / Delete / Countdown / Reload / Sesame / Version / Profile / Practice / Shukin commandからDiscord `Message`依存を除去した。
- MessageとSlashの権限判定を共通定義へ集約し、Discord permission bitへの変換をadapterへ限定した。
- Slash commandを偽の`Message`へ変換していた `createMessageAdapter()` と `as unknown as Message` を削除した。
- MessageとSlashで同じVersion commandを実行するテスト、Slash BreakoutがMessageなしで動作するテストを追加した。
- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（48 tests / 48 passed / 0 failed）
- P4「設定管理」へ移行する。

### 2026-08-02: P4 完了

- 設定キーと値の対応を `ConfigKey` / `ConfigValueMap` として型付けし、通知日は `number[]` として取得するようにした。
- インメモリ値と検証を `ConfigStore`、Notion の読み書きと property mapping を `NotionConfigRepository` へ分離した。
- `ConfigurationService.updateMany()` は永続化成功後だけruntime値を反映し、Notionの途中失敗時は更新済みpageをbest-effortでrollbackする。
- 設定不存在、不正値、永続化障害を個別のエラー型へ分類した。
- 旧 `getConfig()` / `setConfig()` / 公開Map操作を廃止し、利用側を型付き `get()` / `getOptional()` / `updateMany()` へ移行した。
- repository境界、型変換、永続化失敗時のruntime不変、Notion部分更新のrollbackをテストした。
- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（50 tests / 50 passed / 0 failed）
- P5「機能単位への再配置」へ移行する。

### 2026-08-02: P5 完了

- Countdown / Practice / Collection / Breakout / Relay / Sesame を技術別 `services/` から `features/` 配下へ再配置した。
- Countdown の通知送信・Bot activity、Practice のrepository・通知送信、Command、Sesame Discord連携に用途別の小さなinterfaceを導入した。
- 全機能を具象サービスへ結合していた `Services` 型を削除した。具象 `ServiceContainer` の定義と生成はbootstrapに限定し、機能コードはbootstrapへ依存しない。
- Discord / Notion SDKを扱うコードと、機能ユースケース・commandの配置を明確にした。
- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（50 tests / 50 passed / 0 failed）
- `git diff --check`: 成功
- P6「運用安定性」へ移行する。

### 2026-08-02: P6 完了

- `ScheduledJob` を導入し、同一jobの前回実行中は次回実行をskipする。成功・失敗・所要時間・skip回数を `HealthRegistry` へ記録する。
- 外部HTTP GETは10秒timeout、最大3attempt、指数backoffへ統一した。Notion SDKは10秒timeoutとSDK標準の対象に対する最大2retryを明示した。
- retryは冪等な取得処理へ限定し、Discord送信やNotion更新などの書き込みは一律retryしない方針をREADMEへ記録した。
- `/health` を構造化JSONへ変更し、`/api/status` とともに最終成功、最終失敗、所要時間、失敗内容、skip回数を返すようにした。
- Pull Requestとmain pushで `typecheck` / `lint` / `test` を実行するGitHub Actions workflowを追加した。
- feature-first構成、設定境界、起動停止、運用ポリシー、開発手順を `README.md` に記載した。
- 最終監査で下位サービスに残っていた `process.exit()` を除去し、例外とbootstrapの `process.exitCode` に統一した。
- `npm run typecheck`: 成功
- `npm run lint`: 成功（0 errors / 0 warnings）
- `npm test`: 成功（54 tests / 54 passed / 0 failed）
- `git diff --check`: 成功
- 禁止・旧境界検索（`Services`, `getConfig`, `setConfig`, `createMessageAdapter`, `as unknown as Message`, 下位層の `process.exit()`）: 該当なし

## P0 既知問題の調査結果と期待仕様

| 項目 | 現在の挙動・根拠 | 期待仕様 | 対応 Phase |
| --- | --- | --- | --- |
| Embed の `threadId` | `sendEmbedsToChannel()` は `threadId` を渡すが、`sendContentToChannel()` は値を利用しない | `threadId` が指定された場合は対象 thread へ送信する。不要な引数なら API から削除するが、利用意図を先に確認する | P1 |
| 場所取りリマインド | 対象練習ごとに1通送る一方、各メッセージへ対象全練習の一覧を繰り返し含める。`practice.test.cjs` で現状を固定した | 同一施設・同一日単位でまとめ、各メッセージには該当グループだけを含める | P1 |
| Countdown channel fallback | `getConfig('countdown_channelid')` は不存在時にthrowするため、後続の `?? discord_general_channelid` は fallback として機能しない | Countdown channel が未設定の場合は general channel を利用する。設定取得 API の optional / required を区別する | P1、P4 |
| Cron の未 await | Countdown の定期callback、`sendCountdownMessage()`、Sesame の `.then()` に完了を待たない経路がある | Cron callback はジョブ完了まで await し、rejection をジョブログへ記録する | P1 |
| 内部 `process.exit()` | env、Notion、Discord、app の各層から直接終了する | 下位サービスは例外を返し、終了コードの決定と後片付けは bootstrap が担当する | P2 |
| 秘密値ログ | Discord login failure の診断情報へ token 先頭10文字を含める | token は一部分もログへ出さない | P1 |
| 未使用候補 | `kondate.ts` と `constants.ts` はリポジトリ内参照なし。`updateChannelTopic()` は定義とexportのみ | 運用上の外部利用がないことを確認した上で削除する。確認不能なら用途を文書化して保持する | P1 |

P0 では上記の挙動変更を行わない。P1 でテストの期待値を先に望ましい仕様へ変更し、修正がテストを満たす形で対応する。

## 判断記録

### ADR-001: 機能単位のモジュラーモノリスを目標とする

ステータス: 採用

理由:

- 現在の規模では、複数サービスへの分割や重い DDD 構成は運用コストが大きい。
- Discord / Notion の技術単位より、Countdown / Practice など変更理由が同じコードをまとめる方が保守しやすい。
- 外部サービスとの境界には小さなインターフェースを置き、単体テストを可能にする。

### ADR-002: P0 では既存挙動の固定を優先する

ステータス: 採用

理由:

- 現状のテスト対象が限定的であり、大規模な構造変更前に回帰検知能力を高める必要がある。
- P0 で発見したバグ候補は、期待仕様を確定してから P1 以降で修正する。

### ADR-003: P0 の bootstrap seam は最小限にする

ステータス: 採用

理由:

- 従来の `app.ts` は import だけで全サービスを起動するため、bootstrap の単体テストができなかった。
- `require.main === module` の guard と初期化関数の注入だけを追加し、通常起動時の初期化順序やサービス構成は変更しない。
- start / stop の本格的なライフサイクル整理は P2 で実施する。

### ADR-004: 参照のない到達不能コードをP1で削除する

ステータス: 採用

理由:

- `kondate.ts`、`constants.ts`、Discord の未使用型と型拡張は、リポジトリ内に import / 呼び出しがなく、アプリケーションの公開entry pointから到達不能だった。
- 保持すると新構成へ移行する際の対象範囲とハードコード設定を誤認させるため、P1で削除した。
- 将来必要になった場合はGit履歴から仕様を確認できる。

### ADR-005: status pageをコンパイル対象から分離する

ステータス: 採用

理由:

- HTML / CSS / JavaScript はTypeScriptの型検査対象ではなく、巨大なtemplate literalとして保持する利点がない。
- 静的ファイルとして配信し、API snapshot型だけをTypeScriptに残す。
- asset copyとHTTP配信をテストし、実行環境によるpath差異を防ぐ。

## ブロッカー・ユーザー判断待ち

現在なし。
