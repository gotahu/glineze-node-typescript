import {
  ChannelType,
  Client,
  Guild,
  Message,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel,
} from 'discord.js';
import { logger } from '../../../utils/logger';
import { getWebhookInChannel } from './WebhookFunctions';

const parentChannelMap = new Map<string, TextChannel>();

function generateParentChannelName(message: Message) {
  const { guild, channel } = message;

  if (channel.isDMBased()) {
    return 'DM';
  } else {
    return guild.name.replaceAll(' ', '-').toLowerCase();
  }
}

function generateThreadName(message: Message) {
  const channel = message.channel;

  let channelName: string;

  if (channel.isThread()) {
    const parent = channel.parent;
    channelName = `${parent.name}>${channel.name}`;
  } else if (channel.isDMBased()) {
    channelName = message.author.displayName;
  } else {
    channelName = channel.name;
  }

  return channelName;
}

function retrieveParentChannel(channelName: string, guild: Guild) {
  if (parentChannelMap.has(channelName)) {
    return parentChannelMap.get(channelName);
  }

  try {
    let channel = guild.channels.cache.find((c) => c.name === channelName) as TextChannel;

    if (!channel) {
      guild.channels.fetch().then((channels) => {
        channel = channels.find((c) => c.name === channelName) as TextChannel;
      });
    }

    if (channel) {
      parentChannelMap.set(channelName, channel);
      return channel;
    }
  } catch (error) {
    console.error(error);
  }

  console.log(`チャンネル名 ${channelName} が見つかりませんでした`);
  return null;
}

async function getRelayGuild(client: Client): Promise<Guild> {
  const guild = await client.guilds.fetch(process.env.DISCORD_VOID_GUILD_ID);

  if (!guild) {
    logger.error('DISCORD_VOID_GUILD_ID からギルドを取得できませんでした');
    return null;
  }

  return guild;
}

async function getRelayGuildMember(client: Client) {
  const guild = await getRelayGuild(client);

  const members = await guild.members.fetch();

  return members;
}

async function getParentChannel(message: Message): Promise<TextChannel> {
  try {
    const guild = await getRelayGuild(message.client);

    // TextChannel を取得
    const parentChannelName = generateParentChannelName(message);
    console.log('Parent Channel Name:', parentChannelName);

    let parentChannel = retrieveParentChannel(parentChannelName, guild);

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
    console.error(`getParentChannel: ` + error);
  }
}

async function getThreadChannel(message: Message): Promise<ThreadChannel> {
  try {
    const parentChannel = await getParentChannel(message);

    // ThreadChannel を取得
    const threadName = generateThreadName(message);
    console.log('Thread Name:', threadName);

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
      const members = await getRelayGuildMember(message.client);
      members.forEach((member) => {
        thread.members.add(member.id); //
      });
    }

    return thread;
  } catch (error) {
    console.error('getThreadChannel: ' + error);
  }
}

export async function relayMessage(message: Message) {
  const { content, author } = message;

  try {
    const threadChannel = await getThreadChannel(message);

    const webhook = await getWebhookInChannel(threadChannel);

    if (threadChannel) {
      const options = {
        content: content,
        username: author.globalName ?? message.author.username,
        avatarURL: author.displayAvatarURL(),
        threadId: threadChannel.id,
        files: message.attachments.map((attachment) => attachment.url),
      };
      console.log(options);
      await webhook.send(options);

      console.log('Message relayed successfully');
    } else {
      console.log('Channel not found');
    }
  } catch (error) {
    console.error(
      `Failed to relay message: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
