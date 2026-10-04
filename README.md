# Glineze

Discordの通知やコマンド、Notionのデータ取得、Cronによる定期処理をまとめたTypeScriptアプリケーションです。ExpressでWeb APIとステータスページ、設定・管理画面を提供します。

## 開発環境の準備

Node.jsのバージョンはDockerfileとCIの設定を参照してください。依存パッケージをインストールし、環境変数のサンプルをコピーしてください。

```sh
npm ci
cp .env.example .env
```

`.env`にDiscordとNotionの認証情報を設定し、`NOTION_CONFIGURATION_DATABASEID`に設定用データベースのIDを指定してください。設定用データベースでは`key`と`value`プロパティを読み取ります。利用する機能の設定キーは[src/config/definitions.ts](./src/config/definitions.ts)で確認できます。

Discordへのログ送信が必要な場合は、`DISCORD_LOG_CHANNEL_ID`に送信先のチャンネルIDを設定してください。未設定の場合はDiscordへログを送信しません。

```sh
npm run dev
```

開発環境では管理画面を利用できます。本番環境での有効化と認証設定は[管理画面の運用手順](./ADMIN_CONSOLE.md)を参照してください。練習連絡の編集方法は[練習連絡テンプレート](./PRACTICE_TEMPLATE.md)に記載しています。

## ビルドと検証

```sh
npm run typecheck
npm run lint
npm test
```

`npm test`はビルド後にテストを実行します。本番起動には次のコマンドを使用してください。

```sh
npm run build
npm start
```

本番起動では、`.env`があれば読み込みます。Dockerなどで環境変数を外部から渡す場合は、`.env`がなくても起動できます。Dockerビルドに含めるのは、ソース、パッケージ定義、TypeScript設定だけです。

## 一般向けの稼働状況ページ

`/`でサービス状態とDiscordの利用状況を公開します。管理画面と同じDADSの配色・フォーカス表示を採用し、システム指標は「システムの詳細」から確認できます。自動更新は15・30・60秒から選択でき、停止や手動更新も可能です。取得に失敗した場合は、前回の表示を維持して再試行の案内を表示します。時刻と日次集計は日本時間です。

## GitHub Actionsによるデプロイ

`main`へのpushまたは手動実行で、Tailscale経由でCoolifyのデプロイを開始します。リポジトリまたは`production`環境に次のGitHub Actions設定を登録してください。

| 種類      | 名前                 | 内容                                         |
| --------- | -------------------- | -------------------------------------------- |
| Secrets   | `COOLIFY_URL`        | Coolifyの接続先URL                           |
| Secrets   | `COOLIFY_APP_UUID`   | デプロイ対象のアプリUUID                     |
| Secrets   | `TS_TAGS`            | Tailscale接続時に使用するタグ                |
| Secrets   | `TS_OAUTH_CLIENT_ID` | TailscaleのOAuthクライアントID               |
| Secrets   | `TS_AUDIENCE`        | Tailscaleの認証に使用するaudience            |
| Secrets   | `COOLIFY_TOKEN`      | CoolifyのAPIトークン                         |
| Variables | `GLINEZE_PUBLIC_URL` | 公開URL（例: `https://glineze.hinyari.net`） |

接続先、アプリUUID、タグの保存先はGitHub ActionsのSecretsです。ソースには直接記載しません。

投入後は、公開URLのヘルスチェックと、一般向けページ・管理画面のCSSが対象コミットと一致することを確認します。

## 公開するファイル

ソース、テスト、依存パッケージのロックファイル、設定サンプル、運用手順を追跡します。認証情報を含む`.env`、エディタ設定、作業台帳、QA記録と画面キャプチャ、生成物は追跡から除外します。
