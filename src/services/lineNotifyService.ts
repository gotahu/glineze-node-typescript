import axios from 'axios';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import { ChannelType, Message } from 'discord.js';
import { config } from '../config/config';
import { NotionService } from './notionService';

export class LINENotifyService {
  private async postToLINENotify(
    lineNotifyToken: string,
    message: string,
    imageURL: string,
    previewURL: string
  ) {
    const request = axios.create({
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Bearer ' + lineNotifyToken,
      },
      responseType: 'json',
    });

    const postData = {
      message: message,
      imageFullSize: imageURL,
      imageThumbnail: previewURL,
    };

    try {
      const res = await request.post(CONSTANTS.LINE_NOTIFY_API, postData);
      logger.info(JSON.stringify(res.data));
    } catch (error) {
      logger.error('Error occurred in LINE Notify API');
      if (error instanceof Error) {
        logger.error(error.message);
      }
    }
  }

  public async postTextToLINENotify(lineNotifyToken: string, message: string) {
    await this.postToLINENotify(lineNotifyToken, message, '', '');
  }

  public async postTextWithImageToLINENotify(
    lineNotifyToken: string,
    message: string,
    imageUrl: string
  ) {
    await this.postToLINENotify(lineNotifyToken, message, imageUrl, imageUrl);
  }

  public async postTextToLINENotifyFromDiscordMessage(
    notion: NotionService,
    discordMessage: Message,
    isVoid: boolean = false
  ) {
    const messageText = discordMessage.cleanContent;
    const messageMember = discordMessage.author.partial
      ? await discordMessage.author.fetch()
      : discordMessage.author;
    const serverName =
      discordMessage.channel.type === ChannelType.DM ? 'DM' : discordMessage.guild.name;
    let token = config.lineNotify.voidToken;

    // DM の場合は void トークンを使って送信
    if (discordMessage.channel.type === ChannelType.DM) {
      this.postTextToLINENotify(
        token,
        `${serverName}: ${messageMember.displayName}\n${messageText}`
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
      const pair = pairs.find((v) => v.discord_channel_id === discordChannelId);

      if (pair) {
        // LINE Notify トークンを代入
        logger.info('LINE Notify token found for channel ID: ' + discordChannelId);
        token = pair.line_notify_key;
      }
    }

    // 以下サーバー内でのメッセージの処理
    let messageTitle = `${serverName}: #`;

    // スレッド のときはタイトルを少し変える
    if (discordMessage.channel.isThread() && discordMessage.channel.parent) {
      messageTitle += `${discordMessage.channel.parent.name} > `;
    }

    messageTitle += `${discordMessage.channel.name}\n${messageMember.displayName}:`;

    if (discordMessage.attachments.size === 0) {
      logger.info('Discord から LINE Notify へ送信。添付ファイルなし。');
      this.postTextToLINENotify(token, messageTitle + '\n' + messageText);
      return;
    }

    logger.info('Discord から LINE Notify へ送信。添付ファイルあり。');

    let index = 1;
    for (const attachment of discordMessage.attachments.values()) {
      logger.info(JSON.stringify(attachment));

      if (!attachment) return;

      if (attachment.height && attachment.width) {
        await this.postTextWithImageToLINENotify(
          token,
          `${messageTitle} 画像 ${index}枚目\n${messageText}`,
          attachment.url
        );
      } else {
        await this.postTextToLINENotify(
          token,
          `${messageTitle} ファイル ${index}つ目\n${attachment.url}\n${messageText}`
        );
      }

      index++;
    }
  }
}

// async function getLINENotifyToken(channelId: string): Promise<string> {
//   try {
//     // LINEとDiscordのペアを取得
//     const pairs = await retrieveLINEAndDiscordPairs();

//     // 対象のDiscordチャンネルに対応するペアを検索
//     const pair = pairs.find((v) => v.discord_channel_id === channelId);

//     if (pair) {
//       logger.info(`LINE Notify token found for channel ID: ${channelId}`);
//       return pair.line_notify_key;
//     } else {
//       logger.warn(`No LINE Notify token found for channel ID: ${channelId}, using default token`);
//       return config.lineNotify.voidToken;
//     }
//   } catch (error) {
//     logger.error(`Error retrieving LINE Notify token: ${error}`);
//     return config.lineNotify.voidToken;
//   }
// }
