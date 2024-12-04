import { NotionAutomationWebhookEvent } from '../../../types/types';
import { logger } from '../../../utils/logger';
import { getRelationPropertyValue } from '../../../utils/notionUtils';
import { DiscordService } from '../../discord/discordService';
import { NotionService } from '../notionService';

export async function handleShukinAutomation(
  event: NotionAutomationWebhookEvent,
  services: {
    notion: NotionService;
    discord: DiscordService;
  }
) {
  logger.info('handleShukinAutomation:', { debug: true });

  const { notion, discord } = services;
  const { memberService, shukinService } = notion;

  const memberRelation = await getRelationPropertyValue(notion.client, event.data, '団員');

  if (memberRelation && memberRelation.length > 0) {
    const memberPage = memberRelation[0];
    const member = await memberService.retrieveGlanzeMemberFromNotionPage(memberPage);

    const shukinInfo = shukinService.extractShukinInfo(event.data);

    const message =
      '集金状況が更新されました。\n' + shukinService.formatReplyMessage(member.name, shukinInfo);

    const discordMember = await discord.client.users.fetch(member.discordUserId);

    if (discordMember) {
      await discordMember.send(message);
    } else {
      logger.error(`Discord member not found for user: ${member.name}`);
    }
  } else {
    logger.error('Invalid request: missing member relation');
  }
}
