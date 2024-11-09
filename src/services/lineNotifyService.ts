import axios from 'axios';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import {
  Attachment,
  Channel,
  ChannelType,
  Collection,
  Message,
  TextChannel,
  ThreadChannel,
  User,
  VoiceChannel,
} from 'discord.js';
import { config } from '../config/config';
import { LINEDiscordPairService } from './notion/lineDiscordPairService';
interface AttachmentInfo {
  isImage: boolean;
  url: string;
}

const MESSAGE_CONSTANTS = {
  DM_SERVER_NAME: 'DM',
  UNKNOWN_SERVER: 'Unknown Server',
  IMAGE_SUFFIX: '枚目',
  FILE_SUFFIX: 'つ目',
} as const;

export class LINENotifyService {
  constructor(private readonly pairService: LINEDiscordPairService) {}

  private getServerName(message: Message): string {
    return message.channel.type === ChannelType.DM
      ? MESSAGE_CONSTANTS.DM_SERVER_NAME
      : message.guild?.name || MESSAGE_CONSTANTS.UNKNOWN_SERVER;
  }

  private async createMessageTitle(
    channel: TextChannel | VoiceChannel | ThreadChannel
  ): Promise<string> {
    let title = `${channel.guild.name}: #`;

    if (channel.isThread() && channel.parent) {
      title += `${channel.parent.name} > `;
    }

    return title + channel.name;
  }

  private async processAttachment(attachment: Attachment, index: number): Promise<AttachmentInfo> {
    const isImage = Boolean(attachment.height && attachment.width);
    return {
      isImage,
      url: attachment.url,
    };
  }

  private async sendMessageWithAttachments(
    token: string,
    baseTitle: string,
    messageText: string,
    attachments: Collection<string, Attachment>
  ): Promise<void> {
    let index = 1;

    for (const attachment of attachments.values()) {
      const { isImage, url } = await this.processAttachment(attachment, index);

      const contentType = isImage ? '画像' : 'ファイル';
      const suffix = isImage ? MESSAGE_CONSTANTS.IMAGE_SUFFIX : MESSAGE_CONSTANTS.FILE_SUFFIX;
      let content = `${baseTitle} ${contentType} ${index}${suffix}`;

      if (!isImage) {
        content += `\n${url}`;
      }

      if (index === 1) {
        content += `\n${messageText}`;
      }

      await (isImage
        ? this.postTextWithImageToLINENotify(token, content, url)
        : this.postTextToLINENotify(token, content));

      index++;
    }
  }

  private async getNotifyToken(message: Message, isVoid: boolean): Promise<string> {
    if (isVoid) return config.lineNotify.voidToken;

    const pairs = await this.pairService.getLINEDiscordPairs();
    const channelId =
      message.channel.isThread() && message.channel.parent
        ? message.channel.parent.id
        : message.channel.id;

    const pair = pairs.find((v) => v.discordChannelId === channelId);

    if (pair) {
      logger.info(`LINE Notify token found for channel ID: ${channelId}`);
      return pair.lineNotifyKey;
    }

    return config.lineNotify.voidToken;
  }

  private async postTextToLINENotify(lineNotifyToken: string, message: string): Promise<void> {
    await postToLINENotify(lineNotifyToken, message);
  }

  private async postTextWithImageToLINENotify(
    lineNotifyToken: string,
    message: string,
    imageUrl: string
  ): Promise<void> {
    await postToLINENotify(lineNotifyToken, message, imageUrl);
  }

  private async getMessageAuthor(author: User): Promise<User> {
    if (author.partial) {
      return await author.fetch();
    }
    return author;
  }

  public async relayMessage(message: Message, isVoid: boolean = false): Promise<void> {
    try {
      if (
        message.channel.type === ChannelType.DM ||
        message.channel.type === ChannelType.GuildText ||
        message.channel.type === ChannelType.GuildVoice ||
        message.channel.type === ChannelType.PrivateThread ||
        message.channel.type === ChannelType.PublicThread
      ) {
        const messageText = message.cleanContent;
        const messageAuthor = await this.getMessageAuthor(message.author);

        // DMの場合の処理
        if (message.channel.type === ChannelType.DM) {
          const serverName = this.getServerName(message);
          await this.postTextToLINENotify(
            config.lineNotify.voidToken,
            `${serverName}: ${messageAuthor.username}\n${messageText}`
          );
          return;
        }

        // 通常チャンネルの処理
        const token = await this.getNotifyToken(message, isVoid);
        const messageTitle = await this.createMessageTitle(message.channel);
        const fullTitle = `${messageTitle}\n${messageAuthor.username}:`;

        if (message.attachments.size === 0) {
          logger.info('メッセージを転送: 添付ファイルなし');
          await this.postTextToLINENotify(token, `${fullTitle}\n${messageText}`);
          return;
        }

        logger.info('メッセージを転送: 添付ファイルあり');
        await this.sendMessageWithAttachments(token, fullTitle, messageText, message.attachments);
      } else {
        logger.info(`メッセージの転送対象外: 不明なチャンネルタイプ ${message.channel.type}`);
        return;
      }
    } catch (error) {
      logger.error(`メッセージの転送中にエラーが発生: ${error}`);
      throw error;
    }
  }
}

export async function postToLINENotify(
  lineNotifyToken: string,
  message: string,
  imageURL?: string
): Promise<void> {
  try {
    const params = new URLSearchParams({ message });
    if (imageURL) {
      params.append('imageThumbnail', imageURL);
      params.append('imageFullsize', imageURL);
    }

    const res = await axios.post(CONSTANTS.LINE_NOTIFY_API, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Bearer ' + lineNotifyToken,
      },
      responseType: 'json',
    });
    logger.info(`LINE Notify response: ${JSON.stringify(res.data)}`);
  } catch (error) {
    logger.error('Error occurred in LINE Notify API');
    if (axios.isAxiosError(error) && error.response) {
      logger.error(`Error status: ${error.response.status}`);
      logger.error(`Error data: ${JSON.stringify(error.response.data)}`);
    } else if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
    } else {
      logger.error(`Unknown error: ${error}`);
    }
    throw error;
  }
}
