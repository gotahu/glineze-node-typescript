import { Client } from '@notionhq/client';
import { config } from '../../config/config';
import { LINEDiscordPairService } from './lineDiscordPairService';
import { MemberService } from './memberService';
import { PracticeService } from './practiceService';
import { ShukinService } from './shukinService';
import { logger } from '../../utils/logger';

export class NotionService {
  private static instance: NotionService;

  public client: Client;
  public lineDiscordPairService: LINEDiscordPairService;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public shukinService: ShukinService;

  constructor() {
    this.client = new Client({ auth: config.notion.token });
    this.lineDiscordPairService = new LINEDiscordPairService(this.client);
    this.memberService = new MemberService(this.client);
    this.practiceService = new PracticeService(this.client);
    this.shukinService = new ShukinService(this.client);
  }

  public async initialize(): Promise<void> {
    try {
      await this.lineDiscordPairService.initialize();
    } catch (error) {
      logger.error(`Failed to initialize NotionService: ${error}`);
      throw new Error('Failed to initialize NotionService');
    }
  }

  public static getInstance(): NotionService {
    if (!NotionService.instance) {
      NotionService.instance = new NotionService();
    }
    return NotionService.instance;
  }
}
