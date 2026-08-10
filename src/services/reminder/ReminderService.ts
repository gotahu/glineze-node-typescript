import { TZDate } from '@date-fns/tz';
import { Client as NotionClient } from '@notionhq/client';
import { Client as DiscordClient, Guild, GuildBasedChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { CreateReminderInput, Reminder, ReminderRepository } from './ReminderRepository';

const JST = 'Asia/Tokyo';
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];

export function parseJstDateTime(value: string, now = new Date()): Date | undefined {
  const normalized = value
    .trim()
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return undefined;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const [year, month, day, hour, minute] = parts;
  if (hour > 23 || minute > 59) return undefined;
  const date = new TZDate(year, month - 1, day, hour, minute, 0, JST);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    return undefined;
  if (date.getTime() < now.getTime() + 60_000 || date.getTime() > now.getTime() + MAX_FUTURE_MS)
    return undefined;
  return new Date(date.getTime());
}

export function tomorrowAtNine(now = new Date()): Date {
  const current = new TZDate(now, JST);
  return new Date(
    new TZDate(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
      9,
      0,
      0,
      JST
    ).getTime()
  );
}

export class ReminderService {
  public readonly repository: ReminderRepository;

  constructor(client: NotionClient, databaseId: string) {
    this.repository = new ReminderRepository(client, databaseId);
  }

  public create(input: CreateReminderInput): Promise<Reminder> {
    return this.repository.create(input);
  }

  public list(creatorId: string): Promise<Reminder[]> {
    return this.repository.listPendingByCreator(creatorId);
  }

  public async canCreate(creatorId: string): Promise<boolean> {
    return (await this.repository.listPendingByCreator(creatorId, 20)).length < 20;
  }

  public cancel(pageId: string, creatorId: string): Promise<boolean> {
    return this.repository.cancel(pageId, creatorId);
  }

  public async resolveAllRole(guild: Guild): Promise<string[]> {
    const roles = await guild.roles.fetch();
    return [...roles.values()].filter((role) => role.name === '全員').map((role) => role.id);
  }

  public async dispatchDue(discord: DiscordClient, now = new Date()): Promise<void> {
    const stale = await this.repository.findStaleProcessing(new Date(now.getTime() - 10 * 60_000));
    for (const reminder of stale) await this.repository.restorePending(reminder);
    const reminders = await this.repository.findDue(now);
    for (const reminder of reminders) {
      if (now.getTime() - reminder.scheduledAt.getTime() > 30 * 60_000) {
        await this.repository.markDeliveryFailure(
          reminder,
          '通知予定時刻から30分以上経過しました。',
          now
        );
        continue;
      }
      await this.dispatchOne(discord, reminder, now);
    }
  }

  private async dispatchOne(discord: DiscordClient, reminder: Reminder, now: Date): Promise<void> {
    await this.repository.markProcessing(reminder, now);
    try {
      const channel = await discord.channels.fetch(reminder.destinationId);
      if (!channel?.isSendable() || !('guild' in channel)) {
        throw new Error('通知先チャンネルまたはスレッドへ送信できません。');
      }
      const guildChannel = channel as GuildBasedChannel & { send: typeof channel.send };
      if (guildChannel.guild.id !== reminder.guildId)
        throw new Error('通知先サーバーが一致しません。');

      let message = reminder.message;
      let warning: string | undefined;
      let roleId: string | undefined;
      if (message.includes('@全員') && reminder.mentionRoleId) {
        const role = await guildChannel.guild.roles.fetch(reminder.mentionRoleId).catch(() => null);
        if (role) {
          roleId = role.id;
          message = message.replaceAll('@全員', `<@&${role.id}>`);
        } else {
          warning = '登録時の「全員」ロールが削除されたため、@全員を文字列のまま送信しました。';
        }
      }

      const sent = await channel.send({
        content: `⏰ **リマインダー**\n\n${message}\n\n登録者: <@${reminder.creatorId}>`,
        allowedMentions: { parse: [], users: [reminder.creatorId], roles: roleId ? [roleId] : [] },
      });
      await this.repository.markSent(reminder, sent.id, now, warning);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryDelay = RETRY_DELAYS_MS[reminder.attempts];
      const retryAt = retryDelay ? new Date(now.getTime() + retryDelay) : undefined;
      await this.repository.markDeliveryFailure(reminder, message, now, retryAt);
      logger.error(`Reminder delivery failed for ${reminder.pageId}: ${message}`);
    }
  }
}
