import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';
import { GlanzeMember, ShukinReply, ShukinInfo } from '../../types/types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { config } from '../../config';
import { queryAllDatabasePages } from '../../utils/notionUtils';

export class ShukinService {
  private client: Client;

  private static readonly ERROR_MESSAGES = {
    NO_DATA_FOUND:
      'Notion上の集金DBにあなたのデータが見つかりませんでした。マネジに連絡してください。',
  };

  private static readonly STATUS_NOTES = [
    '（受取済）（振込済）の場合、パトマネさんが受け取ったあと、会計さんが確認中です。',
    '（受取確認済）（振込確認済）の場合、会計さんの確認まで全て終了しています。',
  ];

  constructor(client: Client) {
    this.client = client;
  }

  public async retrieveShukinStatus(member: GlanzeMember): Promise<ShukinReply> {
    try {
      const databaseId = config.getConfig('shukin_databaseid');
      const response = await queryAllDatabasePages(this.client, databaseId, {
        property: '団員',
        relation: { contains: member.notionPageId },
      });

      if (response.length === 0) {
        throw new Error(ShukinService.ERROR_MESSAGES.NO_DATA_FOUND);
      } else if (response.length > 1) {
        // 複数のデータが見つかった場合はエラーログを出す
        // 処理は継続する
        logger.error(
          `retrieveShukinStatus: 団員 ${member.name} に対して、${response.length}件のデータが見つかりました。`
        );
      }

      const page = response[0] as PageObjectResponse;
      const shukinList = this.extractShukinInfo(page);
      const replyMessage = this.formatShukinStatusMessage(member.name, shukinList);

      return { status: 'success', message: replyMessage };
    } catch (error) {
      logger.error(`Failed to retrieve shukin status: ${error}`);
      return { status: 'error', message: error.message };
    }
  }

  public extractShukinInfo(page: PageObjectResponse): ShukinInfo[] {
    const shukinList: ShukinInfo[] = [];

    for (const [key, prop] of Object.entries(page.properties)) {
      if (prop.type === 'number' && prop.number) {
        const statusKey = `${key}ステータス`;
        const statusProp = page.properties[statusKey];

        if (statusProp && statusProp.type === 'status' && statusProp.status) {
          shukinList.push({
            shukinName: key,
            shukinAmount: `${prop.number}円`,
            shukinStatus: statusProp.status.name,
          });
        } else {
          throw new Error(
            `「${key}ステータス」プロパティが見つかりません。ステータスプロパティの名前は「金額プロパティの名前＋ステータス」にする必要があります。`
          );
        }
      }
    }

    return shukinList;
  }

  public formatShukinStatusMessage(memberName: string, shukinList: ShukinInfo[]): string {
    let message = `${memberName} さんの集金状況をお知らせします。\n### 集金状況`;

    if (shukinList.length === 0) {
      message += '\n- 集金対象がありません。';
    } else {
      shukinList.forEach((info) => {
        message += `\n- ${info.shukinName}：${info.shukinAmount}（${info.shukinStatus}）`;
      });
    }

    message += '\n### 注意事項';
    ShukinService.STATUS_NOTES.forEach((note) => {
      message += `\n- ${note}`;
    });

    return message;
  }
}
