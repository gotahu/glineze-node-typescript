import {
  ChannelType,
  Message,
  TextChannel,
  ThreadChannel,
  User,
  VoiceChannel,
  WebhookClient,
} from 'discord.js';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export async function relayMessageToDiscordWebhook(message: Message): Promise<void> {
  const webhookClient = new WebhookClient({
    url: config.discord.relayWebhook,
  });

  try {
    if (
      message.channel.type === ChannelType.DM ||
      message.channel.type === ChannelType.GuildText ||
      message.channel.type === ChannelType.GuildVoice ||
      message.channel.type === ChannelType.PrivateThread ||
      message.channel.type === ChannelType.PublicThread
    ) {
      const messageText = message.cleanContent;
      const messageAuthor = await getMessageAuthor(message.author);

      const messageTitle =
        message.channel.type === ChannelType.DM
          ? `DM - ${messageAuthor.username}`
          : createMessageTitle(message.channel) + ` - ${messageAuthor.username}:`;

      const attachments = message.attachments.map((attachment) => attachment.url);

      await webhookClient.send({
        content: messageText,
        username: messageTitle,
        avatarURL: messageAuthor.displayAvatarURL(),
        files: attachments,
      });
    } else {
      logger.info(`メッセージの転送対象外: 不明なチャンネルタイプ ${message.channel.type}`);
      return;
    }
  } catch (error) {
    logger.error(`メッセージの転送中にエラーが発生: ${error}`);
  }
}

function createMessageTitle(channel: TextChannel | VoiceChannel | ThreadChannel): string {
  let title = `${channel.guild.name}: #`;

  if (channel.isThread() && channel.parent) {
    title += `${channel.parent.name} > `;
  }

  return title + channel.name;
}

async function getMessageAuthor(author: User): Promise<User> {
  if (author.partial) {
    return await author.fetch();
  }
  return author;
}
