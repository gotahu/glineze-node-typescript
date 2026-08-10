import { Client } from '@notionhq/client';
import {
  CreatePageParameters,
  PageObjectResponse,
  QueryDataSourceParameters,
} from '@notionhq/client/build/src/api-endpoints';

export type ReminderStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type ReminderDestinationType = 'channel' | 'thread';

export interface Reminder {
  pageId: string;
  name: string;
  message: string;
  scheduledAt: Date;
  guildId: string;
  destinationId: string;
  destinationType: ReminderDestinationType;
  creatorId: string;
  mentionRoleId?: string;
  status: ReminderStatus;
  attempts: number;
  nextRetryAt?: Date;
  lockedAt?: Date;
}

export interface CreateReminderInput {
  name: string;
  message: string;
  scheduledAt: Date;
  guildId: string;
  destinationId: string;
  destinationType: ReminderDestinationType;
  creatorId: string;
  mentionRoleId?: string;
}

const text = (value: string) => [{ type: 'text' as const, text: { content: value } }];

export class ReminderRepository {
  private dataSourceId?: string;

  constructor(
    private readonly client: Client,
    private readonly databaseId: string
  ) {}

  private async getDataSourceId(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId;
    const database = await this.client.databases.retrieve({ database_id: this.databaseId });
    if (!('data_sources' in database) || database.data_sources.length === 0) {
      throw new Error('リマインダーDBにデータソースがありません。');
    }
    this.dataSourceId = database.data_sources[0].id;
    return this.dataSourceId;
  }

  public async create(input: CreateReminderInput): Promise<Reminder> {
    const properties: NonNullable<CreatePageParameters['properties']> = {
      Name: { title: text(input.name) },
      Message: { rich_text: text(input.message) },
      'Scheduled At': { date: { start: input.scheduledAt.toISOString() } },
      'Guild ID': { rich_text: text(input.guildId) },
      'Destination ID': { rich_text: text(input.destinationId) },
      'Destination Type': { select: { name: input.destinationType } },
      'Creator ID': { rich_text: text(input.creatorId) },
      Status: { select: { name: 'pending' } },
      Attempts: { number: 0 },
      ...(input.mentionRoleId
        ? { 'Mention Role ID': { rich_text: text(input.mentionRoleId) } }
        : {}),
    };
    const page = await this.client.pages.create({
      parent: { type: 'data_source_id', data_source_id: await this.getDataSourceId() },
      properties,
    });
    if (!('properties' in page)) throw new Error('作成したリマインダーを取得できませんでした。');
    return this.toReminder(page);
  }

  public async listPendingByCreator(creatorId: string, limit = 10): Promise<Reminder[]> {
    const pages = await this.query({
      and: [
        { property: 'Creator ID', rich_text: { equals: creatorId } },
        { property: 'Status', select: { equals: 'pending' } },
      ],
    });
    return pages
      .map((page) => this.toReminder(page))
      .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
      .slice(0, limit);
  }

  public async findDue(now: Date): Promise<Reminder[]> {
    const pages = await this.query({
      and: [
        { property: 'Status', select: { equals: 'pending' } },
        { property: 'Scheduled At', date: { on_or_before: now.toISOString() } },
      ],
    });
    return pages
      .map((page) => this.toReminder(page))
      .filter((reminder) => !reminder.nextRetryAt || reminder.nextRetryAt <= now)
      .slice(0, 50);
  }

  public async findStaleProcessing(before: Date): Promise<Reminder[]> {
    const pages = await this.query({
      and: [
        { property: 'Status', select: { equals: 'processing' } },
        { property: 'Locked At', date: { on_or_before: before.toISOString() } },
      ],
    });
    return pages.map((page) => this.toReminder(page));
  }

