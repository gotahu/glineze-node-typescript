import { tz } from '@date-fns/tz';
import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { config } from '../../config';
import {
  getPageTitle,
  getRelationPropertyValue,
  getStringPropertyValue,
} from '../../utils/notionUtils';
import { logger } from '../../utils/logger';

export const PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY = 'practice_announcement_template_page_id';

export const DEFAULT_PRACTICE_ANNOUNCEMENT_TEMPLATE = `@全員
## {{dateLabel}} 練習連絡

### 時間
- {{timeText}}で実施します。
- **遅刻、早退、欠席**が変更になった人は__パトマネさんに連絡__してください！

### 場所
{{placeText}}

### TT
{{ttText}}

### 持ち物
- 飲み物
- 楽譜

### Notion（FB・録音）
{{notionUrl}}`;

const MAX_TEMPLATE_LENGTH = 20_000;
const MAX_RENDERED_MESSAGE_LENGTH = 2_000;
const PLACEHOLDER_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;

export const AVAILABLE_PLACEHOLDERS = [
  'accessText',
  'dateLabel',
  'notionUrl',
  'pageId',
  'placeNames',
  'placeText',
  'programText',
  'publicityNotice',
  'publicityText',
  'room',
  'teachersNotice',
  'teachersText',
  'timeText',
  'title',
  'ttText',
] as const;

export type PracticeTemplateContext = Record<(typeof AVAILABLE_PLACEHOLDERS)[number], string>;

const ALLOWED_PLACEHOLDERS = new Set<string>(AVAILABLE_PLACEHOLDERS);

export type PracticeTemplateReloadResult = {
  source: 'builtin' | 'notion';
  updated: boolean;
  message: string;
  pageId?: string;
};

type PracticeTemplateCodeBlock = {
  id: string;
  content: string;
};

type RenderOptions = {
  placeRelations?: PageObjectResponse[];
};

export class PracticeTemplateService {
  private template = DEFAULT_PRACTICE_ANNOUNCEMENT_TEMPLATE;
  private source: 'builtin' | 'notion' = 'builtin';
  private templatePageId?: string;

  constructor(private readonly client: Client) {}

  public getStatus(): PracticeTemplateReloadResult {
    return {
      source: this.source,
      updated: false,
      message:
        this.source === 'notion'
          ? `Notion テンプレートを使用中です（ページID: ${this.templatePageId}）。`
          : '組み込みテンプレートを使用中です。',
      pageId: this.templatePageId,
    };
  }

  /** 管理画面の読み取り専用プレビュー。テンプレート自体は秘密情報を含めない。 */
  public getTemplatePreview(): string {
    return this.template;
  }

  public async reload(): Promise<PracticeTemplateReloadResult> {
    const pageId = config.getAllConfigs().get(PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY)?.trim();

    if (!pageId) {
      this.template = DEFAULT_PRACTICE_ANNOUNCEMENT_TEMPLATE;
      this.source = 'builtin';
      this.templatePageId = undefined;
      const result = {
        source: 'builtin' as const,
        updated: true,
        message:
          `Config ${PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY} が未設定のため、` +
          '組み込みテンプレートを使用します。',
      };
      logger.info(result.message);
      return result;
    }

    try {
      const { content: template } = await this.retrieveSingleCodeBlock(pageId);
      this.validateTemplate(template);
      this.template = template;
      this.source = 'notion';
      this.templatePageId = pageId;
      const result = {
        source: 'notion' as const,
        updated: true,
        pageId,
        message: `Notion の練習連絡テンプレートを読み込みました（ページID: ${pageId}）。`,
      };
      logger.info(result.message);
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const result = {
        source: this.source,
        updated: false,
        pageId: this.templatePageId,
        message: `Notion テンプレートを採用できなかったため、最終正常版を維持します: ${reason}`,
      };
      logger.error(result.message);
      return result;
    }
  }

  public async updateTemplate(template: string): Promise<PracticeTemplateReloadResult> {
    this.validateTemplate(template);
    const pageId = config.getAllConfigs().get(PRACTICE_TEMPLATE_PAGE_ID_CONFIG_KEY)?.trim();
    if (!pageId) throw new Error('練習連絡テンプレートページが設定されていません');

    const block = await this.retrieveSingleCodeBlock(pageId);
    const chunks = template.match(/[\s\S]{1,2000}/g) ?? [];
    await this.client.blocks.update({
      block_id: block.id,
      code: {
        rich_text: chunks.map((content) => ({
          type: 'text' as const,
          text: { content },
        })),
      },
    });

    this.template = template;
    this.source = 'notion';
    this.templatePageId = pageId;
    const result = {
      source: 'notion' as const,
      updated: true,
      pageId,
      message: `Notion の練習連絡テンプレートを更新しました（ページID: ${pageId}）。`,
    };
    logger.info(result.message);
    return result;
  }

