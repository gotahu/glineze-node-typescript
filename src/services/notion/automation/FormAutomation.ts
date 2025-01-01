import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionAutomationWebhookEvent, Services } from '../../../types/types';
import {
  areUUIDsEqual,
  getRelationPropertyValue,
  getStringPropertyValue,
  queryAllDatabasePages,
} from '../../../utils/notionUtils';

export async function handleAddRowToFormAutomation(
  event: NotionAutomationWebhookEvent,
  services: Services
) {
  const { notion } = services;

  // ページ情報
  const page = event.data;

  // 団員プロパティを取得
  const memberRelation = await getRelationPropertyValue(notion.client, page, '団員');

  if (!memberRelation || memberRelation.length === 0) {
    throw new Error('団員が見つかりません');
  }

  // 団員情報を取得
  const member = memberRelation[0];
  const name = getStringPropertyValue(member, '名前');

  // 親がデータベースではない場合（ありえないが）
  if (page.parent['type'] !== 'database_id') {
    throw new Error('親ページがデータベースではありません');
  }

  const databaseId = page.parent.database_id;
  const pages = await queryAllDatabasePages(notion.client, databaseId, {
    property: '名前',
    title: {
      equals: name,
    },
  });

  // オートメーションで通知された新規ページではなく、もともとあるページを探す
  const originalPage = pages.find((p) => !areUUIDsEqual(p.id, page.id));

  // もともとあるページがある場合
  if (originalPage) {
    // ページを削除
    await notion.client.pages.update({
      page_id: originalPage.id,
      archived: true,
    });

    console.log(`ページを削除しました: ${page.id}`);
  }
}
