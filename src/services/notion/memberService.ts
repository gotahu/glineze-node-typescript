import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';
import { GlanzeMember } from '../../types/types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { config } from '../../config';
import { getStringPropertyValue } from '../../utils/notionUtils';

export class MemberService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public async retrieveGlanzeMemberFromNotionPage(page: PageObjectResponse): Promise<GlanzeMember> {
    try {
      if (page === undefined) {
        throw new Error('Notion page is undefined');
      }

      if (page.object !== 'page') {
        throw new Error('Notion object is not a page');
      }

      const member: GlanzeMember = {
        notionPageId: page.id,
        discordUserId: getStringPropertyValue(page, 'Discord') || '',
        name: getStringPropertyValue(page, '名前') || '',
        generation: getStringPropertyValue(page, '期') || '',
        part4: getStringPropertyValue(page, '4パート') || '',
        part8: getStringPropertyValue(page, '8パート') || '',
      };

      return member;
    } catch (error) {
      logger.error(`Failed to retrieve GlanzeMember: ${error}`);
      throw error;
    }
  }

  public async retrieveGlanzeMemberFromDiscordId(
    discordId: string
  ): Promise<GlanzeMember | undefined> {
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

      return this.retrieveGlanzeMemberFromNotionPage(page);
    } catch (error) {
      logger.error(`Failed to retrieve GlanzeMember: ${error}`);
      return undefined;
    }
  }
}
