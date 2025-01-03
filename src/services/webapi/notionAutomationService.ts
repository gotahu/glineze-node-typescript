import { config } from '../../config';
import { NotionAutomationWebhookEvent, Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { areUUIDsEqual } from '../../utils/notionUtils';
import { handleDuplicateFormEntryRemoval } from '../notion/automation/FormAutomation';
import { processShukinStatusChange } from '../notion/automation/ShukinAutomation';

export class NotionAutomationService {
  constructor(private readonly services: Services) {}

  public handleNotionAutomationWebhookEvent(event: NotionAutomationWebhookEvent) {
    logger.info('Notion Automation: Webhook event received');
    console.log(event);

    // Handle the event
    if (event.data.parent) {
      if (event.data.parent.type === 'database_id') {
        // Handle the event for a database
        logger.info('Notion Automation: Database event received');

        const databaseId = event.data.parent.database_id;
        const shukinDatabaseId = config.getConfig('shukin_databaseid');

        if (areUUIDsEqual(databaseId, shukinDatabaseId)) {
          processShukinStatusChange(event, this.services);
        } else {
          handleDuplicateFormEntryRemoval(event, this.services);
        }
      } else if (event.data.parent.type === 'page_id') {
        // Handle the event for a page
        logger.info('Notion Automation: Page event received');

        // nothing implemented yet
      }
    }
  }
}
