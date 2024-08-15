import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Message,
  MessageType,
  TextChannel,
} from 'discord.js';
import { prepareDiscordMessageToLINENotify } from '../line/lineNotify';
import {
  retrievePracticeStringsForRelativeDay,
  retrievePracticeForRelativeDay,
} from '../notion/notion-practice';
import { getConfigurationValue } from '../services/notionService';
import { retrieveLINEAndDiscordPairs } from '../notion/notion-interaction';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import axios from 'axios';
import { retrieveShukinStatus } from '../notion/notion-list';
import { postToLINENotifyWithText } from '../services/lineNotifyService';
import { config } from '../config/config';

export async function handleMessageCreate(message: Message) {
  console.debug(message);

  if (message.author.bot) {
    logger.info('ignore BOT');
    return;
  }

  if (message.channel.type === ChannelType.DM) {
    logger.info('message from direct message channel');

    const messageContent = message.content;

    const authorId = message.author.id;
    const authorName = message.author.displayName;
    const lineNotifyToken = config.lineNotify.voidToken;

    await message.channel.sendTyping();

    await postToLINENotifyWithText(
      { message: `${authorName}\n${messageContent}` },
      lineNotifyToken
    );

    await retrieveShukinStatus(authorId).then(async (reply) => {
      if (reply.status === 'error') {
        message.reply('### エラーが発生しました。\n- エラー内容：' + reply.message);
      } else {
        message.reply(reply.message);
      }

      await postToLINENotifyWithText(
        { message: `BOT >> ${authorName}\n${reply.message}` },
        lineNotifyToken
      );
    });

    return;
  }

  if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
    logger.info(`system message, type: ${message.type}`);
    return;
  }

  if (message.content.includes('GLOBALIP')) {
    try {
      const response = await axios.get('https://api.ipify.org?format=json');
      const ip = response.data.ip;
      message.reply(ip);
    } catch (error) {
      logger.error('Error fetching IP: ' + error);
    }
    return;
  }

  if (
    message.channel.isThread() &&
    message.channel.parent &&
    message.channel.parent.name.includes('スレッド') &&
    message.mentions.roles.some((role) => role.name.includes('全員'))
  ) {
    handleThreadChannelMessage(message);
    return;
  }

  const channelId =
    message.channel.isThread() && message.channel.parent
      ? message.channel.parent.id
      : message.channelId;

  const pairs = await retrieveLINEAndDiscordPairs();
  const pair = pairs.find((v) => v.discord_channel_id == channelId);

  if (pair) {
    message.react('✅');
    logger.info('reaction added');

    const reactionTimeSeconds = await getConfigurationValue('reaction_time_seconds');
    const timeoutSeconds = reactionTimeSeconds
      ? parseInt(reactionTimeSeconds)
      : CONSTANTS.DEFAULT_REACTION_TIME_SECONDS;

    setTimeout(() => {
      message.reactions.cache.get('✅')?.remove();
      logger.info('reaction removed after timeout');
    }, timeoutSeconds * 1000);
  }

  if (!message.member || !message.channel) {
    logger.error('error: message member or channel cannot be detected');
    return;
  }

  prepareDiscordMessageToLINENotify(message, true);
}

export async function handleThreadChannelMessage(message: Message) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('delete').setLabel('消去する').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ignore').setLabel('無視する').setStyle(ButtonStyle.Secondary)
  );

  message.reply({
    content:
      'スレッドチャンネルで全員にメンションを行いました。\nBOTはこのイベントを取り消すことはできません。\n\nもしこれが意図した動作ではない場合、スレッドの作成者・ボタンを押すあなた・BOTの3者を残し、他の人を一旦スレッドから削除します。\nその後、再度意図する人をメンションし直してください。',
    components: [row],
  });
}

export async function sendLINEMessageToDiscord(
  client: Client,
  lineGroupId: string,
  messageSender: string,
  messageContent: string
) {
  const pairs = await retrieveLINEAndDiscordPairs();

  const discordChannelId =
    lineGroupId === 'undefined'
      ? '1037911984399724634'
      : pairs.find((v) => v.line_group_id == lineGroupId)?.discord_channel_id;

  if (!discordChannelId) {
    logger.error('error: discord channel not found');
    return;
  }

  const channel = await client.channels.fetch(discordChannelId);

  if (channel && channel instanceof TextChannel) {
    channel.send(`${messageSender}：\n${messageContent}`);
  }
}

export async function notifyLatestPractices(client: Client) {
  try {
    const latestPractices = await retrievePracticeStringsForRelativeDay(1);
    if (latestPractices.length === 0) {
      return;
    }

    await sendPracticesToThread(
      client,
      latestPractices,
      'practice_remind_channelid',
      'practice_remind_threadid'
    );
  } catch (err) {
    logger.error('Error in notifyLatestPractices: ' + err);
  }
}

export async function remindAKanPractice(client: Client) {
  try {
    const latestPractices = await retrievePracticeForRelativeDay(14);
    if (!latestPractices.results || latestPractices.results.length === 0) {
      return;
    }

    latestPractices.results.forEach((practice) => logger.info(JSON.stringify(practice)));

    await sendPracticesToThread(
      client,
      ['AKanの練習が2週間後にあります。'],
      'AKan_remind_channelid',
      'AKan_remind_threadid'
    );
  } catch (err) {
    logger.error('Error in remindAKanPractice: ' + err);
  }
}

async function sendPracticesToThread(
  client: Client,
  practices: string[],
  channelIdKey: string,
  threadIdKey: string
) {
  const channelid = await getConfigurationValue(channelIdKey);
  const threadid = await getConfigurationValue(threadIdKey);

  if (channelid && threadid) {
    const channel = await client.channels.fetch(channelid);

    if (channel && channel instanceof TextChannel) {
      const thread = await channel.threads.fetch(threadid);
      if (thread) {
        for (const practice of practices) {
          thread
            .send(practice)
            .then(() => logger.info('Practice sent'))
            .catch(logger.error);
        }
      }
    }
  }
}
