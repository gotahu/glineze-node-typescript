import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  webhook,
  WebhookEvent,
} from '@line/bot-sdk';
import { config } from '../../config/config';

import { DiscordService } from '../discord/discordService';
import { logger } from '../../utils/logger';
import { Services } from '../../types/types';

export class LINEBotService {
  private client: messagingApi.MessagingApiClient;
  private discord: DiscordService;

  constructor(services: Services) {
    this.discord = services.discord;

    const clientConfig: ClientConfig = {
      channelAccessToken: config.lineBot.channelAccessToken,
    };

    this.client = new messagingApi.MessagingApiClient(clientConfig);
  }

  /**
   * LINE メッセージのリクエストを処理
   * @param event
   * @returns
   */
  public async handleLINEMessageEvent(
    event: webhook.Event
  ): Promise<MessageAPIResponseBase | undefined> {
    if (
      event.type !== 'message' ||
      event.message.type !== 'text' ||
      event.source.type !== 'group'
    ) {
      return;
    }

    const text = event.message.text;
    const userId = event.source.userId;
    const discord = this.discord;

    if (event.source.type === 'group') {
      const groupId = event.source.groupId;

      // Discord チャンネルのペアを取得
      const discordChannelId = await discord.findMatchingDiscordChannel(groupId);

      // ペアが存在する場合
      if (discordChannelId) {
        // ユーザー情報を取得
        const userProfile = await this.client.getGroupMemberProfile(groupId, userId);
        const displayName = userProfile.displayName;
        const content = `${displayName}:\n${text}`;

        // Discord にメッセージを送信
        await discord.sendStringsToChannel([content], discordChannelId);
        logger.info(`LINE メッセージを Discord (${discordChannelId}) に送信しました:\n ${content}`);
      }
    }
  }
}
