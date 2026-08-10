import { randomBytes } from 'node:crypto';
import { config, configService } from './config';
import { env } from './env';
import { CronService } from './services/cron/CronService';
import { DiscordService } from './services/discord/discordService';
import { NotionService } from './services/notion/notionService';
import { SesameService } from './services/sesame/sesameService';
import { WebServerService } from './services/webapi/webServerService';
import { updateBotProfile } from './services/discord/functions/CountdownFunctions';
import { AdminConsoleService } from './services/admin/adminConsoleService';
import { AdminLoginLinkService } from './services/admin/adminLoginLinkService';
import { AdminLoginTokenService } from './services/admin/adminLoginTokenService';
import { LogMessage, Services } from './types/types';
import { logger } from './utils/logger';

export function formatDiscordLogMessage(logMessage: LogMessage): string {
  return `[${logMessage.level}] ${logMessage.message}`;
}

// メイン処理
export const main = async (initialize: () => Promise<void> = initializeServices) => {
  logger.info('glineze アプリケーションを起動します');

  // サービスの初期化
  await initialize();
};

// 主要なサービスを束ねる変数
let services: Services;

export const initializeServices = async () => {
  try {
    // config の初期化
    await config.initializeConfig();

    // NotionService
    const notionService = new NotionService();
    await notionService.practiceTemplateService.reload();

    // SesameService is always constructed so the admin setting can enable it at runtime.
    const sesameService = new SesameService();

    // DiscordService
    const discordService = new DiscordService({
      notion: notionService,
      sesame: sesameService,
    });

    // DiscordService（Client を起動する）
    await discordService.start();

    // Logger の Discord 出力を紐付け
    logger.on('discordLog', async (logMessage) => {
      try {
        const formattedMessage = formatDiscordLogMessage(logMessage);
        await discordService.sendStringsToChannel([formattedMessage], logger.getLoggerChannelId());
      } catch (err) {
        console.error('Failed to route log to DiscordService:', err);
      }
    });

    // サービスを束ねる
    services = {
      notion: notionService,
      discord: discordService,
      sesame: sesameService,
    };

    configService.setEffectHandlers({
      'bot-profile': () => updateBotProfile(discordService),
      'practice-template': () => notionService.practiceTemplateService.reload(),
      sesame: () => sesameService.reloadConfiguration(),
    });

    const developmentAdminEnabled = env.NODE_ENV === 'development' && !env.ADMIN_ENABLED;
    const adminEnabled = env.ADMIN_ENABLED || developmentAdminEnabled;
    let adminTokenService: AdminLoginTokenService | undefined;
    let adminLoginLinks: AdminLoginLinkService | undefined;
    let adminConsoleService: AdminConsoleService | undefined;
    let adminSessionSecret: string | undefined;
    if (adminEnabled) {
      adminSessionSecret = developmentAdminEnabled
        ? randomBytes(48).toString('base64url')
        : env.ADMIN_AUTH_SECRET!;
      adminTokenService = new AdminLoginTokenService(
        adminSessionSecret,
        env.ADMIN_TOKEN_TTL_HOURS * 60 * 60 * 1_000
      );
      if (!developmentAdminEnabled) {
        adminLoginLinks = new AdminLoginLinkService(
          notionService.client,
          adminTokenService,
          env.ADMIN_NOTION_LOGIN_BLOCK_ID!,
          env.ADMIN_BASE_URL!
        );
      }
      adminConsoleService = new AdminConsoleService(configService, services, adminLoginLinks);
    }

    // CronService
    const cronService = new CronService(services, adminLoginLinks);
    await cronService.start();

    // WebService
    new WebServerService(services, {
      ...(adminTokenService && adminConsoleService && adminSessionSecret
        ? {
            admin: {
              tokenService: adminTokenService,
              loginLinks: adminLoginLinks,
              consoleService: adminConsoleService,
              sessionSecret: adminSessionSecret!,
              sessionTtlMs: env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1_000,
              secureCookies: !developmentAdminEnabled,
              developmentAccess: developmentAdminEnabled,
            },
          }
        : {}),
    });

    logger.info(
      env.NODE_ENV === 'development' ? `開発環境が起動しました。` : `本番環境が起動しました。`,
      { debug: true }
    );
  } catch (error) {
    logger.error(`アプリの起動に失敗しました: ${error}`);
    process.exit(1);
  }
};

// エラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

if (require.main === module) {
  main().then(() => {
    logger.info('glineze アプリケーションが起動しました');
  });
}
