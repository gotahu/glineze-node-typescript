import { ChannelType, Collection, Guild, VoiceBasedChannel } from 'discord.js';
import { RandomBreakoutResult } from '../commands/CommandContext';
import { logger } from '../../utils/logger';

async function createBreakoutRooms(guild: Guild, number: number) {
  // サーバーにブレイクアウトルームを引数で指定された数だけ作成する
  for (let i = 0; i < number; i++) {
    const roomName = `BR-${i + 1}`;
    try {
      await guild.channels.create({
        name: roomName,
        type: ChannelType.GuildVoice,
      });
      logger.info(`ブレイクアウトルーム ${roomName} を作成しました`);
    } catch (error) {
      logger.error(`ブレイクアウトルーム ${roomName} の作成に失敗しました: ${error}`);
    }
  }
}

async function removeBreakoutRooms(guild: Guild) {
  // サーバーからブレイクアウトルームを全て削除する
  for (const channel of guild.channels.cache.values()) {
    if (channel.name.startsWith('BR-')) {
      await channel.delete();
      logger.info(`ブレイクアウトルーム ${channel.name} を削除しました`);
    }
  }
}

/**
 * コマンド実行ユーザーが所属するボイスチャンネルをランダムにブレイクアウトルームに分割する
 * @param channel
 */
async function randomBreakoutRooms(guild: Guild, memberId: string): Promise<RandomBreakoutResult> {
  // ブレイクアウトルームを取得
  const breakoutRooms = guild.channels.cache.filter(
    (channel) => channel.name.startsWith('BR-') && channel.isVoiceBased()
  ) as Collection<string, VoiceBasedChannel>;

  if (breakoutRooms.size === 0) {
    logger.error('Breakout rooms are not found');
    return 'no_breakout_rooms';
  }

  // ユーザーが所属するボイスチャンネルを取得
  const voiceChannel = getUserVoiceChannel(guild, memberId);

  if (!voiceChannel) {
    logger.error('User is not in a voice channel');
    return 'not_in_voice';
  }

  // ユーザーが所属するボイスチャンネルに所属するメンバーを取得
  const members = voiceChannel.members;

  // ブレイクアウトルームにメンバーをランダムに分割
  // メンバーをシャッフル
  const shuffledMembers = members.random(members.size);
  logger.debug(`${shuffledMembers.length} members will be distributed to breakout rooms`);

  // ブレイクアウトルームを配列に変換して操作しやすくする
  const breakoutRoomArray = Array.from(breakoutRooms.values());

  // メンバーをブレイクアウトルームにランダムに割り振る
  await Promise.all(
    shuffledMembers.map(async (member, index) => {
      const roomIndex = index % breakoutRoomArray.length;
      const breakoutRoom = breakoutRoomArray[roomIndex];

      try {
        await member.voice.setChannel(breakoutRoom);
      } catch (error) {
        logger.error(`Failed to move member: ${member.displayName} + ${error}`);
      }
    })
  );

  logger.info('Members have been randomly distributed to breakout rooms');
  return 'success';
}

function getUserVoiceChannel(guild: Guild, memberId: string): VoiceBasedChannel | null {
  const voiceState = guild.voiceStates.cache.get(memberId);

  if (voiceState?.channel) {
    return voiceState.channel;
  } else {
    return null;
  }
}

export { createBreakoutRooms, removeBreakoutRooms, randomBreakoutRooms };
