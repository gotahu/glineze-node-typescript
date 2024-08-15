import { NotionDiscordPairInfo, ShukinInfo, ShukinReply } from '../types/types';
import { getConfigurationValue, notionClient } from './notion-client';
import { logger } from '../utils/logger';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export const retrieveNotionAndDiscordPair = async (
  discordId: string
): Promise<NotionDiscordPairInfo> => {
  const pairsDatabaseId = await getConfigurationValue('discord_and_notion_pairs_databaseid');

  if (!pairsDatabaseId) {
    logger.error('pairsDatabaseId is not found.');
    return undefined;
  }

  const query = await notionClient.databases.query({
    database_id: pairsDatabaseId,
    filter: {
      property: 'Discord', // ハードコードしている
      rich_text: {
        equals: discordId,
      },
    },
  });

  if (!query) {
    logger.error('info: NotionとDiscordのペア情報なし');
    return undefined;
  }

  const result = query.results[0] as PageObjectResponse;

  const pair = {
    notionPageId: result.id,
    discordUserId: discordId,
    name: '',
  } as NotionDiscordPairInfo;

  pair['notionPageId'] = result.id;

  Object.entries(result.properties).forEach(([, prop]) => {
    if (prop.type === 'title' && prop.title) {
      pair['name'] = prop.title[0].plain_text;
    }
  });

  console.debug(pair);

  return pair;
};

export const retrieveShukinStatus = async (discordId: string): Promise<ShukinReply> => {
  const shukinDatabaseId = await getConfigurationValue('shukin_databaseid');

  if (!shukinDatabaseId) {
    logger.error('shukinDatabaseId is not found.');
    return {
      status: 'error',
      message:
        '集金DBが見つかりませんでした。config に正しい値がセットされていない可能性があります。マネジに連絡してください。',
    };
  }

  const pair = await retrieveNotionAndDiscordPair(discordId);

  if (!pair) {
    logger.error('info: NotionとDiscordのペア情報なし');
    return {
      status: 'error',
      message: `Notion上の団員名簿DBにあなたのDiscord IDが適切に登録されていません。マネジに連絡してください。\n${discordId}`,
    };
  }

  // 集金データベースを検索
  const query = await notionClient.databases.query({
    database_id: shukinDatabaseId,
    filter: {
      // リレーション「団員」プロパティをUUIDで検索
      property: '団員',
      relation: {
        contains: pair.notionPageId,
      },
    },
  });

  if (query.results.length === 0) {
    logger.error('info: 集金DBに該当データなし');
    return {
      status: 'error',
      message:
        'Notion上の集金DBにあなたのデータが見つかりませんでした。整備が完了していない可能性があります。マネジに連絡してください。',
    };
  }

  // 一件しかないはずなので、最初のやつを取得
  const queryResult = query.results[0] as PageObjectResponse;
  console.debug(queryResult);

  const shukinList = [] as ShukinInfo[];

  Object.entries(queryResult.properties).forEach(([key, prop]) => {
    // プロパティのタイプが number かつ、集金額が入っている場合
    // 0円または空白の場合は集金対象外となっている、と考え、標示しない
    if (prop.type === 'number' && prop.number) {
      console.debug('number', prop.number);
      const statusProperty = queryResult.properties[key + 'ステータス'];
      console.log(key + 'ステータス', statusProperty);
      if (statusProperty.type === 'status' && statusProperty.status) {
        shukinList.push({
          shukinName: key,
          shukinAmount: prop.number + '円',
          shukinStatus: statusProperty.status.name,
        });
      }
    }
  });

  let replyMessage = `${pair.name} さんの集金状況をお知らせします。\n### 集金状況`;

  replyMessage += shukinList.map((v) => {
    return `\n- ${v.shukinName}：${v.shukinAmount}（${v.shukinStatus}）`;
  });

  if (shukinList.length === 0) {
    replyMessage += '\n- 集金対象がありません。';
  }

  replyMessage +=
    '\n### 注意事項\n- （受取済）（振込済）の場合、パトマネさんが受け取ったあと、会計さんが確認中です。';
  replyMessage += '\n- （受取確認済）（振込確認済）の場合、会計さんの確認まで全て終了しています。';

  return {
    status: 'success',
    message: replyMessage,
  };
};
