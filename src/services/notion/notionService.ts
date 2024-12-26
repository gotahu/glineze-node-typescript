import { Client } from '@notionhq/client';
import { LINEDiscordPairService } from './lineDiscordPairService';
import { MemberService } from './memberService';
import { PracticeService } from './practiceService';
import { ShukinService } from './shukinService';

export class NotionService {
  public client: Client;
  public lineDiscordPairService: LINEDiscordPairService;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public shukinService: ShukinService;

  constructor() {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;

    if (!NOTION_TOKEN) {
      throw new Error('NOTION_TOKEN が環境変数に設定されていません。');
    }

    this.client = new Client({ auth: NOTION_TOKEN });
    this.lineDiscordPairService = new LINEDiscordPairService(this.client);
    this.memberService = new MemberService(this.client);
    this.practiceService = new PracticeService(this.client);
    this.shukinService = new ShukinService(this.client);
  }
}
