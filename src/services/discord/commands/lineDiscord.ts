import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';
import { NotionService } from '../../notion/notionService';
import { LINEDiscordPairInfo } from '../../../types/types';
import { LINENotifyService } from '../../lineNotifyService';

const lineNotify = new LINENotifyService();

async function handleLineDiscordCommand(message: Message, notion: NotionService) {
  const args = message.content.split(' ');
  if (args.length < 2) {
    await message.reply(
      '使用方法: !line-discord <add|status|remove> [line_notify_key] [line_group_id] [--thread] [--include-threads]'
    );
    return;
  }

  const subCommand = args[1];
  let channelId = message.channel.id;
  // スレッドの場合はスレッドIDを使用
  if (message.channel.isThread()) {
    channelId = message.channelId;
  }

  switch (subCommand) {
    case 'add':
      if (args.length < 4) {
        await message.reply(
          '使用方法: !line-discord add <line_notify_key> <line_group_id> [--not-include-threads]'
        );
        return;
      }

      if (message.channel.isDMBased()) return;

      const name = `{${message.guild?.name}} ${message.channel.name}`;

      const pairInfo = {
        name: name,
        lineNotifyKey: args[2],
        lineGroupId: args[3],
        discordChannelId: channelId,
        includeThreads: !args.includes('--not-include-threads'),
        priority: false,
      } as LINEDiscordPairInfo;

      console.log(pairInfo);

      await addLineDiscordPair(notion, message, pairInfo);

      // メッセージを削除
      message.delete();

      logger.info(`Added LINE-Discord pair: ${pairInfo.name}`);
      break;
    case 'status':
      await getLineDiscordPairStatus(notion, message, channelId);
      break;
    case 'remove':
      await removeLineDiscordPair(notion, message, channelId);
      break;
    default:
      await message.reply(
        '無効なサブコマンドです。add, status, または remove を使用してください。'
      );
  }
}

async function addLineDiscordPair(
  notion: NotionService,
  message: Message,
  pairInfo: LINEDiscordPairInfo
): Promise<void> {
  try {
    await notion.addLineDiscordPair(pairInfo);
    await message.reply(
      `:white_check_mark: LINE と Discordペアを正常に連携しました。\n安全のためトークンを含むメッセージは削除されました。`
    );
    lineNotify.postTextToLINENotify(
      pairInfo.lineNotifyKey,
      'LINE と Discordペアを正常に連携しました。'
    );
  } catch (error) {
    logger.error(`Error adding LINE-Discord pair: ${error}`);
    await message.reply('LINE-Discordペアの追加中にエラーが発生しました。');
  }
}

async function getLineDiscordPairStatus(
  notion: NotionService,
  message: Message,
  channelId: string
): Promise<void> {
  try {
    const pair = await notion.getLineDiscordPairByChannelId(channelId);
    if (pair) {
      let statusMessage = `現在のステータス:\nDiscord Channel ID: ${pair.discordChannelId}\n`;
      if (pair.discordChannelId) {
        statusMessage += `Discord Thread ID: ${pair.discordChannelId}\n`;
      }
      statusMessage += `LINE Group ID: ${pair.lineGroupId}\nLINE Notify Key: ${pair.lineNotifyKey}\n`;
      statusMessage += `Include Threads: ${pair.includeThreads ? 'Yes' : 'No'}`;
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
  notion: NotionService,
  message: Message,
  channelId: string
): Promise<void> {
  try {
    const pair = await notion.getLineDiscordPairByChannelId(channelId);
    if (!pair) {
      await message.reply(
        ':x: このチャンネル/スレッドには、LINE-Discordペアが設定されていません。'
      );
      return;
    }

    await notion.removeLineDiscordPair(channelId);
    await message.reply(':white_check_mark: LINE-Discordペアを正常に削除しました。');
  } catch (error) {
    logger.error(`Error removing LINE-Discord pair: ${error}`);
    await message.reply(':x: LINE-Discordペアの削除中にエラーが発生しました。');
  }
}

export { handleLineDiscordCommand };