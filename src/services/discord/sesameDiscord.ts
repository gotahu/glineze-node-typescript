import { ChannelType, Client, VoiceChannel } from 'discord.js';
import { logger } from '../../utils/logger';

function retrieveSesameStatusVoiceChannel(discordClient: Client, guildId: string): VoiceChannel {
  const guild = discordClient.guilds.cache.get(guildId);

  if (!guild) {
    throw new Error('Guild not found');
  }

  try {
    // 名前が「倉庫｜」から始まるボイスチャンネルを取得
    const voiceChannel = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith('倉庫｜')
    ) as VoiceChannel;

    return voiceChannel;
  } catch (error) {
    logger.error(`Error retrieving voice channel: ${error}`);
    return null;
  }
}

async function createSesameStatusVoiceChannel(
  discordClient: Client,
  guildId: string
): Promise<VoiceChannel> {
  const guild = discordClient.guilds.cache.get(guildId);

  if (!guild) {
    throw new Error('Guild not found');
  }

  const voiceChannel = await guild.channels.create({
    name: '倉庫｜🔐施錠中',
    type: ChannelType.GuildVoice,
  });

  logger.info('倉庫施錠状態を表示するボイスチャンネルを作成しました');

  return voiceChannel;
}

async function updateSesameStatusVoiceChannel(
  discordClient: Client,
  guildId: string,
  isLocked: boolean
) {
  const voiceChannel = retrieveSesameStatusVoiceChannel(discordClient, guildId);

  if (!voiceChannel) {
    await createSesameStatusVoiceChannel(discordClient, guildId);
  }

  const channelName = isLocked ? '倉庫｜🔐施錠中' : '倉庫｜🔓解錠中';

  if (voiceChannel.name !== channelName) {
    await voiceChannel.setName(channelName);
    logger.info(`ボイスチャンネルの名前を ${channelName} に変更しました`);
    logger.sendLogMessageToDiscord(`ボイスチャンネルの名前を ${channelName} に変更しました`);
  }
}

function updateSesameStatusAllVoiceChannels(discordClient: Client, isLocked: boolean) {
  const guilds = discordClient.guilds.cache;

  for (const guild of guilds.values()) {
    updateSesameStatusVoiceChannel(discordClient, guild.id, isLocked);
  }
}

export {
  retrieveSesameStatusVoiceChannel,
  createSesameStatusVoiceChannel,
  updateSesameStatusVoiceChannel,
  updateSesameStatusAllVoiceChannels,
};
