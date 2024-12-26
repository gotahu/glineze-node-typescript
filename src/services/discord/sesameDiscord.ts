import { ChannelType, VoiceChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { Services, SesameLockStatus, StatusMessage } from '../../types/types';

export class SesameDiscordService {
  constructor(private readonly services: Services) {}

  /**
   * ギルドIDを指定して、倉庫の施錠状態を表示するボイスチャンネルを取得します。
   * @param guildId
   * @returns {VoiceChannel}
   */
  public retrieveSesameStatusVoiceChannel(guildId: string): VoiceChannel {
    try {
      const { discord } = this.services;
      const guild = discord.client.guilds.cache.get(guildId);

      if (!guild) {
        throw new Error('指定されたサーバーが見つかりません');
      }

      // 名前が「倉庫｜」から始まるボイスチャンネルを取得
      const voiceChannel = guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith('倉庫｜')
      ) as VoiceChannel;

      return voiceChannel;
    } catch (error) {
      logger.error(`ボイスチャンネルの検索中にエラーが発生しました ${error}`);
      return null;
    }
  }

  /**
   * ボイスチャンネルの権限を全員の閲覧を許可し、接続を許可しないように更新します
   * @param voiceChannel
   */
  public updateChannelPermission(voiceChannel: VoiceChannel) {
    // ボイスチャンネルの権限を編集する処理
    // 全員の閲覧を許可し、接続を許可しない
    voiceChannel.permissionOverwrites.edit(voiceChannel.guild.id, {
      ViewChannel: true,
      Connect: false,
    });
  }

  /**
   * Sesameの施錠状態を表示するボイスチャンネルを更新します
   * @param guildId
   */
  public async updateSesameStatusVoiceChannel(guildId: string, lockStatus: SesameLockStatus) {
    try {
      const voiceChannel = this.retrieveSesameStatusVoiceChannel(guildId);

      if (!voiceChannel) {
        await this.createSesameStatusVoiceChannel(guildId);
      }

      // ボイスチャンネルの権限を編集
      this.updateChannelPermission(voiceChannel);

      // ボイスチャンネルの名前を取得
      const channelName = StatusMessage[lockStatus];

      // ボイスチャンネルの名前を更新
      if (voiceChannel.name !== channelName) {
        await voiceChannel.setName(channelName);
        logger.info(`ボイスチャンネルの名前を ${channelName} に変更しました`);
      }
    } catch (error) {
      logger.error(`Sesame の状態を Discord に反映する際にエラーが発生しました: ${error}`);
    }
  }

  /**
   * Sesameの施錠状態を表示するボイスチャンネルをBOTが参加しているサーバーに対して全て更新します
   */
  public async updateSesameStatusAllVoiceChannels() {
    const { discord, sesame } = this.services;
    const guilds = discord.client.guilds.cache;
    const status = await sesame?.getSesameDeviceStatus();

    for (const guild of guilds.values()) {
      await this.updateSesameStatusVoiceChannel(guild.id, status.lockStatus);
    }
  }

  /**
   * 指定したギルドに、倉庫の施錠状態を表示するボイスチャンネルを作成します
   * @param guildId
   * @returns {Promise<VoiceChannel>}
   */
  public async createSesameStatusVoiceChannel(guildId: string): Promise<VoiceChannel> {
    const { discord } = this.services;
    const guild = discord.client.guilds.cache.get(guildId);

    if (!guild) {
      throw new Error(`指定された Guild が見つかりませんでした: (guildid: ${guildId})`);
    }

    const voiceChannel = await guild.channels.create({
      name: '倉庫｜🔐施錠中',
      type: ChannelType.GuildVoice,
    });

    logger.info('倉庫施錠状態を表示するボイスチャンネルを作成しました');

    return voiceChannel;
  }
}
