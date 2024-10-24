import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';
import { GlanzeMember } from '../../types/types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { config } from '../../config/config';
import { getStringPropertyValue } from './notionUtil';

export class MemberService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async retrieveGlanzeMember(discordId: string): Promise<GlanzeMember | undefined> {
    try {
      const databaseId = config.getConfig('discord_and_notion_pairs_databaseid');
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Discord',
          rich_text: { equals: discordId },
        },
      });

      if (response.results.length === 0) {
        logger.error(`No GlanzeMember found for Discord ID: ${discordId}`);
        return undefined;
      }

      const page = response.results[0] as PageObjectResponse;

      const member: GlanzeMember = {
        notionPageId: page.id,
        discordUserId: discordId,
        name: getStringPropertyValue(page, '名前') || '',
        generation: getStringPropertyValue(page, '期') || '',
        part4: getStringPropertyValue(page, '4パート') || '',
        part8: getStringPropertyValue(page, '8パート') || '',
      };

      return member;
    } catch (error) {
      logger.error(`Failed to retrieve GlanzeMember: ${error}`);
      return undefined;
    }
  }
}
