import { config } from '../../config';
import { NotificationMessage } from '../../types/types';
import { logger } from '../../utils/logger';
import { NotionService } from './notionService';
import { queryAllDatabasePages } from '../../utils/notionUtils';

export async function retrieveNotificationMessages(
  notion: NotionService,
  messageId?: string
): Promise<NotificationMessage[]> {
  try {
    const databaseId = config.getConfig('notification_messages_databaseid');

    const filter = messageId ? { property: 'messageId', title: { equals: messageId } } : undefined;
    const query = await queryAllDatabasePages(notion.client, databaseId, filter);

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
  } catch (err) {
    logger.error('Error in retrieveNotificationMessages: ' + err);
    return [];
  }
}

export async function addNotificationMessage(
  notion: NotionService,
  messageId: string,
  userId: string
) {
  try {
    const databaseId = config.getConfig('notification_messages_databaseid');

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
  } catch (err) {
    logger.error('Error in addNotificationMessage: ' + err);
  }
}

export async function deleteNotificationMessage(
  notion: NotionService,
  messageId: string,
  userId: string
) {
  try {
    const databaseId = config.getConfig('notification_messages_databaseid');

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
  } catch (err) {
    logger.error('Error in deleteNotificationMessage: ' + err);
  }
}
