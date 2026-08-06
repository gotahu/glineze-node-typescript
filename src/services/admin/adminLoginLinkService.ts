import { Client } from '@notionhq/client';
import { logger } from '../../utils/logger';

export type IssuedAdminLoginToken = {
  token: string;
  issuedAt: Date;
  expiresAt: Date;
};

export type AdminLoginTokenIssuer = {
  issue(): Promise<IssuedAdminLoginToken>;
};

export type AdminLoginLinkStatus = {
  lastAttemptAt?: Date;
  lastSuccessAt?: Date;
  expiresAt?: Date;
  nextRotationAt?: Date;
  error?: string;
};

type EditableLoginBlock =
  | { type: 'paragraph'; paragraph: { rich_text: unknown[] } }
  | { type: 'callout'; callout: { rich_text: unknown[] } };

export class AdminLoginLinkService {
  private readonly status: AdminLoginLinkStatus = {};

  constructor(
    private readonly notion: Pick<Client, 'blocks'>,
    private readonly tokenIssuer: AdminLoginTokenIssuer,
    private readonly blockId: string,
    private readonly baseUrl: string
  ) {}

  public getStatus(): AdminLoginLinkStatus {
    return { ...this.status };
  }

  public setNextRotationAt(value: Date): void {
    this.status.nextRotationAt = value;
  }

  public async rotate(): Promise<IssuedAdminLoginToken> {
    this.status.lastAttemptAt = new Date();
    try {
      const issued = await this.tokenIssuer.issue();
      const url = new URL('/admin/login', this.baseUrl);
      url.searchParams.set('token', issued.token);
      await this.updateNotionBlock(url.toString());

      this.status.lastSuccessAt = new Date();
      this.status.expiresAt = issued.expiresAt;
      this.status.error = undefined;
      logger.info(
        `管理画面ログインリンクを更新しました（発行: ${issued.issuedAt.toISOString()}、期限: ${issued.expiresAt.toISOString()}）。`
      );
      return issued;
    } catch (error) {
      this.status.error =
        error instanceof InvalidAdminLoginBlockError
          ? error.message
          : 'Notion のログインリンクを更新できませんでした。';
      logger.error('管理画面ログインリンクの更新に失敗しました。');
      throw error;
    }
  }

  private async updateNotionBlock(url: string): Promise<void> {
    const block = await this.notion.blocks.retrieve({ block_id: this.blockId });
    if (!('type' in block) || (block.type !== 'paragraph' && block.type !== 'callout')) {
      throw new InvalidAdminLoginBlockError();
    }

    const richText = [
      {
        type: 'text' as const,
        text: {
          content: 'Glineze 管理画面を開く',
          link: { url },
        },
      },
    ];
    const update =
      block.type === 'paragraph'
        ? { paragraph: { rich_text: richText } }
        : { callout: { rich_text: richText } };

    await this.notion.blocks.update({ block_id: this.blockId, ...update } as Parameters<
      Client['blocks']['update']
    >[0]);
  }
}

export class InvalidAdminLoginBlockError extends Error {
  constructor() {
    super('管理画面リンク用 Notion ブロックは paragraph または callout が必要です。');
    this.name = 'InvalidAdminLoginBlockError';
  }
}

export function isEditableLoginBlock(value: unknown): value is EditableLoginBlock {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'paragraph' || value.type === 'callout';
}
