import { DiscordService } from '../services/discord/discordService';

const LOGGER_CHANNEL_ID = '1273731421663395973';

export const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => async () => {
    // エラーメッセージをコンソールに出力
    const errorMessage = `[ERROR] ${message}`;
    console.error(errorMessage);

    // Discordのロガーにもエラーメッセージを送信
    try {
      // DiscordService のインスタンスを取得
      const discordService = DiscordService.getInstance();

      // DiscordService が初期化されていない場合はエラーメッセージを送信しない
      if (discordService) {
        await discordService.sendStringsToChannel(
          discordService.client,
          [errorMessage],
          LOGGER_CHANNEL_ID
        );
      }
    } catch (error) {
      console.error(`Error sending error message to Discord: ${error}`);
    }
  },
};
