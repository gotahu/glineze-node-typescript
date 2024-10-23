import axios from 'axios';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import { ChannelType, Message, User } from 'discord.js';
import { config } from '../config/config';
import { NotionService } from './notion/notionService';

export class LINENotifyService {
  private async postToLINENotify(
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
    }
  }

  public async postTextToLINENotify(lineNotifyToken: string, message: string): Promise<void> {
    await this.postToLINENotify(lineNotifyToken, message);
  }

  public async postTextWithImageToLINENotify(
    lineNotifyToken: string,
    message: string,
    imageUrl: string
  ): Promise<void> {
    await this.postToLINENotify(lineNotifyToken, message, imageUrl);
  }

  public async postTextToLINENotifyFromDiscordMessage(
    notion: NotionService,
    discordMessage: Message,
    isVoid: boolean = false
  ): Promise<void> {
    try {
      const messageText = discordMessage.cleanContent;
      const messageAuthor = await this.getMessageAuthor(discordMessage.author);
      const serverName =
        discordMessage.channel.type === ChannelType.DM
          ? 'DM'
          : discordMessage.guild?.name || 'Unknown Server';
      let token = config.lineNotify.voidToken;

      // DM の場合は void トークンを使って送信
      if (discordMessage.channel.type === ChannelType.DM) {
        await this.postTextToLINENotify(
          token,
          `${serverName}: ${messageAuthor.username}\n${messageText}`
        );
        return;
      }

      if (!isVoid) {
        // LINE と Discord のペアを取得
        const pairs = await notion.getLINEDiscordPairs();

        // スレッドの場合は親チャンネルの ID を取得
        const discordChannelId =
          discordMessage.channel.isThread() && discordMessage.channel.parent
            ? discordMessage.channel.parent.id
            : discordMessage.channel.id;

        // 対象の Discord チャンネルに対応するペアを検索
        const pair = pairs.find((v) => v.discordChannelId === discordChannelId);

        if (pair) {
          // LINE Notify トークンを代入
          logger.info('LINE Notify token found for channel ID: ' + discordChannelId);
          token = pair.lineNotifyKey;
        }
      }

      // メッセージタイトルを作成
      let messageTitle = `${serverName}: #`;

      // スレッドの場合はタイトルを少し変える
      if (discordMessage.channel.isThread() && discordMessage.channel.parent) {
        messageTitle += `${discordMessage.channel.parent.name} > `;
      }

      messageTitle += `${discordMessage.channel.name}\n${messageAuthor.username}:`;

      if (discordMessage.attachments.size === 0) {
        logger.info('Discord から LINE Notify へ送信。添付ファイルなし。');
        await this.postTextToLINENotify(token, `${messageTitle}\n${messageText}`);
        return;
      }

      logger.info('Discord から LINE Notify へ送信。添付ファイルあり。');

      let index = 1;
      for (const attachment of discordMessage.attachments.values()) {
        if (!attachment) continue;

        const isImage = attachment.height && attachment.width;
        let sendContent = `${messageTitle} ${isImage ? '画像' : 'ファイル'} ${index}${
          isImage ? '枚目' : 'つ目'
        }`;
        if (!isImage) {
          sendContent += `\n${attachment.url}`;
        }
        if (index === 1) {
          sendContent += `\n${messageText}`;
        }

        if (isImage) {
          await this.postTextWithImageToLINENotify(token, sendContent, attachment.url);
        } else {
          await this.postTextToLINENotify(token, sendContent);
        }

        index++;
      }
    } catch (error) {
      logger.error(`Error in postTextToLINENotifyFromDiscordMessage: ${error}`);
    }
  }

  private async getMessageAuthor(author: User): Promise<User> {
    if (author.partial) {
      return await author.fetch();
    }
    return author;
  }
}
