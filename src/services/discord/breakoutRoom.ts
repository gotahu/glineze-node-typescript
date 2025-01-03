// ba create 10
// ba remove
// ba random

import {
  ChannelType,
  Collection,
  Guild,
  GuildMember,
  Message,
  VoiceBasedChannel,
} from 'discord.js';
import { logger } from '../../utils/logger';

async function handleBreakoutRoomCommand(message: Message, args: string[]) {
  if (args.length < 1) {
    message.reply({ content: '引数が不足しています' });
    return;
  }
  const subCommand = args[0];
  if (subCommand === 'create') {
    if (args.length < 2) {
      message.reply({ content: '引数が不足しています' });
      return;
    }
    const number = parseInt(args[1]);
    if (isNaN(number)) {
      message.reply({ content: '引数が不正です' });
      return;
    }
    await createBreakoutRooms(message.guild, number);
    return;
  } else if (subCommand === 'remove') {
    await removeBreakoutRooms(message.guild);
    return;
  } else if (subCommand === 'random') {
    await randomBreakoutRooms(message);
    return;
  }
}

async function createBreakoutRooms(guild: Guild, number: number) {
  // サーバーにブレイクアウトルームを引数で指定された数だけ作成する
  for (let i = 0; i < number; i++) {
    const roomName = `BR-${i + 1}`;
    await guild.channels
      .create({
        name: roomName,
        type: ChannelType.GuildVoice,
      })
      .then(() => {
        logger.info(`ブレイクアウトルーム ${roomName} を作成しました`);
      })
      .catch((error) => {
        logger.error(`ブレイクアウトルーム ${roomName} の作成に失敗しました: ${error}`);
      });
  }
}

async function removeBreakoutRooms(guild: Guild) {
  // サーバーからブレイクアウトルームを全て削除する
  guild.channels.cache.forEach(async (channel) => {
    if (channel.name.startsWith('BR-')) {
      await channel.delete().then(() => {
        logger.info(`ブレイクアウトルーム ${channel.name} を削除しました`);
      });
    }
  });
}

/**
 * コマンド実行ユーザーが所属するボイスチャンネルをランダムにブレイクアウトルームに分割する
 * @param channel
 */
async function randomBreakoutRooms(message: Message) {
  const guild = message.guild;
  const member = message.member as GuildMember;

  if (!guild || !member) {
    message.reply('サーバーまたはユーザーが見つかりません。管理者に連絡してください。');
    logger.error('Guild or member is not found');
    return;
  }

  // ブレイクアウトルームを取得
  const breakoutRooms = guild.channels.cache.filter(
    (channel) => channel.name.startsWith('BR-') && channel.isVoiceBased()
  ) as Collection<string, VoiceBasedChannel>;

  if (breakoutRooms.size === 0) {
    message.reply('ブレイクアウトルームが未作成です');
    logger.error('Breakout rooms are not found');
    return;
  }

  // ユーザーが所属するボイスチャンネルを取得
  const voiceChannel = await getUserVoiceChannel(guild, member);

  if (!voiceChannel) {
    message.reply('ボイスチャンネルに参加してから実行してください');
    logger.error('User is not in a voice channel');
    return;
  }

  // ユーザーが所属するボイスチャンネルに所属するメンバーを取得
  const members = voiceChannel.members;

  // ブレイクアウトルームにメンバーをランダムに分割
  // メンバーをシャッフル
  const shuffledMembers = members.random(members.size);
  console.log(shuffledMembers);

  // ブレイクアウトルームを配列に変換して操作しやすくする
  const breakoutRoomArray = Array.from(breakoutRooms.values());

  // メンバーをブレイクアウトルームにランダムに割り振る
  shuffledMembers.forEach((member, index) => {
    const roomIndex = index % breakoutRoomArray.length; // ブレイクアウトルームの数で割って割り振る
    const breakoutRoom = breakoutRoomArray[roomIndex];

    // メンバーを対応するブレイクアウトルームに移動
    member.voice.setChannel(breakoutRoom).catch((err) => {
      logger.error(`Failed to move member: ${member.displayName} + ${err}`);
    });
  });

  message.reply('メンバーをランダムにブレイクアウトルームに分配しました');
  logger.info('Members have been randomly distributed to breakout rooms');
}

async function getUserVoiceChannel(
  guild: Guild,
  member: GuildMember
): Promise<VoiceBasedChannel | null> {
  const voiceState = guild.voiceStates.cache.get(member.id);

  if (voiceState?.channel) {
    return voiceState.channel;
  } else {
    return null;
  }
}

export { createBreakoutRooms, removeBreakoutRooms, randomBreakoutRooms, handleBreakoutRoomCommand };
