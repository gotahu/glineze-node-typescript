import {
  ChannelType,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js';

import { Services } from '../../types/types';
import { logger } from '../../utils/logger';

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  services: Services
) {
  const { notion } = services;
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

  if (reaction.emoji.name === '🗑️') {
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