  public async cancel(pageId: string, creatorId: string): Promise<boolean> {
    const page = await this.client.pages.retrieve({ page_id: pageId });
    if (!('properties' in page)) return false;
    const reminder = this.toReminder(page);
    if (reminder.creatorId !== creatorId || reminder.status !== 'pending') return false;
    await this.update(pageId, { Status: { select: { name: 'cancelled' } } });
    return true;
  }

  public async markProcessing(reminder: Reminder, now: Date): Promise<void> {
    await this.update(reminder.pageId, {
      Status: { select: { name: 'processing' } },
      'Locked At': { date: { start: now.toISOString() } },
    });
  }

  public async restorePending(reminder: Reminder): Promise<void> {
    await this.update(reminder.pageId, {
      Status: { select: { name: 'pending' } },
      'Locked At': { date: null },
      'Last Error': { rich_text: text('前回の配信処理が完了しなかったため再実行します。') },
    });
  }

  public async markSent(
    reminder: Reminder,
    messageId: string,
    now: Date,
    warning?: string
  ): Promise<void> {
    await this.update(reminder.pageId, {
      Status: { select: { name: 'sent' } },
      Attempts: { number: reminder.attempts + 1 },
      'Sent At': { date: { start: now.toISOString() } },
      'Discord Message ID': { rich_text: text(messageId) },
      'Last Error': { rich_text: warning ? text(warning.slice(0, 1900)) : [] },
    });
  }

  public async markDeliveryFailure(
    reminder: Reminder,
    error: string,
    now: Date,
    retryAt?: Date
  ): Promise<void> {
    const attempts = reminder.attempts + 1;
    await this.update(reminder.pageId, {
      Status: { select: { name: retryAt ? 'pending' : 'failed' } },
      Attempts: { number: attempts },
      'Next Retry At': retryAt ? { date: { start: retryAt.toISOString() } } : { date: null },
      'Last Error': { rich_text: text(error.slice(0, 1900)) },
      'Locked At': { date: null },
    });
  }

  private async query(filter: QueryDataSourceParameters['filter']): Promise<PageObjectResponse[]> {
    const response = await this.client.dataSources.query({
      data_source_id: await this.getDataSourceId(),
      filter,
      page_size: 100,
      result_type: 'page',
    });
    return response.results.filter(
      (result): result is PageObjectResponse => 'properties' in result
    );
  }

  private async update(
    pageId: string,
    properties: NonNullable<CreatePageParameters['properties']>
  ): Promise<void> {
    await this.client.pages.update({ page_id: pageId, properties });
  }

  private toReminder(page: PageObjectResponse): Reminder {
    const stringValue = (key: string): string => {
      const property = page.properties[key];
      if (!property) return '';
      if (property.type === 'title') return property.title.map((item) => item.plain_text).join('');
      if (property.type === 'rich_text')
        return property.rich_text.map((item) => item.plain_text).join('');
      if (property.type === 'select') return property.select?.name ?? '';
      return '';
    };
    const dateValue = (key: string): Date | undefined => {
      const property = page.properties[key];
      return property?.type === 'date' && property.date ? new Date(property.date.start) : undefined;
    };
    const attempts = page.properties.Attempts;
    const scheduledAt = dateValue('Scheduled At');
    if (!scheduledAt || !stringValue('Message') || !stringValue('Destination ID')) {
      throw new Error(`リマインダー ${page.id} の必須項目が不足しています。`);
    }
    return {
      pageId: page.id,
      name: stringValue('Name'),
      message: stringValue('Message'),
      scheduledAt,
      guildId: stringValue('Guild ID'),
      destinationId: stringValue('Destination ID'),
      destinationType: stringValue('Destination Type') as ReminderDestinationType,
      creatorId: stringValue('Creator ID'),
      mentionRoleId: stringValue('Mention Role ID') || undefined,
      status: stringValue('Status') as ReminderStatus,
      attempts: attempts?.type === 'number' ? (attempts.number ?? 0) : 0,
      nextRetryAt: dateValue('Next Retry At'),
      lockedAt: dateValue('Locked At'),
    };
  }
}
