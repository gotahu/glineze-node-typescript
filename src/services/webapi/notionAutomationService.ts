import { config } from '../../config';
import { NotionAutomationWebhookEvent, Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { areUUIDsEqual } from '../../utils/notionUtils';
import { handleDuplicateFormEntryRemoval } from '../notion/automation/FormAutomation';
import { processShukinStatusChange } from '../notion/automation/ShukinAutomation';
import { NotionWebhookSecurity } from './notionWebhookSecurity';

export class UnsupportedNotionWebhookResourceError extends Error {}

export class NotionAutomationService {
  constructor(
    private readonly services: Services,
    private readonly webhookSecurity: NotionWebhookSecurity
  ) {}

  public async handleNotionAutomationWebhookEvent(event: NotionAutomationWebhookEvent) {
    logger.info('Notion Automation: Webhook event received');

    const page = await this.services.notion.client.pages.retrieve({ page_id: event.data.id });
    if (!('parent' in page) || page.parent.type !== 'database_id') {
      throw new UnsupportedNotionWebhookResourceError(
        'Notion automation event did not resolve to a database page'
      );
    }
    if (!this.webhookSecurity.isAllowedDatabase(page.parent.database_id)) {
      throw new UnsupportedNotionWebhookResourceError(
        'Notion automation event resolved outside the configured database allowlist'
      );
    }

    const authoritativeDatabaseId = page.parent.database_id;
    const authoritativeEvent: NotionAutomationWebhookEvent = { ...event, data: page };

    logger.info('Notion Automation: Database event received');

    const shukinDatabaseId = config.getConfig('shukin_databaseid');

    if (areUUIDsEqual(authoritativeDatabaseId, shukinDatabaseId)) {
      await processShukinStatusChange(authoritativeEvent, this.services);
    } else {
      await handleDuplicateFormEntryRemoval(authoritativeEvent, this.services);
    }
  }
}
