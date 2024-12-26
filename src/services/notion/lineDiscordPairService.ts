import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { LINEDiscordPairInfo } from '../../types/types';
import { getBooleanPropertyValue, getStringPropertyValue } from '../../utils/notionUtils';
import { config } from '../../config/config';
import { Message, ThreadChannel } from 'discord.js';

export class LINEDiscordPairService {
  private client: Client;
  private cache: LINEDiscordPairInfo[] | null = null;

  constructor(client: Client) {
    this.client = client;

    this.initialize()
      .then()
      .catch((error) => {
        logger.error(`Failed to initialize LINEDiscordPairService: ${error}`);
      });
  }

  public async initialize(): Promise<void> {
    await this.loadPairs();
  }

  public async getLINEDiscordPairs(): Promise<LINEDiscordPairInfo[]> {
    if (this.cache) {
      logger.info('Returning cached LINEDiscordPairs');
      return this.cache;
    }
    return this.loadPairs();
  }

  private async loadPairs(): Promise<LINEDiscordPairInfo[]> {
    try {
      const databaseId = config.getConfig('discord_and_line_pairs_databaseid');
      const response = await this.client.databases.query({ database_id: databaseId });
      const pages = response.results as PageObjectResponse[];

      const pairs: LINEDiscordPairInfo[] = pages.map((page) => ({
        name: getStringPropertyValue(page, 'name') || '',
        lineGroupId: getStringPropertyValue(page, 'line_group_id') || '',
        discordChannelId: getStringPropertyValue(page, 'discord_channel_id') || '',
        lineNotifyKey: getStringPropertyValue(page, 'line_notify_key') || '',
        priority: getBooleanPropertyValue(page, 'priority'),
        includeThreads: getBooleanPropertyValue(page, 'include_threads'),
      }));

      this.cache = pairs;
      logger.info('LINEDiscordPairs loaded from Notion');
      return pairs;
    } catch (error) {
      logger.error(`Failed to load LINEDiscordPairs: ${error}`);
      throw new Error('Failed to load LINEDiscordPairs');
    }
  }

  public async addLineDiscordPair(pair: LINEDiscordPairInfo): Promise<void> {
    try {
      const databaseId = config.getConfig('discord_and_line_pairs_databaseid');
      await this.client.pages.create({
        parent: { database_id: databaseId },
        properties: {
          name: { title: [{ text: { content: pair.name } }] },
          line_group_id: { rich_text: [{ text: { content: pair.lineGroupId } }] },
          discord_channel_id: { rich_text: [{ text: { content: pair.discordChannelId } }] },
          line_notify_key: { rich_text: [{ text: { content: pair.lineNotifyKey } }] },
          priority: { checkbox: pair.priority },
          include_threads: { checkbox: pair.includeThreads },
        },
      });
      await this.loadPairs(); // キャッシュを更新
      logger.info(`LineDiscordPair added: ${pair.name}`);
    } catch (error) {
      logger.error(`Failed to add LineDiscordPair: ${error}`);
      throw new Error('Failed to add LineDiscordPair');
    }
  }

  public async removeLineDiscordPair(channelId: string): Promise<void> {
    try {
      const pair = await this.getLINEDiscordPairByChannelId(channelId);
      if (!pair) {
        throw new Error('Pair not found');
      }

      const databaseId = config.getConfig('discord_and_line_pairs_databaseid');
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: { property: 'discord_channel_id', rich_text: { equals: channelId } },
      });

      if (response.results.length === 0) {
        throw new Error('Pair not found in Notion');
      }

      const pageId = response.results[0].id;
      await this.client.pages.update({ page_id: pageId, archived: true });
      await this.loadPairs(); // キャッシュを更新
      logger.info(`LineDiscordPair removed: ${pair.name}`);
    } catch (error) {
      logger.error(`Failed to remove LineDiscordPair: ${error}`);
      throw new Error('Failed to remove LineDiscordPair');
    }
  }

  public async getLINEDiscordPairByChannelId(
    channelId: string
  ): Promise<LINEDiscordPairInfo | null> {
    const pairs = await this.getLINEDiscordPairs();
    return pairs.find((pair) => pair.discordChannelId === channelId) ?? null;
  }

  public async getLINEDiscordPairFromMessage(
    message: Message
  ): Promise<LINEDiscordPairInfo | null> {
    const pairs = await this.getLINEDiscordPairs();
    let pair = pairs.find((v) => v.discordChannelId == message.channel.id);

    // スレッドの場合、親チャンネルにペアが設定されていないかを確認する
    if (!pair && message.channel.isThread()) {
      const channel = message.channel as ThreadChannel;
      // 親チャンネルのIDが一致し、子スレッドを含む設定になっているペアを取得
      pair = pairs.find((v) => v.discordChannelId == channel.parentId && v.includeThreads);
    }

    return pair;
  }
}
