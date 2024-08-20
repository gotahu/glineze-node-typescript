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
    port: 3000,
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET,
  },
  repository: {
    path: process.env.REPOSITORY_PATH || '../../',
    branch: process.env.BRANCH || 'refs/heads/main',
  },
  webpack: {},
};

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

import('../../webpack/webpack.prod').then((webpackConfig) => {
  config.webpack = webpackConfig.default || webpackConfig;
});
