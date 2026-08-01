# Glineze Node TypeScript

Discord、Notion、Sesame、Web APIを一つのプロセスで運用するBotです。コードは外部サービス別ではなく、変更理由が同じ機能をまとめるfeature-first構成を採用しています。

## 構成

```text
src/
├── bootstrap/          # 具象サービスの生成、起動順序、graceful shutdown
├── features/           # Countdown、Practice、Collection、Breakout、Relay、Sesame
├── adapters/           # Notionなど外部サービスの永続化adapter
├── services/           # Discord/Cron/Web/Notion SDKとの実行時境界
├── shared/             # Config、health、retryなど機能横断の部品
├── types/              # 共有domain type
└── utils/              # 日付、ログ、Notion property mapper
```

機能コードは `bootstrap/ServiceContainer` に依存せず、必要な操作だけを小さなinterfaceとして受け取ります。具象サービスの組み立ては `createApplication()` に限定しています。

## 開発

Node.js 22以上を使用します。`.env` に必要な値を設定してから実行してください。

```bash
npm install
npm run start:dev
```

変更前後の品質ゲートは次の3つです。

```bash
npm run typecheck
npm run lint
npm test
```

Pull Requestとmainへのpushでは同じ3項目をGitHub Actionsで実行します。

## 設定

- 起動に必要な秘密値と機能フラグは環境変数から読み込みます。
- 運用中に変更するBot設定はNotionから `ConfigRepository` 経由で読み込みます。
- 利用側は型付き `config.get()` / `getOptional()` を使います。
- 複数設定は `updateMany()` で更新し、永続化に失敗した場合はruntime値を変更しません。

## 起動と停止

`createApplication()` が Discord → Cron → Web の順で起動し、停止時は逆順に終了します。SIGINT / SIGTERM、起動途中の失敗では、開始済みコンポーネントを安全に停止します。

## 運用安定性

- Cron jobは `ScheduledJob` を通し、前回実行中の重複起動をskipします。
- 外部HTTP GETは10秒timeout、最大3attempt、指数backoffを標準とします。
- Notion SDKも10秒timeoutと最大2retryを設定します。
- Discordの書き込みなど非冪等操作は共通retryの対象にせず、呼び出し元で個別判断します。
- `/health` と `/api/status` は、最終成功時刻、最終失敗、所要時間、skip回数を含む実測healthを返します。

詳細なPhase計画、問題点、判断記録、検証履歴は [REFACTORING.md](./REFACTORING.md) を参照してください。
