import { Client } from '@notionhq/client';
import { MemberService } from './memberService';
import { PracticeService } from './practiceService';
import { ShukinService } from './shukinService';
import { env } from '../../env';
import { logger } from '../../utils/logger';

export class NotionService {
  public client: Client;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public shukinService: ShukinService;

  constructor() {
    logger.info('NotionService の初期化を開始します。');

    const NOTION_TOKEN = env.NOTION_TOKEN;

    if (!NOTION_TOKEN) {
      logger.error('NOTION_TOKEN が環境変数に設定されていません。プログラムを終了します。');
      process.exit(0);
    }

    this.client = new Client({ auth: NOTION_TOKEN });
    this.memberService = new MemberService(this.client);
    this.practiceService = new PracticeService(this.client);
    this.shukinService = new ShukinService(this.client);

    logger.info('NotionService の初期化が終了しました。');
  }
}
