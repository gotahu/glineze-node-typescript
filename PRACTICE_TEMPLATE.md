# 練習連絡テンプレート

練習連絡は、Notion の Formula プロパティではなく、アプリが Notion の各プロパティと
relation 先ページを読み取って生成します。テンプレートは Notion ページ上で編集できます。

## セットアップ

1. Notion にテンプレート専用ページを作成します。configuration DB の設定レコード自身のページ本文も使用できます。
2. ページ直下にコードブロックを **1個だけ** 作成し、テンプレートを記入します。
3. integration にそのページの読み取り権限を付与します。
4. configuration DB に次の設定を追加します。

| key                                      | value                  |
| ---------------------------------------- | ---------------------- |
| `practice_announcement_template_page_id` | テンプレートページのID |

5. Discord で `/practice-template reload` を実行します。
6. `/practice-template preview` で翌日の実データを使った表示を確認します。

設定がない場合は組み込みテンプレートが使われます。Notion ページの取得または検証に
失敗した場合、稼働中の最終正常版は置き換えられません。

## テンプレート例

<!-- prettier-ignore -->
````markdown
```markdown
@全員
## {{dateLabel}} 練習連絡

### 時間
- {{timeText}}で実施します。
- **遅刻、早退、欠席**が変更になった人は__パトマネさんに連絡__してください！

### 場所
{{placeText}}

### TT
{{ttText}}

### 持ち物
- 飲み物
- 楽譜

### Notion（FB・録音）
{{notionUrl}}
```
````

テンプレートでは任意のコードを実行できません。次の固定プレースホルダーだけを使用できます。

| プレースホルダー      | 内容                                       |
| --------------------- | ------------------------------------------ |
| `{{dateLabel}}`       | `8/5(水)` 形式の練習日                     |
| `{{timeText}}`        | 「時間フォーマット」。空の場合は「時間」   |
| `{{placeText}}`       | 場所名、部屋、アクセスを改行で結合したもの |
| `{{placeNames}}`      | relation「練習場所」のページ名             |
| `{{room}}`            | 部屋                                       |
| `{{accessText}}`      | relation 先の「アクセス」                  |
| `{{programText}}`     | 練習内容                                   |
| `{{teachersText}}`    | 先生方の名前                               |
| `{{teachersNotice}}`  | `＊○○先生がいらっしゃいます。` 形式の文章  |
| `{{publicityText}}`   | 情宣担当者名                               |
| `{{publicityNotice}}` | `＊渉外（○○）` 形式の文章                  |
| `{{ttText}}`          | 練習内容、先生方、情宣を改行で結合したもの |
| `{{title}}`           | 練習ページのタイトル                       |
| `{{pageId}}`          | ハイフンを除いた練習ページID               |
| `{{notionUrl}}`       | 練習ページのNotion URL                     |

値がないプレースホルダーは空文字になります。レンダリング後のメッセージが2,000文字を
超えた場合は送信せず、エラーとして扱います。

## 反映コマンド

- `/practice-template preview`: キャッシュ中のテンプレートを実データでプレビューします。
- `/practice-template reload`: Notion から読み直し、検証に成功した場合だけ反映します。
- `/practice-template status`: 組み込み版と Notion 版のどちらを使用しているか表示します。
- `/reload`: 通常のconfigと一緒にテンプレートも再読み込みします。

これらは管理者専用コマンドです。Notion の編集中内容は、reload するまで定期送信へ反映されません。
