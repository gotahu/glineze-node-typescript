import { randomUUID } from 'node:crypto';
import * as Iron from '@hapi/iron';
import { AdminLoginTokenIssuer, IssuedAdminLoginToken } from './adminLoginLinkService';

const ADMIN_TOKEN_KIND = 'glineze-admin-login';

type AdminLoginTokenPayload = {
  kind: typeof ADMIN_TOKEN_KIND;
  version: 1;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export class AdminLoginTokenService implements AdminLoginTokenIssuer {
  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly now: () => Date = () => new Date()
  ) {
    if (Buffer.byteLength(secret) < 32) {
      throw new Error('ADMIN_AUTH_SECRET は32 byte以上必要です。');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('管理画面ログイントークンの有効期間が不正です。');
    }
  }

  public async issue(): Promise<IssuedAdminLoginToken> {
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + this.ttlMs);
    const payload: AdminLoginTokenPayload = {
      kind: ADMIN_TOKEN_KIND,
      version: 1,
      issuedAt: issuedAt.getTime(),
      expiresAt: expiresAt.getTime(),
      nonce: randomUUID(),
    };
    const token = await Iron.seal(payload, this.secret, {
      ...Iron.defaults,
      ttl: this.ttlMs,
    });
    return { token, issuedAt, expiresAt };
  }

  public async verify(token: string): Promise<AdminLoginTokenPayload> {
    if (!token || token.length > 8_192) throw new InvalidAdminLoginTokenError();
    try {
      const value: unknown = await Iron.unseal(token, this.secret, Iron.defaults);
      if (!isAdminLoginTokenPayload(value) || value.expiresAt <= this.now().getTime()) {
        throw new InvalidAdminLoginTokenError();
      }
      return value;
    } catch {
      throw new InvalidAdminLoginTokenError();
    }
  }
}

function isAdminLoginTokenPayload(value: unknown): value is AdminLoginTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === ADMIN_TOKEN_KIND &&
    candidate.version === 1 &&
    typeof candidate.issuedAt === 'number' &&
    typeof candidate.expiresAt === 'number' &&
    candidate.expiresAt > candidate.issuedAt &&
    typeof candidate.nonce === 'string' &&
    candidate.nonce.length > 0
  );
}

export class InvalidAdminLoginTokenError extends Error {
  constructor() {
    super('管理画面ログイントークンが無効です。');
    this.name = 'InvalidAdminLoginTokenError';
  }
}