  public async renderPractice(
    page: PageObjectResponse,
    practiceDate: Date,
    options: RenderOptions = {}
  ): Promise<string> {
    const context = await this.buildContext(page, practiceDate, options);
    const rendered = this.render(this.template, context).trim();

    if (rendered.length > MAX_RENDERED_MESSAGE_LENGTH) {
      throw new Error(
        `練習連絡はレンダリング後 ${rendered.length} 文字になり、` +
          `上限 ${MAX_RENDERED_MESSAGE_LENGTH} 文字を超えています`
      );
    }

    return rendered;
  }

  private async buildContext(
    page: PageObjectResponse,
    practiceDate: Date,
    options: RenderOptions
  ): Promise<PracticeTemplateContext> {
    const places = options.placeRelations ?? (await this.getOptionalRelations(page, '練習場所'));
    const teacherNames = await this.getNameList(page, '先生方');
    const publicityNames = await this.getNameList(page, '情宣');

    const placeNames = places.map(getPageTitle).filter(Boolean);
    const room = this.getOptionalString(page, '部屋');
    const accesses = places
      .map((place) => this.getOptionalString(place, 'アクセス'))
      .filter(Boolean);
    const placeText = [...placeNames, room, ...accesses].filter(Boolean).join('\n');

    const programText = this.getOptionalString(page, '練習内容');
    const teachersText = teacherNames.join('・');
    const publicityText = publicityNames.join('・');
    const teachersNotice = teachersText ? `＊${teachersText}がいらっしゃいます。` : '';
    const publicityNotice = publicityText ? `＊渉外（${publicityText}）` : '';
    const ttText = [programText, teachersNotice, publicityNotice].filter(Boolean).join('\n');
    const pageId = page.id.replaceAll('-', '');

    return {
      accessText: accesses.join('\n'),
      dateLabel: format(practiceDate, 'M/d(EEE)', {
        in: tz('Asia/Tokyo'),
        locale: ja,
      }),
      notionUrl: `https://notion.so/chorglanze/${pageId}`,
      pageId,
      placeNames: placeNames.join('\n'),
      placeText,
      programText,
      publicityNotice,
      publicityText,
      room,
      teachersNotice,
      teachersText,
      timeText:
        this.getOptionalString(page, '時間フォーマット') || this.getOptionalString(page, '時間'),
      title: this.getOptionalString(page, 'タイトル'),
      ttText,
    };
  }

  private render(template: string, context: PracticeTemplateContext): string {
    return template.replace(
      PLACEHOLDER_PATTERN,
      (_match, name: string) => context[name as keyof PracticeTemplateContext] ?? ''
    );
  }

  private validateTemplate(template: string): void {
    if (!template.trim()) throw new Error('コードブロックが空です');
    if (template.length > MAX_TEMPLATE_LENGTH) {
      throw new Error(`テンプレートが ${MAX_TEMPLATE_LENGTH} 文字を超えています`);
    }

    const unknown = [...template.matchAll(PLACEHOLDER_PATTERN)]
      .map((match) => match[1])
      .filter((name) => !ALLOWED_PLACEHOLDERS.has(name));
    if (unknown.length > 0) {
      throw new Error(`未対応のプレースホルダーがあります: ${[...new Set(unknown)].join(', ')}`);
    }

    const withoutKnownPlaceholders = template.replace(PLACEHOLDER_PATTERN, '');
    if (withoutKnownPlaceholders.includes('{{') || withoutKnownPlaceholders.includes('}}')) {
      throw new Error('プレースホルダーの書式が正しくありません');
    }
  }

  private async retrieveSingleCodeBlock(pageId: string): Promise<PracticeTemplateCodeBlock> {
    const codeBlocks: PracticeTemplateCodeBlock[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });

      for (const block of response.results) {
        if (block.object === 'block' && 'type' in block && block.type === 'code') {
          codeBlocks.push({
            id: block.id,
            content: block.code.rich_text.map((text) => text.plain_text).join(''),
          });
        }
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    if (codeBlocks.length !== 1) {
      throw new Error(
        `テンプレートページ直下のコードブロックは1個にしてください（現在 ${codeBlocks.length} 個）`
      );
    }
    return codeBlocks[0];
  }

  private getOptionalString(page: PageObjectResponse, key: string): string {
    if (!page.properties[key]) return '';
    return getStringPropertyValue(page, key) ?? '';
  }

  private async getOptionalRelations(
    page: PageObjectResponse,
    key: string
  ): Promise<PageObjectResponse[]> {
    if (page.properties[key]?.type !== 'relation') return [];
    return getRelationPropertyValue(this.client, page, key);
  }

  private async getNameList(page: PageObjectResponse, key: string): Promise<string[]> {
    const property = page.properties[key];
    if (!property) return [];

    if (property.type === 'relation') {
      const relations = await getRelationPropertyValue(this.client, page, key);
      return relations.map(getPageTitle).filter(Boolean);
    }
    if (property.type === 'multi_select') {
      return property.multi_select.map((option) => option.name).filter(Boolean);
    }
    if (property.type === 'people') {
      return property.people
        .map((person) => ('name' in person ? person.name : undefined))
        .filter((name): name is string => Boolean(name));
    }

    const value = this.getOptionalString(page, key);
    return value ? [value] : [];
  }
}
