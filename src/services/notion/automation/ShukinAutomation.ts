import {
  GlanzeMember,
  NotionAutomationWebhookEvent,
  Services,
  ShukinInfo,
} from '../../../types/types';
import { logger } from '../../../utils/logger';
import { getRelationPropertyValue } from '../../../utils/notionUtils';

export async function handleShukinAutomation(
  event: NotionAutomationWebhookEvent,
  services: Services
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
    const shukinInfo = shukinService.extractShukinInfo(event.data);

    // 集金状況を通知
    await notifyDiscordMember({ member, shukinInfo, services });

    logger.info('handleShukinAutomation: success');
  } catch (error) {
    logger.error('handleShukinAutomation: error', error);
  }
}

async function notifyDiscordMember({
  member,
  shukinInfo,
  services,
}: {
  member: GlanzeMember;
  shukinInfo: ShukinInfo[];
  services: Services;
}) {
  const { discord, notion } = services;
  const { shukinService } = notion;

  const message =
    '集金状況が更新されました。\n' + shukinService.formatReplyMessage(member.name, shukinInfo);
  const discordMember = await discord.client.users.fetch(member.discordUserId);

  if (!discordMember) {
    throw new Error(`Discord member not found for user: ${member.name}`);
  }

  await discordMember.send(message);
}
