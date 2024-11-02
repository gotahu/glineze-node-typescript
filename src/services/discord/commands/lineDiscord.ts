import { Message } from 'discord.js';
import { logger } from '../../../utils/logger';
import { LINEDiscordPairInfo } from '../../../types/types';
import { LINEDiscordPairService } from '../../notion/lineDiscordPairService';

async function handleLineDiscordCommand(message: Message, service: LINEDiscordPairService) {
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

      await addLineDiscordPair(service, message, pairInfo);

      // メッセージを削除
      message.delete();

      logger.info(`Added LINE-Discord pair: ${pairInfo.name}`);
      break;
    case 'status':
      await getLineDiscordPairStatus(service, message, channelId);
      break;
    case 'remove':
      await removeLineDiscordPair(service, message, channelId);
      break;
    default:
      await message.reply(
        '無効なサブコマンドです。add, status, または remove を使用してください。'
      );
  }
}

async function addLineDiscordPair(
  pairService: LINEDiscordPairService,
  message: Message,
  pairInfo: LINEDiscordPairInfo
): Promise<void> {
  try {
    await pairService.addLineDiscordPair(pairInfo);
    await message.reply(
      `:white_check_mark: LINE と Discordペアを正常に連携しました。\n安全のためトークンを含むメッセージは削除されました。\nメッセージを送信して正しく紐付けができているか確認してください。`
    );
  } catch (error) {
    logger.error(`Error adding LINE-Discord pair: ${error}`);
    await message.reply('LINE-Discordペアの追加中にエラーが発生しました。');
  }
}

async function getLineDiscordPairStatus(
  service: LINEDiscordPairService,
  message: Message,
  channelId: string
): Promise<void> {
  try {
    const pair = await service.getLINEDiscordPairByChannelId(channelId);
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
  service: LINEDiscordPairService,
  message: Message,
  channelId: string
): Promise<void> {
  try {
    const pair = await service.getLINEDiscordPairByChannelId(channelId);
    if (!pair) {
      await message.reply(
        ':x: このチャンネル/スレッドには、LINE-Discordペアが設定されていません。'
      );
      return;
    }

    await service.removeLineDiscordPair(channelId);
    await message.reply(':white_check_mark: LINE-Discordペアを正常に削除しました。');
  } catch (error) {
    logger.error(`Error removing LINE-Discord pair: ${error}`);
    await message.reply(':x: LINE-Discordペアの削除中にエラーが発生しました。');
  }
}

export { handleLineDiscordCommand };
