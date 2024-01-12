import { getConfigurationValue, notionClient, queryAllDatabasePages } from './notion-client';

export type LINEDiscordPairInfo = {
  name: string;
  line_group_id: string;
  discord_channel_id: string;
  line_notify_key: string;
};

/**
 * LINEとDiscordのペアをNotionデータベースから取得します。
 * 指定されたデータベースIDを使用してデータベースをクエリし、ペアの情報を取得します。
 *
 * @returns {Promise<LINEDiscordPairInfo[]>} LINEとDiscordのペア情報を含むオブジェクトの配列を返すPromise。
 * @throws {Error} データベースIDが見つからない、またはデータベースにアクセスできない場合にエラーを投げます。
 */
export const retrieveLINEAndDiscordPairs = async (): Promise<LINEDiscordPairInfo[]> => {
  // LINEとDiscordのペア情報が格納されているデータベースIDを取得します。
  const pairsDatabaseId = await getConfigurationValue('discord_and_line_pairs_databaseid');

  // データベースIDが見つからない場合はエラーを投げます。
  if (!pairsDatabaseId) {
    throw new Error('discord_and_line_pairs_databaseid is not found.');
  }

  // Notion APIを使用してデータベースをクエリします。
  const query = await queryAllDatabasePages(pairsDatabaseId);

  // データベースの結果が取得できない場合は空の配列を投げます。
  if (!query) {
    console.log('info: LINEとDiscordのペア情報なし');
    return [];
  }

  // LINEとDiscordのペア情報を格納する配列を初期化します。
  const pairs = [] as LINEDiscordPairInfo[];
  for (const page of query) {
    // 各ページのプロパティを解析し、ペア情報をオブジェクトとして構築します。
    const result = Object.keys(page.properties).reduce((acc: Partial<LINEDiscordPairInfo>, key) => {
      const prop = page.properties[key];

      // タイトルプロパティからペアの名前を抽出します。
      if (prop.type === 'title' && prop.title) {
        acc['name'] = prop.title[0].plain_text;
        // リッチテキストプロパティからその他の情報を抽出します。
      } else if (prop.type === 'rich_text' && prop.rich_text && prop.rich_text.length > 0) {
        if (key === 'line_group_id' || key === 'discord_channel_id' || key === 'line_notify_key') {
          acc[key] = prop.rich_text[0].plain_text;
        }
      }
      return acc; // 累積オブジェクトを返します。
    }, {});

    pairs.push(result as LINEDiscordPairInfo);
  }

  console.log(pairs);
  console.log(pairs.length + '組のDiscordとLINEペアを読み込みました。');

  return pairs;
};

type NotificationMessage = {
  messageId: string;
  userId: string[];
};

/**
 * 特定のメッセージIDに関連する通知メッセージをNotionデータベースから取得します。
 * メッセージIDが指定されている場合、そのIDに関連する通知のみを取得します。
 * 指定がない場合は、すべての通知を取得します。
 *
 * @param {string} [messageId] - 取得する通知メッセージのID（オプション）。
 * @returns {Promise<NotificationMessage[]>} 通知メッセージオブジェクトの配列を返すPromise。
 * @throws {Error} データベースIDが見つからない場合にエラーを投げます。
 */
export async function retrieveNotificationMessages(
  messageId?: string
): Promise<NotificationMessage[]> {
  // 通知メッセージが格納されているデータベースIDを取得します。
  const databaseId = await getConfigurationValue('notification_messages_databaseid');

  // データベースIDが見つからない場合はエラーを投げます。
  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  // メッセージIDに基づいたフィルタを設定します。
  const filter = messageId ? { property: 'messageId', title: { equals: messageId } } : undefined;
  // データベースから通知メッセージをクエリします。
  const query = await queryAllDatabasePages(databaseId, filter);

  console.log(query);

  // クエリ結果が空の場合、空の配列を返します。
  if (!query) {
    console.log('info: 通知対象メッセージなし');
    return [];
  }

  // 通知メッセージを格納する配列を初期化します。
  const pairs = [] as NotificationMessage[];
  for (const page of query) {
    const messageIdProperty = page.properties['messageId'];
    const userIdProperty = page.properties['userId'];

    // メッセージIDとユーザーIDが存在する場合、配列に追加します。
    if ('title' in messageIdProperty && 'rich_text' in userIdProperty) {
      const messageId = messageIdProperty.title[0].plain_text;
      const userId = userIdProperty.rich_text[0].plain_text;

      // 既存のペアを検索します。
      const existingPair = pairs.find((pair) => pair.messageId === messageId);
      console.log(existingPair);

      if (existingPair) {
        // 既に存在するペアにユーザーIDを追加します。
        existingPair.userId.push(userId);
      } else {
        // 新しいペアを作成し、配列に追加します。
        pairs.push({ messageId: messageId, userId: [userId] });
        console.log(pairs);
      }
    }
  }

  return pairs;
}

export async function addNotificationMessage(messageId: string, userId: string) {
  const databaseId = await getConfigurationValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  const query = await notionClient.pages.create({
    parent: {
      database_id: databaseId,
    },
    properties: {
      messageId: {
        title: [
          {
            type: 'text',
            text: {
              content: messageId,
            },
          },
        ],
      },
      userId: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: userId,
            },
          },
        ],
      },
    },
  });
}

/**
 * 指定されたメッセージIDとユーザーIDに基づいて、通知メッセージを削除します。
 * メッセージIDとユーザーIDが一致するページを検索し、該当ページを削除します。
 *
 * @param {string} messageId - 削除する通知メッセージのID。
 * @param {string} userId - 削除する通知メッセージのユーザーID。
 * @throws {Error} データベースIDが見つからない場合、または該当ページが見つからない場合にエラーを投げます。
 */
export async function deleteNotificationMessage(messageId: string, userId: string) {
  const databaseId = await getConfigurationValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  const searchResult = await notionClient.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: 'messageId',
          title: {
            equals: messageId,
          },
        },
        {
          property: 'userId',
          rich_text: {
            equals: userId,
          },
        },
      ],
    },
  });

  // 該当ページが見つからない場合はエラーを投げる
  if (searchResult.results.length === 0) {
    throw new Error(
      `Notification message with messageId ${messageId} and userId ${userId} not found.`
    );
  }

  // 該当ページを削除
  await notionClient.pages.update({
    page_id: searchResult.results[0].id,
    archived: true,
  });
}
