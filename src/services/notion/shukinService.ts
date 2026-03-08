import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { config } from '../../config';
import { GlanzeMember, ShukinInfo, ShukinReply } from '../../types/types';
import { logger } from '../../utils/logger';
import {
  getStatusPropertyGroup,
  queryAllDatabasePages,
  StatusPropertyType,
} from '../../utils/notionUtils';

export class ShukinService {
  private client: Client;

  private readonly ERROR_MESSAGES = {
    NO_DATA_FOUND:
      'Notion上の集金DBにあなたのデータが見つかりませんでした。マネジに連絡してください。',
  };

  private readonly STATUS_NOTES = [
    '内容に相違がある場合、パトマネさんに確認をしてください。',
    'もう一度確認したい場合は、何らかのメッセージをこの DM に送信してください。',
  ];

  private readonly PARTITION_LINE = '=============================';

  constructor(client: Client) {
    this.client = client;
  }

  public async retrieveShukinStatus(member: GlanzeMember): Promise<ShukinReply> {
    logger.info(`Starting retrieveShukinStatus for member: ${member.name} (Notion Page ID: ${member.notionPageId})`);
    try {
      const databaseId = config.getConfig('shukin_databaseid');
      logger.info(`Using databaseId for shukin: ${databaseId}`);
      
      logger.debug(`Executing queryAllDatabasePages for member: ${member.name}`);
      const response = await queryAllDatabasePages(this.client, databaseId, {
        property: '団員',
        relation: { contains: member.notionPageId },
      });
      logger.info(`queryAllDatabasePages result: found ${response.length} pages for member: ${member.name}`);

      if (response.length === 0) {
        throw new Error(this.ERROR_MESSAGES.NO_DATA_FOUND);
      } else if (response.length > 1) {
        // 複数のデータが見つかった場合はエラーログを出す
        // 処理は継続する
        logger.error(
          `retrieveShukinStatus: 団員 ${member.name} に対して、${response.length}件のデータが見つかりました。`
        );
      }

      const page = response[0] as PageObjectResponse;
      const shukinList = await this.extractShukinInfo(page);
      const replyMessage = this.formatShukinStatusMessage(member.name, shukinList);

      logger.info(`Successfully completed retrieveShukinStatus for member: ${member.name}`);
      return { status: 'success', message: replyMessage };
    } catch (error: any) {
      logger.error(`Failed to retrieve shukin status for member ${member.name}: ${error.stack || error}`);
      return { status: 'error', message: error.message };
    }
  }

  public async extractShukinInfo(page: PageObjectResponse): Promise<ShukinInfo[]> {
    logger.debug(`Starting extractShukinInfo for page ID: ${page.id}`);
    const shukinList: ShukinInfo[] = [];

    for (const [key, prop] of Object.entries(page.properties)) {
      if (prop.type === 'number' && prop.number) {
        const statusKey = `${key}ステータス`;
        const statusProp = page.properties[statusKey];

        if (statusProp && statusProp.type === 'status' && statusProp.status) {
          shukinList.push({
            shukinName: key,
            shukinAmount: `${prop.number.toLocaleString()}円`,
            shukinStatus: statusProp.status.name,
            shukinStatusPropertyType: await getStatusPropertyGroup(this.client, page, statusKey),
          });
        } else {
          throw new Error(
            `「${key}ステータス」プロパティが見つかりません。ステータスプロパティの名前は「金額プロパティの名前＋ステータス」にする必要があります。`
          );
        }
      }
    }

    logger.debug(`Successfully extracted ${shukinList.length} shukin items from page ID: ${page.id}`);
    return shukinList;
  }

  public formatShukinStatusMessage(memberName: string, shukinList: ShukinInfo[]): string {
    logger.debug(`Formatting shukin status message for member: ${memberName} with ${shukinList.length} items`);
    let message = `${this.PARTITION_LINE}\n## ${memberName} さんの集金状況\n`;

    const groups = [
      { name: '⚠️未払い', group: StatusPropertyType.TODO },
      { name: '🔄会計確認中', group: StatusPropertyType.IN_PROGRESS },
      { name: '✅支払済', group: StatusPropertyType.COMPLETE },
    ];

    for (const group of groups) {
      const filteredShukinList = shukinList.filter(
        (shukin) => shukin.shukinStatusPropertyType === group.group
      );

      message += `### ${group.name}\n`;
      if (filteredShukinList.length > 0) {
        filteredShukinList.forEach((shukin) => {
          message += `- ${shukin.shukinName}: ${shukin.shukinAmount}\n`;
        });
      } else {
        message += `この項目の集金はありません。\n`;
      }
    }

    message += '\n';

    this.STATUS_NOTES.forEach((note) => {
      message += `${note}\n`;
    });

    message += this.PARTITION_LINE;

    return message;
  }
}
