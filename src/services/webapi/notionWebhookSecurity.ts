import { createHmac, timingSafeEqual } from 'node:crypto';
import { NotionAutomationWebhookEvent } from '../../types/types';

const SIGNATURE_PREFIX = 'sha256=';
const DEFAULT_REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

export type EventAuthorization = 'accepted' | 'replay' | 'unsupported_source';

type NotionWebhookSecurityOptions = {
  verificationToken: string;
  allowedAutomationIds: readonly string[];
  allowedActionIds: readonly string[];
  allowedDatabaseIds: readonly string[];
  replayTtlMs?: number;
  now?: () => number;
};

export class NotionWebhookSecurity {
  private readonly verificationToken: string;
  private readonly allowedAutomationIds: Set<string>;
  private readonly allowedActionIds: Set<string>;
  private readonly allowedDatabaseIds: Set<string>;
  private readonly replayTtlMs: number;
  private readonly now: () => number;
  private readonly processedEventIds = new Map<string, number>();

  constructor(options: NotionWebhookSecurityOptions) {
    this.verificationToken = options.verificationToken;
    this.allowedAutomationIds = toNormalizedSet(options.allowedAutomationIds);
    this.allowedActionIds = toNormalizedSet(options.allowedActionIds);
    this.allowedDatabaseIds = toNormalizedSet(options.allowedDatabaseIds);
    this.replayTtlMs = options.replayTtlMs ?? DEFAULT_REPLAY_TTL_MS;
    this.now = options.now ?? Date.now;

    if (
      !this.verificationToken ||
      this.allowedAutomationIds.size === 0 ||
      this.allowedActionIds.size === 0 ||
      this.allowedDatabaseIds.size === 0 ||
      this.replayTtlMs <= 0
    ) {
      throw new Error('Notion webhook security configuration is incomplete');
    }
  }

  public verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature?.startsWith(SIGNATURE_PREFIX)) return false;

    const expected = `${SIGNATURE_PREFIX}${createHmac('sha256', this.verificationToken)
      .update(rawBody)
      .digest('hex')}`;
    const suppliedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    return (
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer)
    );
  }

  public reserveEvent(event: NotionAutomationWebhookEvent): EventAuthorization {
    const automationId = normalizeId(event.source.automation_id);
    const actionId = normalizeId(event.source.action_id);
    const eventId = normalizeId(event.source.event_id);

    if (
      !automationId ||
      !actionId ||
      !eventId ||
      !this.allowedAutomationIds.has(automationId) ||
      !this.allowedActionIds.has(actionId)
    ) {
      return 'unsupported_source';
    }

    const now = this.now();
    this.pruneExpiredEvents(now);
    if (this.processedEventIds.has(eventId)) return 'replay';

    this.processedEventIds.set(eventId, now + this.replayTtlMs);
    return 'accepted';
  }

  public releaseEvent(eventId: string): void {
    this.processedEventIds.delete(normalizeId(eventId));
  }

  public isAllowedDatabase(databaseId: string): boolean {
    return this.allowedDatabaseIds.has(normalizeId(databaseId));
  }

  private pruneExpiredEvents(now: number): void {
    for (const [eventId, expiresAt] of this.processedEventIds) {
      if (expiresAt <= now) this.processedEventIds.delete(eventId);
    }
  }
}

function toNormalizedSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizeId).filter(Boolean));
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replaceAll('-', '');
}
