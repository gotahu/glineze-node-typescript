import {
  BaseInteraction,
  ChannelType,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  ThreadChannel,
  User,
} from 'discord.js';

import {
  addNotificationMessage,
  retrieveNotificationMessages,
  deleteNotificationMessage,
} from '../notion/notion-interaction';

import { prepareDiscordMessageToLINENotify } from '../line/lineNotify';
import { logger } from '../utils/logger';

async function removeMembersExcept(threadChannel: ThreadChannel, excludeMemberIds: string[]) {
  try {
    const members = await threadChannel.members.fetch();
    const removalPromises = members
      .filter((member) => !excludeMemberIds.includes(member.id))
      .map((member) => threadChannel.members.remove(member.id));

    await Promise.all(removalPromises);
  } catch (error) {
    logger.error('Failed to remove members:' + error);
    throw error;
  }
}

export const handleInteractionCreate = async (interaction: BaseInteraction) => {
  if (!interaction.isButton()) return;

  switch (interaction.customId) {
    case 'delete':
      if (interaction.message.channel instanceof ThreadChannel) {
        const ownerId = interaction.message.channel.ownerId;

        if (ownerId) {
          const interactionMakerId = interaction.user.id;
          const botId = interaction.client.user.id;

          const excludeMemberIds = [ownerId, interactionMakerId, botId];
          await removeMembersExcept(interaction.message.channel, excludeMemberIds);
          await interaction.reply({
            content: '指定されたメンバーをスレッドから削除しました。',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: 'この操作はスレッド内でのみ有効です。',
            ephemeral: true,
          });
        }
      }
      break;

    case 'ignore':
      if (interaction.message.deletable) {
        await interaction.message.delete();
      }
      break;
  }
};

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  if (user.bot) return;

  logger.info(JSON.stringify(reaction));
  logger.info(
    `${reaction.message.guild} で ${user.tag} が ${reaction.emoji.name} をリアクションしました`
  );

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

  if (reaction.emoji.name === '✅') {
    const reactedUsers = await reaction.users.fetch();

    if (reactedUsers.has(reaction.client.user.id)) {
      if (user.id !== reactedMessage.author.id) {
        return;
      }

      reaction.remove();

      prepareDiscordMessageToLINENotify(reactedMessage, false);

      return;
    }
  }

  if (reaction.emoji.name === '📢') {
    reaction.remove();
    prepareDiscordMessageToLINENotify(reactedMessage, false);
  }

  const notificationMessages = await retrieveNotificationMessages(reactedMessageId);
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

  logger.info(`notificationMessages.length: ${notificationMessages.length}`);
  logger.info(`notificationUserId: ${notificationUserId}`);
  logger.info(`isAlreadyNotificationMessage: ${isAlreadyNotificationMessage}`);

  if (
    reaction.emoji.name !== '🔔' &&
    reaction.emoji.name !== '🔕' &&
    !isAlreadyNotificationMessage
  ) {
    logger.info('リアクションされたメッセージは通知対象ではありませんでした。');
    return;
  }

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
        await addNotificationMessage(reactedMessageId, notificationUserId);
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
        await deleteNotificationMessage(reactedMessageId, notificationUserId);

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
  } else {
    notificationMessages[0].userId.forEach(async (userId) => {
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
    });
  }
}

async function fetchPartialMessage(message: PartialMessage): Promise<Message | undefined> {
  if (message.partial) {
    try {
      const fullMessage = await message.fetch();
      return fullMessage;
    } catch (error) {
      logger.error(`Failed to fetch the message: ${message.id}, ${error}`);
      return undefined;
    }
  } else {
    throw new Error('The message is not partial.');
  }
}

const generateMessage = (prefix: string, message: string) => {
  return `:${prefix}: ： ${message}`;
};
