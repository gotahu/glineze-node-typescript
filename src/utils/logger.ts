import { DiscordService } from '../services/discord/discordService';
import { LINENotifyService } from '../services/lineNotifyService';

const LOGGER_CHANNEL_ID = '1273731421663395973';

const lineNotifyService = LINENotifyService.getInstance();
import { config } from '../config/config';
import { sendDiscordWebhookMessage } from '../services/discord/discordWebhook';

export const logger = {
  info: (message: string, debug?: boolean) => {
    const msg = `[INFO] ${message}`;
    console.log(msg);
    if (debug) {
      lineNotifyService.postTextToLINENotify(config.lineNotify.voidToken, msg);
      sendDiscordWebhookMessage(config.discord.webHook, msg);
    }
  },
  debug: async (message: string) => {
    console.log(`[DEBUG] ${message}`);
    await logger.sendLogMessageToDiscord(`[DEBUG] ${message}`);
  },
  error: async (message: string) => {
    const errorMessage = `[ERROR] ${message}`;
    console.error(errorMessage);
    try {
      await lineNotifyService.postTextToLINENotify(config.lineNotify.voidToken, errorMessage);
      await sendDiscordWebhookMessage(config.discord.webHook, errorMessage);
    } catch (lineNotifyError) {
      console.error(`Failed to send error to LINE Notify: ${lineNotifyError}`);
    }
  },
  sendLogMessageToDiscord: async (message: string) => {
    // Discordのロガーにもエラーメッセージを送信
    try {
      // DiscordService のインスタンスを取得
      const discordService = DiscordService.getInstance();

      // DiscordService が初期化されていない場合はエラーメッセージを送信しない
      if (discordService) {
        await discordService.sendStringsToChannel([message], LOGGER_CHANNEL_ID);
      } else {
        throw new Error('DiscordService is not initialized');
      }
    } catch (error) {
      console.error(`Error sending error message to Discord: ${error}`);
    }
  },
};
