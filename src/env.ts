import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const booleanEnvironmentVariable = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(10000),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_RELAY_WEBHOOK: z.string().url(),
  DISCORD_LOGGER_CHANNEL_ID: z.string().default('1273731421663395973'),
  NOTION_TOKEN: z.string().min(1),
  NOTION_CONFIGURATION_DATABASEID: z.string().min(1),
  SESAME_ENABLED: booleanEnvironmentVariable,
  NOTION_AUTOMATION_ENABLED: booleanEnvironmentVariable,
  NOTION_AUTOMATION_VERIFICATION_TOKEN: z.string().min(1).optional(),
  NOTION_AUTOMATION_ALLOWED_AUTOMATION_IDS: z.string().min(1).optional(),
  NOTION_AUTOMATION_ALLOWED_ACTION_IDS: z.string().min(1).optional(),
  NOTION_AUTOMATION_ALLOWED_DATABASE_IDS: z.string().min(1).optional(),
  REPOSITORY_PATH: z.string().default(''),
  BRANCH: z.string().default('refs/heads/main'),
  DISCORD_VOID_GUILD_ID: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  throw new Error(`Invalid environment variables: ${JSON.stringify(_env.error.format())}`);
}

export const env = _env.data;

export function parseCommaSeparatedIds(value: string): string[] {
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}
