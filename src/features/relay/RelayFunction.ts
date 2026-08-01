import {
  ChannelType,
  Client,
  Guild,
  Message,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel,
} from 'discord.js';
import { env } from '../../env';
import { logger } from '../../utils/logger';
import { getWebhookInChannel } from './WebhookFunctions';

const parentChannelMap = new Map<string, TextChannel>();

function generateParentChannelName(message: Message) {
  const { guild, channel } = message;

  if (channel.isDMBased() || !guild) {
    return 'dm';
  } else {
    return guild.name.replaceAll(' ', '-').toLowerCase();
  }
}

function generateThreadName(message: Message) {
  const channel = message.channel;

  let channelName: string;

  if (channel.isThread()) {
    const parent = channel.parent;
    channelName = parent ? `${parent.name}>${channel.name}` : `unknown>${channel.name}`;
  } else if (channel.isDMBased()) {
    channelName = message.author.displayName;
  } else {
    channelName = channel.name || 'unknown';
  }

  return channelName;
}

async function retrieveParentChannel(channelName: string, guild: Guild) {
  if (parentChannelMap.has(channelName)) {
    return parentChannelMap.get(channelName);
  }

  try {
    let channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === channelName
    ) as TextChannel | undefined;

    if (!channel) {
      const channels = await guild.channels.fetch();
      channel = channels.find(
        (c) => c?.type === ChannelType.GuildText && c.name === channelName
      ) as TextChannel | undefined;
    }

    if (channel) {
      parentChannelMap.set(channelName, channel);
      return channel;
    }
  } catch (error) {
    logger.error(`中継先チャンネルの取得に失敗しました: ${error}`);
  }

  logger.info(`チャンネル名 ${channelName} が見つかりませんでした`);
  return null;
}

async function getRelayGuild(client: Client): Promise<Guild | null> {
  const guildId = env.DISCORD_VOID_GUILD_ID?.trim();
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    logger.error('DISCORD_VOID_GUILD_ID が未設定または不正なため、メッセージを中継できません');
    return null;
  }

  const guild = await client.guilds.fetch({ guild: guildId }).catch(() => null);

  if (!guild) {
    logger.error('DISCORD_VOID_GUILD_ID からギルドを取得できませんでした');
    return null;
  }

  return guild;
}

async function getRelayGuildMemberIds(client: Client): Promise<string[]> {
  const guild = await getRelayGuild(client);
  if (!guild) return [];

  const members = await guild.members.fetch();

  return [...members.keys()];
}

async function getParentChannel(message: Message): Promise<TextChannel | null> {
  try {
    const guild = await getRelayGuild(message.client);
    if (!guild) return null;

    // TextChannel を取得
    const parentChannelName = generateParentChannelName(message);
    logger.debug(`Relay parent channel: ${parentChannelName}`);

    let parentChannel = await retrieveParentChannel(parentChannelName, guild);

    // TextChannel がない場合は作成
    if (!parentChannel) {
      parentChannel = await guild.channels.create({
        name: parentChannelName,
        type: ChannelType.GuildText,
      });

      parentChannelMap.set(parentChannelName, parentChannel);
    }

    return parentChannel;
  } catch (error) {
    logger.error(`getParentChannel: ${error}`);
  }
  return null;
}

async function getThreadChannel(message: Message): Promise<ThreadChannel | null> {
  try {
    const parentChannel = await getParentChannel(message);
    if (!parentChannel) return null;

    // ThreadChannel を取得
    const threadName = generateThreadName(message);
    logger.debug(`Relay thread: ${threadName}`);

    let thread = parentChannel.threads.cache.find((t) => t.name === threadName) as ThreadChannel;

    // ThreadChannel がない場合は作成
    if (!thread) {
      thread = await parentChannel.threads.create({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
        reason: 'Creating thread for message relay',
      });

      // スレッドにメンバーを追加
      // 親チャンネルにいるメンバーを追加する
      const memberIds = await getRelayGuildMemberIds(message.client);
      await Promise.all(memberIds.map((memberId) => thread.members.add(memberId)));
    }

    return thread;
  } catch (error) {
    logger.error(`getThreadChannel: ${error}`);
  }
  return null;
}

export async function relayMessage(message: Message) {
  const { content, author } = message;

  try {
    const threadChannel = await getThreadChannel(message);
    if (!threadChannel) return;

    const webhook = await getWebhookInChannel(threadChannel);

    if (threadChannel) {
      const options = {
        content: content,
        username: author.globalName ?? message.author.username,
        avatarURL: author.displayAvatarURL(),
        threadId: threadChannel.id,
        files: message.attachments.map((attachment) => attachment.url),
      };
      await webhook.send(options);

      logger.info(`Message relayed successfully to thread ${threadChannel.id}`);
    } else {
      logger.info('Relay channel not found');
    }
  } catch (error) {
    logger.error(
      `Failed to relay message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
