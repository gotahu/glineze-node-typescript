import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(10000),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_ERROR_LOG_WEBHOOK: z.string().url(),
  DISCORD_RELAY_WEBHOOK: z.string().url(),
  NOTION_TOKEN: z.string().min(1),
  NOTION_CONFIGURATION_DATABASEID: z.string().min(1),
  REPOSITORY_PATH: z.string().default(''),
  BRANCH: z.string().default('refs/heads/main'),
  LINE_NOTIFY_VOID_TOKEN: z.string().optional(),
  DISCORD_VOID_GUILD_ID: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
