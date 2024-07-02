import { Message, ChannelType } from 'discord.js';
import { LINENotifyPayload } from '../types/types';
import { postToLINENotify } from '../services/lineNotifyService';
import { logger } from '../utils/logger';

export async function prepareDiscordMessageToLINENotify(message: Message, isVoid: boolean = false) {
  if (message.channel.type === ChannelType.DM) return;

  const messageText = message.cleanContent;

  const parentChannel =
    message.channel.isThread() && message.channel.parent ? message.channel.parent.name : '';

  const messageMember = message.author.partial ? await message.author.fetch() : message.author;

  const messageTitle = `#${parentChannel ? parentChannel + ' > ' : ''}${message.channel.name}\n${
    messageMember.displayName
  }：`;

  const lineNotifyPayload: LINENotifyPayload = {
    username: messageMember.displayName,
    channelid:
      message.channel.isThread() && message.channel.parent
        ? message.channel.parent.id
        : message.channelId,
    groupname: message.channel.name,
    message: messageTitle + '\n' + messageText,
    avatarURL: message.author.displayAvatarURL({ extension: 'png' }),
    hasImage: false,
  };

  if (message.attachments.size === 0) {
    postToLINENotify(lineNotifyPayload, isVoid);
    return;
  }

  let index = 1;
  
  message.attachments.forEach((attachment) => {
    logger.info(JSON.stringify(attachment));
    if (!attachment) return;

    if (attachment.height && attachment.width) {
      const payloadWithImage = {
        ...lineNotifyPayload,
        hasImage: true,
        imageURL: attachment.url,
        previewURL: attachment.url,
        message: `${messageTitle}`,
      };

      if (total > 1) {
        payloadWithImage.message += `画像 ${index}/${total} 枚目\n`;

        if (index === 1) {
          payloadWithImage.message += `\n${message.cleanContent}`;
        }
      } else {
        payloadWithImage.message += `画像\n\n${message.cleanContent}`;
      }

      index++;

      postToLINENotify(payloadWithImage, isVoid);
    } else {
      const payloadWithFile = {
        ...lineNotifyPayload,
        hasImage: false,
        message: `${messageTitle} ファイル ${index}つ目\n${attachment.url}\n${message.cleanContent}`,
      };

      postToLINENotify(payloadWithFile, isVoid);
    }
  });
}
