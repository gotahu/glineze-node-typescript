import type { Client as DiscordClient } from 'discord.js';
import type { Client as NotionClient } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { GlanzeMember, NotionAutomationWebhookEvent, ShukinInfo } from '../../types/types';
import { logger } from '../../utils/logger';
import { getRelationPropertyValue } from '../../utils/notionUtils';

interface CollectionAutomationDependencies {
  notion: {
    client: NotionClient;
    memberService: {
      retrieveGlanzeMemberFromNotionPage(page: PageObjectResponse): Promise<GlanzeMember>;
    };
    shukinService: {
      extractShukinInfo(page: PageObjectResponse): Promise<ShukinInfo[]>;
      formatShukinStatusMessage(memberName: string, shukinInfo: ShukinInfo[]): string;
    };
  };
  discord: { client: DiscordClient };
}

export async function processShukinStatusChange(
  event: NotionAutomationWebhookEvent,
  services: CollectionAutomationDependencies
) {
  try {
    logger.info('handleShukinAutomation: start');

    const { notion } = services;
    const { memberService, shukinService } = notion;

    // 団員のページを取得
    const memberRelation = await getRelationPropertyValue(notion.client, event.data, '団員');

    // 団員のページが存在しない場合はエラー
    if (!memberRelation?.length) {
      throw new Error('Invalid request: missing member relation');
    }

    // 団員のページを取得
    const member = await memberService.retrieveGlanzeMemberFromNotionPage(memberRelation[0]);

    // 集金状況を取得
    const shukinInfo = await shukinService.extractShukinInfo(event.data);

    // 集金状況を通知
    await notifyShukinStatusToDiscordMember({ member, shukinInfo, services });

    logger.info('handleShukinAutomation: success');
  } catch (error) {
    logger.error('handleShukinAutomation: error', { error });
  }
}

async function notifyShukinStatusToDiscordMember({
  member,
  shukinInfo,
  services,
}: {
  member: GlanzeMember;
  shukinInfo: ShukinInfo[];
  services: CollectionAutomationDependencies;
}) {
  const { discord, notion } = services;
  const { shukinService } = notion;

  const message =
    '集金状況が更新されました。\n' +
    shukinService.formatShukinStatusMessage(member.name, shukinInfo);
  const discordMember = await discord.client.users.fetch(member.discordUserId);

  if (!discordMember) {
    throw new Error(`Discord member not found for user: ${member.name}`);
  }

  await discordMember.send(message);
}
