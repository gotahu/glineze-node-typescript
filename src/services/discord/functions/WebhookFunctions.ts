import { TextChannel, ThreadChannel, Webhook, WebhookClient } from 'discord.js';

const cacheWebhooks = new Map<string, Webhook>();

export async function getWebhookInChannel(channel: ThreadChannel) {
  // Webhook のキャッシュを取得
  const webhook = cacheWebhooks.get(channel.id) ?? (await getWebhook(channel));

  return webhook;
}

async function getWebhook(channel: ThreadChannel) {
  // スレッドの親チャンネルを取得
  const parentChannel = channel.parent as TextChannel;

  // チャンネル内の Webhook を全て取得
  const webhooks = await parentChannel.fetchWebhooks();

  // token がある（＝BOT が作成した）Webhook を取得
  const webhook =
    webhooks.find((w) => w.token) ?? (await parentChannel.createWebhook({ name: 'glineze' }));

  // キャッシュに入れて次回以降使い回す
  if (webhook) cacheWebhooks.set(channel.id, webhook);

  return webhook;
}

export async function sendMessageToDiscordWebhook(webhookUrl: string, message: string) {
  const webhookClient = new WebhookClient({
    url: webhookUrl,
  });

  try {
    webhookClient.send({
      content: message,
    });
  } catch (error) {
    console.error(error);
  }
}
