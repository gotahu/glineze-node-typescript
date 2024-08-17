import { NotificationMessage } from '../types/types';
import { logger } from '../utils/logger';
import { NotionService } from '../services/notionService';

export async function retrieveNotificationMessages(
  notion: NotionService,
  messageId?: string
): Promise<NotificationMessage[]> {
  const databaseId = await notion.getConfigValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  const filter = messageId ? { property: 'messageId', title: { equals: messageId } } : undefined;
  const query = await notion.queryAllDatabasePages(databaseId, filter);

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

export async function addNotificationMessage(
  notion: NotionService,
  messageId: string,
  userId: string
) {
  const databaseId = await notion.getConfigValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  await notion.client.pages.create({
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

export async function deleteNotificationMessage(
  notion: NotionService,
  messageId: string,
  userId: string
) {
  const databaseId = await notion.getConfigValue('notification_messages_databaseid');

  if (!databaseId) {
    throw new Error('notification_messages_databaseid is not found.');
  }

  const searchResult = await notion.client.databases.query({
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

  await notion.client.pages.update({
    page_id: searchResult.results[0].id,
    archived: true,
  });
}
