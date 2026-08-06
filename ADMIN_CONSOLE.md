# 設定・管理画面 運用手順

実装仕様は [ADMIN_CONSOLE_SPEC.md](./ADMIN_CONSOLE_SPEC.md) を参照する。この文書はデプロイ時と日常運用の手順だけを扱う。

## 1. 既定状態

管理画面は既定で無効である。

```env
ADMIN_ENABLED=false
```

この状態では `/admin` の認証ルート、管理画面、ログインリンク更新 Cron を有効にしない。既存の Discord、Notion、Webhook、ステータスページの動作は維持される。

## 2. Notion 側の準備

1. 管理者だけが閲覧できる Notion ページを作る。
2. ページ内に、管理画面リンク専用の paragraph または callout ブロックを一つ作る。
3. そのブロックを既存の Glineze Notion Integration と共有する。
4. ブロック ID を取得し、`ADMIN_NOTION_LOGIN_BLOCK_ID` に設定する。

ログインリンクは認証情報として機能する。ページを Web 公開したり、管理者以外へ共有したりしない。

## 3. 環境変数

管理画面を有効にする場合は、次を設定する。

```env
ADMIN_ENABLED=true
ADMIN_BASE_URL=https://your-glineze.example
ADMIN_AUTH_SECRET=<32 byte以上のランダムな秘密値>
ADMIN_NOTION_LOGIN_BLOCK_ID=<NotionブロックID>
ADMIN_TOKEN_ROTATION_CRON=5 4 * * *
ADMIN_TOKEN_TTL_HOURS=48
ADMIN_SESSION_TTL_HOURS=12
```

秘密値は、たとえば次のように生成できる。

```sh
openssl rand -base64 48
```

- `ADMIN_BASE_URL` は HTTPS のオリジンだけを指定する。認証情報、パス、クエリ、フラグメントは含めず、末尾の `/` は任意。
- Cron のタイムゾーンは `Asia/Tokyo`。
- ログインリンクは既定で毎日 4:05 に更新され、48時間有効。
- セッションは既定で12時間有効。
- アプリケーション再起動時はメモリ上のセッションが失効するため、Notion のリンクから再ログインする。

## 4. 初回起動確認

1. アプリケーションを起動する。
2. ログにトークンそのものが出ていないことを確認する。
3. Notion の対象ブロックが `Glineze 管理画面を開く` に更新されることを確認する。
4. リンクを開き、ログイン後の URL が `/admin` になり、クエリにトークンが残らないことを確認する。
5. ダッシュボードと各設定画面を確認する。
6. 秘密値が値ではなく `設定済み` と表示されることを確認する。

## 5. 日常運用

- 設定変更はカテゴリごとの画面から行う。
- Sesame の秘密値を維持する場合、秘密値入力欄は空のまま保存する。
- 練習連絡テンプレート変更後は、プレビューを確認してから再読込する。
- Configuration DB を Notion から直接変更した場合は、管理画面の「設定再読込」を実行する。
- ログインリンクが更新されていない場合は、認証済み管理画面から手動更新する。

## 6. 障害時

### Notion リンク更新に失敗する

- Notion Integration が対象ブロックへアクセスできるか確認する。
- ブロックが paragraph または callout であることを確認する。
- `ADMIN_NOTION_LOGIN_BLOCK_ID` を確認する。
- 既存リンクは上書きされない。期限内なら既存リンクを使用できる。

### 全セッションを失効させたい

`ADMIN_AUTH_SECRET` を新しい値へ交換し、アプリケーションを再起動する。既存ログイントークンと既存セッションは利用できなくなる。再起動後、Notion に新しいリンクが発行されることを確認する。

### 管理画面を緊急停止したい

`ADMIN_ENABLED=false` にしてアプリケーションを再起動する。Notion ページに残ったリンクも利用できなくなる。

## 7. セキュリティ上の制約

- Notion ページを閲覧できる人を一律に管理者として扱う。
- 個人単位の操作人物は特定できない。
- 個人単位の失効、監査、MFA が必要になった場合は Discord OAuth2 等へ移行する。
- `.env` の値は管理画面から変更できない。
- トークン、セッション ID、CSRF トークン、設定値の変更前後はログへ記録しない。

## 8. リリース前検証

```sh
npm run typecheck
npm run lint
npm test
```

すべて成功した状態でリリースする。
