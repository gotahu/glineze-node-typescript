import axios from 'axios';
import { logger } from '../../utils/logger';

export async function sendDiscordWebhookMessage(
  webhookUrl: string,
  message: string
): Promise<void> {
  const payload = {
    content: message,
  };

  await axios.post(webhookUrl, payload).catch((err) => {
    // logger.error をすると無限ループになる可能性があるので console.error でエラーを出力
    console.error('Error in sendMessageToDiscordChannel: ' + err);
  });
}
