import { Message, MessageReaction, User } from 'discord.js';
import { CONSTANTS } from '../../config/constants';
import { config } from '../../config/config';
import { Services } from '../../types/types';

export function addSendButtonReaction(services: Services, message: Message) {
  const { lineNotify } = services;

  message.react('✅');

  const filter = (reaction: MessageReaction, user: User) => {
    return reaction.emoji.name === '✅' && user.id === message.author.id;
  };

  const reactionTimeSeconds = config.getConfig('reaction_time_seconds');
  const timeoutSeconds = reactionTimeSeconds
    ? parseInt(reactionTimeSeconds)
    : CONSTANTS.DEFAULT_REACTION_TIME_SECONDS;

  const collector = message.createReactionCollector({ filter, time: timeoutSeconds * 1000 });

  collector.on('collect', async () => {
    // チェックのリアクションを削除する
    message.reactions.cache.get('✅')?.remove();

    // 通知する
    await lineNotify.relayMessage(message, false);

    // コレクターを停止する
    collector.stop();
  });

  collector.on('end', async (collected) => {
    // チェックのリアクションを削除する
    message.reactions.cache.get('✅')?.remove();
  });
}
