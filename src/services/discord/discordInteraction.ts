import {
  ChannelType,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';

import {
  addNotificationMessage,
  deleteNotificationMessage,
  retrieveNotificationMessages,
} from '../notion/notionInteraction';

import { Services } from '../../types/types';
import { logger } from '../../utils/logger';

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  services: Services
) {
  const { notion, lineNotify } = services;
  if (user.bot) return;

  reaction.message.fetch().then((message) => {
    logger.info(
      `${reaction.message.guild} で ${user.tag} が ${reaction.emoji.name} を ${message.cleanContent.slice(0, 50)} に対してリアクションしました`
    );
  });

  const reactedMessage = reaction.message.partial
    ? await fetchPartialMessage(reaction.message)
    : (reaction.message as Message);

  if (!reactedMessage) {
    logger.error('メッセージオブジェクトが存在しませんでした。');
    return;
  }

  if (reactedMessage.channel.type === ChannelType.DM) {
    logger.info('ignore DM');
    return;
  }

  const reactedMessageId = reaction.message.id;

  // 強制的に通知する
  if (reaction.emoji.name === '📢') {
    // リアクションを削除する
    reaction.remove();
    // 通知する
    await lineNotify.relayMessage(reactedMessage, false);
  }

  const notificationMessages = await retrieveNotificationMessages(notion, reactedMessageId);
  const notificationUserId = user.id;
  const notificationUser = reaction.client.users.cache.get(notificationUserId);

  if (!notificationUser) {
    logger.error('通知対象者のDiscord User オブジェクトを取得できませんでした。');
    return;
  }

  const isAlreadyNotificationMessage =
    notificationMessages.length > 0
      ? notificationMessages[0].userId.includes(notificationUserId)
      : false;

  if (
    reaction.emoji.name !== '🔔' &&
    reaction.emoji.name !== '🔕' &&
    reaction.emoji.name !== '🗑️' &&
    !isAlreadyNotificationMessage
  )
    return;

  const messageUrl = reactedMessage.url;

  if (reaction.emoji.name === '🔔') {
    reaction.remove();

    if (isAlreadyNotificationMessage) {
      logger.info(`messageId: ${reactedMessageId} はすでに通知対象に指定されています`);
      notificationUser.send(
        generateMessage('warning', `エラー： ${messageUrl} はすでに通知対象に設定されています。`)
      );
    } else {
      try {
        await addNotificationMessage(notion, reactedMessageId, notificationUserId);
        logger.info(`messageId: ${reactedMessageId} を通知対象のメッセージとしました`);
        notificationUser.send(
          generateMessage('white_check_mark', `${messageUrl} を通知対象に設定しました`)
        );
      } catch (error) {
        logger.error(
          `messageId: ${reactedMessageId} を通知対象のメッセージとできませんでした ${error}`
        );
        notificationUser.send(
          generateMessage(
            'warning',
            `エラー： ${messageUrl} を通知対象に設定できませんでした。${error}`
          )
        );
      }
    }
  } else if (reaction.emoji.name === '🔕') {
    reaction.remove();

    if (!isAlreadyNotificationMessage) {
      logger.error(`messageId: ${reactedMessageId} は通知対象ではありません。`);
      notificationUser.send(
        generateMessage('warning', `エラー： ${messageUrl} はそもそも通知対象になっていません。`)
      );
    } else {
      try {
        await deleteNotificationMessage(notion, reactedMessageId, notificationUserId);

        logger.info(`messageId: ${reactedMessageId} を通知対象から削除しました`);
        notificationUser.send(
          generateMessage(
            'person_gesturing_ok_tone1',
            `${messageUrl} を通知対象から削除しました。もうこのメッセージの通知は来ません。`
          )
        );
      } catch (error) {
        logger.error(`messageId: ${reactedMessageId} の通知対象からの削除に失敗しました, ${error}`);
        notificationUser.send(
          generateMessage(
            'warning',
            `エラー： ${messageUrl} の通知対象からの削除に失敗しました。${error}`
          )
        );
      }
    }
  } else if (reaction.emoji.name === '🗑️') {
    try {
      // メッセージIDからメッセージを取得
      const channelId = reaction.message.channelId;
      // チャンネルIDからチャンネルを取得
      const channel = await reaction.client.channels.fetch(channelId);
      if (!channel.isTextBased()) throw new Error('This channel is not a text channel.');

      // メッセージIDからメッセージを取得
      const targetMessage = await channel.messages.fetch(reactedMessageId);

      // BOTが送信したメッセージでなければ無視する
      if (targetMessage.author.id !== reaction.client.user.id) {
        return;
      }
      // BOTが送信したメッセージを削除する
      await targetMessage.delete();
    } catch (error) {
      console.error('Failed to delete the message:', error);
    }
  } else {
    for (const userId of notificationMessages[0].userId) {
      try {
        const user = await reaction.client.users.fetch(userId);
        user.send(
          generateMessage(
            'bell',
            `${messageUrl} に（${reaction.message.author.username}）さんがリアクション（${reaction.emoji.name}）しました。`
          )
        );
        logger.info(
          `通知対象者に通知を送信しました。userId: ${userId}, mesaggeId: ${reactedMessageId}`
        );
      } catch (error) {
        logger.error(
          `通知対象者に通知を送信できませんでした。userId: ${userId}, mesaggeId: ${reactedMessageId}`
        );
      }
    }
  }
}

async function fetchPartialMessage(message: PartialMessage): Promise<Message | undefined> {
  if (message.partial) {
    try {
      const fullMessage = await message.fetch();
      return fullMessage;
    } catch (error) {
      logger.error(`Failed to fetch the message: ${message.id}, ${error}`);
    }
  } else {
    logger.error(`This message is not partial: ${message.id}`);
  }

  return undefined;
}

const generateMessage = (prefix: string, message: string) => {
  return `:${prefix}: ： ${message}`;
};
