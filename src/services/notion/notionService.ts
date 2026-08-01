import { Client } from '@notionhq/client';
import { MemberService } from '../../features/collection/MemberService';
import { ShukinService } from '../../features/collection/ShukinService';
import { PracticeService } from '../../features/practice/PracticeService';
import { env } from '../../env';
import { logger } from '../../utils/logger';
import { EXTERNAL_API_TIMEOUT_MS } from '../../shared/resilience/externalApiPolicy';

export class NotionService {
  public client: Client;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public shukinService: ShukinService;

  constructor() {
    logger.info('NotionService の初期化を開始します。');

    const NOTION_TOKEN = env.NOTION_TOKEN;

    if (!NOTION_TOKEN) {
      const message = 'NOTION_TOKEN が環境変数に設定されていません。';
      logger.error(message);
      throw new Error(message);
    }

    this.client = new Client({
      auth: NOTION_TOKEN,
      timeoutMs: EXTERNAL_API_TIMEOUT_MS,
      retry: { maxRetries: 2, initialRetryDelayMs: 250, maxRetryDelayMs: 2_000 },
    });
    this.memberService = new MemberService(this.client);
    this.practiceService = new PracticeService(this.client);
    this.shukinService = new ShukinService(this.client);

    logger.info('NotionService の初期化が終了しました。');
  }
}
