import { Client } from '@notionhq/client';
import { MemberService } from './memberService';
import { PracticeService } from './practiceService';
import { ShukinService } from './shukinService';

export class NotionService {
  public client: Client;
  public memberService: MemberService;
  public practiceService: PracticeService;
  public shukinService: ShukinService;

  constructor() {
    console.log('NotionService の初期化を開始します。');

    const NOTION_TOKEN = process.env.NOTION_TOKEN;

    if (!NOTION_TOKEN) {
      console.error('NOTION_TOKEN が環境変数に設定されていません。プログラムを終了します。');
      process.exit(0);
    }

    this.client = new Client({ auth: NOTION_TOKEN });
    this.memberService = new MemberService(this.client);
    this.practiceService = new PracticeService(this.client);
    this.shukinService = new ShukinService(this.client);

    console.log('NotionService の初期化が終了しました。');
  }
}
