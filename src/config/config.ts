import dotenv from 'dotenv';
dotenv.config();

export const config = {
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
  },
  notion: {
    token: process.env.NOTION_TOKEN,
    configurationDatabaseId: process.env.NOTION_CONFIGURATION_DATABASEID,
  },
  lineNotify: {
    voidToken: process.env.LINE_NOTIFY_VOID_TOKEN,
  },
  server: {
    port: Number(process.env.SERVER_PORT) || 3000,
  },
  app: {
    port: Number(process.env.APP_PORT) || 3001,
  },
  webhook: {
    port: Number(process.env.WEBHOOK_PORT) || 3002,
    secret: process.env.WEBHOOK_SECRET,
    restartToken: process.env.WEBHOOK_RESTART_TOKEN,
  },
  oshigla: {
    port: Number(process.env.OSHIGLA_PORT) || 3003,
  },
  repository: {
    path: process.env.REPOSITORY_PATH,
    branch: process.env.BRANCH || 'refs/heads/main',
  },
};

// Validation
if (!config.discord.botToken) {
  throw new Error('DISCORD_BOT_TOKEN is not defined');
}

if (!config.notion.token) {
  throw new Error('NOTION_TOKEN is not defined');
}

if (!config.notion.configurationDatabaseId) {
  throw new Error('NOTION_CONFIGURATION_DATABASEID is not defined');
}

if (!config.webhook.secret) {
  throw new Error('WEBHOOK_SECRET is not defined');
}

// Ensure all ports are different
const ports = [config.server.port, config.app.port];
if (new Set(ports).size !== ports.length) {
  throw new Error('SERVER_PORT, APP_PORT, and WEBHOOK_PORT must all be different');
}
