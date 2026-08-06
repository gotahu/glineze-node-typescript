import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const booleanEnvironmentVariable = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(10000),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_RELAY_WEBHOOK: z.string().url(),
    NOTION_TOKEN: z.string().min(1),
    NOTION_CONFIGURATION_DATABASEID: z.string().min(1),
    SESAME_ENABLED: booleanEnvironmentVariable,
    NOTION_AUTOMATION_ENABLED: booleanEnvironmentVariable,
    NOTION_AUTOMATION_VERIFICATION_TOKEN: z.string().min(1).optional(),
    NOTION_AUTOMATION_ALLOWED_AUTOMATION_IDS: z.string().min(1).optional(),
    NOTION_AUTOMATION_ALLOWED_ACTION_IDS: z.string().min(1).optional(),
    NOTION_AUTOMATION_ALLOWED_DATABASE_IDS: z.string().min(1).optional(),
    ADMIN_ENABLED: booleanEnvironmentVariable,
    ADMIN_BASE_URL: z.string().url().optional(),
    ADMIN_AUTH_SECRET: z.string().min(32).optional(),
    ADMIN_NOTION_LOGIN_BLOCK_ID: z.string().min(1).optional(),
    ADMIN_TOKEN_ROTATION_CRON: z.string().min(1).default('5 4 * * *'),
    ADMIN_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(48),
    ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
    REPOSITORY_PATH: z.string().default(''),
    BRANCH: z.string().default('refs/heads/main'),
    LINE_NOTIFY_VOID_TOKEN: z.string().optional(),
    DISCORD_VOID_GUILD_ID: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (!value.ADMIN_ENABLED) return;
    for (const key of [
      'ADMIN_BASE_URL',
      'ADMIN_AUTH_SECRET',
      'ADMIN_NOTION_LOGIN_BLOCK_ID',
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when ADMIN_ENABLED=true`,
        });
      }
    }
    if (value.ADMIN_BASE_URL) {
      const adminUrl = new URL(value.ADMIN_BASE_URL);
      if (
        adminUrl.protocol !== 'https:' ||
        adminUrl.username ||
        adminUrl.password ||
        adminUrl.pathname !== '/' ||
        adminUrl.search ||
        adminUrl.hash
      ) {
        context.addIssue({
          code: 'custom',
          path: ['ADMIN_BASE_URL'],
          message: 'ADMIN_BASE_URL must be an HTTPS origin without credentials, path, or query',
        });
      }
    }
  });

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

export function parseCommaSeparatedIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
