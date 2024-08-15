import { getConfigurationValue, notionClient, queryAllDatabasePages } from './notion-client';
import { LINEDiscordPairInfo, NotificationMessage } from '../types/types';
import { logger } from '../utils/logger';

export const retrieveLINEAndDiscordPairs = async (): Promise<LINEDiscordPairInfo[]> => {
  const pairsDatabaseId = await getConfigurationValue('discord_and_line_pairs_databaseid');

  if (!pairsDatabaseId) {
    logger.error('discord_and_line_pairs_databaseid is not found.');
    throw new Error('discord_and_line_pairs_databaseid is not found.');
  }

  const query = await queryAllDatabasePages(pairsDatabaseId);

  if (!query) {
    logger.info('info: LINEとDiscordのペア情報なし');
    return [];
  }

  const pairs = query.reduce((acc: LINEDiscordPairInfo[], page) => {
    const pair = Object.entries(page.properties).reduce(
      (pairAcc: Partial<LINEDiscordPairInfo>, [key, prop]) => {
        if (prop.type === 'title' && prop.title) {
          pairAcc['name'] = prop.title[0].plain_text;
        } else if (prop.type === 'rich_text' && prop.rich_text && prop.rich_text.length > 0) {
          if (
            key === 'line_group_id' ||
            key === 'discord_channel_id' ||
            key === 'line_notify_key'
          ) {
            pairAcc[key] = prop.rich_text[0].plain_text;
          }
        }
        return pairAcc;
      },
      {}
    );

    if (Object.keys(pair).length === 4) {
      acc.push(pair as LINEDiscordPairInfo);
    }
    return acc;
  }, []);

  logger.info(`${pairs.length}組のDiscordとLINEペアを読み込みました。`);
  return pairs;
};

export async function retrieveNotificationMessages(
  messageId?: string
): Promise<NotificationMessage[]> {
  const databaseId = await getConfigurationValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  const filter = messageId ? { property: 'messageId', title: { equals: messageId } } : undefined;
  const query = await queryAllDatabasePages(databaseId, filter);

  if (!query) {
    logger.info('info: 通知対象メッセージなし');
    return [];
  }

  return query.reduce((acc: NotificationMessage[], page) => {
    const messageIdProperty = page.properties['messageId'];
    const userIdProperty = page.properties['userId'];

    if ('title' in messageIdProperty && 'rich_text' in userIdProperty) {
      const messageId = messageIdProperty.title[0].plain_text;
      const userId = userIdProperty.rich_text[0].plain_text;

      const existingPair = acc.find((pair) => pair.messageId === messageId);

      if (existingPair) {
        existingPair.userId.push(userId);
      } else {
        acc.push({ messageId: messageId, userId: [userId] });
      }
    }
    return acc;
  }, []);
}

export async function addNotificationMessage(messageId: string, userId: string) {
  const databaseId = await getConfigurationValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  await notionClient.pages.create({
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

  if (searchResult.results.length === 0) {
    throw new Error(
      `Notification message with messageId ${messageId} and userId ${userId} not found.`
    );
  }

  await notionClient.pages.update({
    page_id: searchResult.results[0].id,
    archived: true,
  });
}
