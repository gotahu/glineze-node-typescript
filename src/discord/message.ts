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
import { retrievePracticeStringsForRelativeDay } from '../notion/notion-practice';
import { getConfigurationValue } from '../notion/notion-client';
import { retrieveLINEAndDiscordPairs } from '../notion/notion-interaction';

import axios from 'axios';

export async function handleMessageCreate(message: Message) {
  // ログを出力
  console.log(message);

  // DM には反応しない
  if (message.channel.type === ChannelType.DM) {
    console.log('ignore DM');
    return;
  }

  // BOT には反応しない
  if (message.author.bot) {
    console.log('ignore BOT');
    return;
  }

  // クライアントやBOTから送信されたメッセージではなく、システムメッセージの場合
  if (message.type !== MessageType.Default && message.type !== MessageType.Reply) {
    console.log(`system message, type: ${message.type}`);
    return;
  }

  if (message.content.includes('GLOBALIP')) {
    axios
      .get('https://api.ipify.org?format=json')
      .then((response) => {
        const ip = response.data.ip;

        message.reply(ip);
        return;
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  // 「スレッド」チャンネルで誤爆があった場合
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

  // LINEとDiscordのペアを取得
  const pairs = await retrieveLINEAndDiscordPairs();
  // 対象のDiscordチャンネルに対応するペアを検索
  const pair = pairs.find((v) => v.discord_channel_id == channelId);

  // ペアが見つかった場合
  if (pair) {
    message.react('✅');
    console.log('reaction added');

    const reactionTimeSeconds = await getConfigurationValue('reaction_time_seconds');
    const timeoutSeconds = reactionTimeSeconds ? parseInt(reactionTimeSeconds) : 300;

    setTimeout(() => {
      message.reactions.cache.get('✅')?.remove();
      console.log('reaction removed after timeout');
    }, timeoutSeconds * 1000);
  }

  // メンバーやチャンネルが取得できない場合
  if (!message.member || !message.channel) {
    console.log('error: message member or channel cannot be detected');
    return;
  }

  prepareDiscordMessageToLINENotify(message, true);
}

export async function handleThreadChannelMessage(message: Message) {
  // その他の処理
  // ボタンを作成
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('delete').setLabel('消去する').setStyle(ButtonStyle.Danger),

    new ButtonBuilder().setCustomId('ignore').setLabel('無視する').setStyle(ButtonStyle.Secondary)
  );

  // ボタンを含むメッセージを送信
  message.reply({
    content:
      'スレッドチャンネルで全員にメンションを行いました。\nBOTはこのイベントを取り消すことはできません。\n\nもしこれが意図した動作ではない場合、スレッドの作成者・ボタンを押すあなた・BOTの3者を残し、他の人を一旦スレッドから削除します。\nその後、再度意図する人をメンションし直してください。',
    components: [row],
    // TODO:ephemeral の設定がうまくいかない
  });
}

export async function sendLINEMessageToDiscord(
  client: Client,
  lineGroupId: string,
  messageSender: string,
  messageContent: string
) {
  const pairs = await retrieveLINEAndDiscordPairs();

  // 適切なDiscordチャンネルを検索
  const discordChannelId =
    lineGroupId === 'undefined'
      ? '1037911984399724634'
      : pairs.find((v) => v.line_group_id == lineGroupId)?.discord_channel_id;

  // Discordチャンネルが見つからない場合
  if (!discordChannelId) {
    console.log('error: discord channel not found');
    return;
  }

  // メッセージを送信
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
    console.error(err);
  }
}

export async function remindAKanPractice(client: Client) {
  try {
    const latestPractices = await retrievePracticeStringsForRelativeDay(14);
    if (latestPractices.length === 0) {
      return;
    }

    const isAKanPractice = latestPractices.some((practice) => practice.includes('A館'));
    if (!isAKanPractice) {
      console.log('A館の練習はありません');
      return;
    }

    await sendPracticesToThread(
      client,
      latestPractices,
      'AKan_remind_channelid',
      'AKan_remind_threadid'
    );
  } catch (err) {
    console.error(err);
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
          thread.send(practice).then(console.log).catch(console.error);
        }
      }
    }
  }
}
