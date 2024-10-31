import axios from 'axios';
import { logger } from '../../utils/logger';

export async function sendDiscordWebhookMessage(message: string, webhook: string): Promise<void> {
  const payload = {
    content: message,
  };

  await axios.post(webhook, payload).catch((err) => {
    logger.error('Error in sendMessageToDiscordChannel: ' + err);
  });
}
