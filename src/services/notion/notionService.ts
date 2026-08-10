import { Client } from '@notionhq/client';
import { MemberService } from './memberService';
import { PracticeService } from './practiceService';
import { PracticeTemplateService } from './practiceTemplateService';
import { ShukinService } from './shukinService';
import { env } from '../../env';
import { logger } from '../../utils/logger';
import { ReminderService } from '../reminder/ReminderService';
import { config } from '../../config';

export class NotionService {
  public client: Client;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public practiceTemplateService: PracticeTemplateService;
  public shukinService: ShukinService;
  public reminderService?: ReminderService;

  constructor() {
    logger.info('NotionService の初期化を開始します。');

    const NOTION_TOKEN = env.NOTION_TOKEN;

    if (!NOTION_TOKEN) {
      logger.error('NOTION_TOKEN が環境変数に設定されていません。プログラムを終了します。');
      process.exit(0);
    }

    this.client = new Client({ auth: NOTION_TOKEN });
    this.memberService = new MemberService(this.client);
    this.practiceTemplateService = new PracticeTemplateService(this.client);
    this.practiceService = new PracticeService(this.client, this.practiceTemplateService);
    this.shukinService = new ShukinService(this.client);
    this.reloadReminderService();

    logger.info('NotionService の初期化が終了しました。');
  }

  public reloadReminderService(): void {
    const databaseId = config.getAllConfigs().get('reminder_databaseid');
    this.reminderService = databaseId ? new ReminderService(this.client, databaseId) : undefined;
  }
}
