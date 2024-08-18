import { DiscordService } from '../services/discord/discordService';

const LOGGER_CHANNEL_ID = '1273731421663395973';

export const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  debug: async (message: string) => {
    console.log(`[DEBUG] ${message}`);
    await sendLogMessageToDiscord(`[DEBUG] ${message}`);
  },
  error: async (message: string) => {
    // エラーメッセージをコンソールに出力
    const errorMessage = `[ERROR] ${message}`;
    console.error(errorMessage);
  },
};

const sendLogMessageToDiscord = async (message: string) => {
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
};
