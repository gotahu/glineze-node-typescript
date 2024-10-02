import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';

async function handleLineDiscordCommand(message: Message) {
  const args = message.content.split(' ');
  if (args.length < 2) {
    await message.reply(
      '使用方法: !line-discord <add|status|remove> [line_notify_key] [line_group_id] [--thread] [--include-threads]'
    );
    return;
  }

  const subCommand = args[1];
  const channelId = message.channel.id;
  const threadId = message.channel.isThread() ? message.channel.id : undefined;

  switch (subCommand) {
    case 'add':
      if (args.length < 4) {
        await message.reply(
          '使用方法: !line-discord add <line_notify_key> <line_group_id> [--thread] [--include-threads]'
        );
        return;
      }
      await addLineDiscordPair(
        message,
        channelId,
        args[2],
        args[3],
        threadId,
        args.includes('--include-threads')
      );
      break;
    case 'status':
      await getLineDiscordPairStatus(message, channelId, threadId);
      break;
    case 'remove':
      await removeLineDiscordPair(message, channelId, threadId);
      break;
    default:
      await message.reply(
        '無効なサブコマンドです。add, status, または remove を使用してください。'
      );
  }
}

async function addLineDiscordPair(
  message: Message,
  channelId: string,
  lineNotifyKey: string,
  lineGroupId: string,
  threadId?: string,
  includeThreads: boolean = false
): Promise<void> {
  try {
    await this.notion.addLineDiscordPair(
      channelId,
      lineNotifyKey,
      lineGroupId,
      threadId,
      includeThreads
    );
    await message.reply(
      `LINE-Discordペアを正常に追加しました。${threadId ? 'スレッド' : 'チャンネル'}として設定されました。${includeThreads ? 'すべてのスレッドが含まれます。' : ''}`
    );
  } catch (error) {
    logger.error(`Error adding LINE-Discord pair: ${error}`);
    await message.reply('LINE-Discordペアの追加中にエラーが発生しました。');
  }
}

async function getLineDiscordPairStatus(
  message: Message,
  channelId: string,
  threadId?: string
): Promise<void> {
  try {
    const pair = await this.notion.getLineDiscordPairByChannelId(channelId, threadId);
    if (pair) {
      let statusMessage = `現在のステータス:\nDiscord Channel ID: ${pair.discord_channel_id}\n`;
      if (pair.discord_thread_id) {
        statusMessage += `Discord Thread ID: ${pair.discord_thread_id}\n`;
      }
      statusMessage += `LINE Group ID: ${pair.line_group_id}\nLINE Notify Key: ${pair.line_notify_key}\n`;
      statusMessage += `Include Threads: ${pair.include_threads ? 'Yes' : 'No'}`;
      await message.reply(statusMessage);
    } else {
      await message.reply('このチャンネル/スレッドには、LINE-Discordペアが設定されていません。');
    }
  } catch (error) {
    logger.error(`Error getting LINE-Discord pair status: ${error}`);
    await message.reply('ステータスの取得中にエラーが発生しました。');
  }
}

async function removeLineDiscordPair(
  message: Message,
  channelId: string,
  threadId?: string
): Promise<void> {
  try {
    await this.notion.removeLineDiscordPair(channelId, threadId);
    await message.reply('LINE-Discordペアを正常に削除しました。');
  } catch (error) {
    logger.error(`Error removing LINE-Discord pair: ${error}`);
    await message.reply('LINE-Discordペアの削除中にエラーが発生しました。');
  }
}

export { handleLineDiscordCommand };
