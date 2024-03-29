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
import { LINENotifyPayload, postToLINENotify } from '../line/lineNotify';
import { retrieveLatestPracticeStrings } from '../notion/notion-practice';
import { getConfigurationValue } from '../notion/notion-client';
import { retrieveLINEAndDiscordPairs } from '../notion/notion-interaction';

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

  // 文章を取得
  let messageText = message.cleanContent;

  // メンバーやチャンネルが取得できない場合
  if (!message.member || !message.channel) {
    console.log('error: message member or channel cannot be detected');
    return;
  }
  // メッセージタイトルの初期定義
  var messageTitle = `#${message.channel.name}\n${message.member.displayName}:`;

  // スレッドのメッセージだった場合
  if (message.channel.isThread() && message.channel.parent) {
    // 親チャンネルの名前を取得
    const parentChannel = message.channel.parent.name;
    // タイトルを「親チャンネル > スレッド名」の形にする
    messageTitle = `#${parentChannel} > ${message.channel.name}\n${message.member.displayName}：`;
  }

  const lineNotifyPayload = {
    username: message.member.displayName,
    channelid:
      message.channel.isThread() && message.channel.parent
        ? message.channel.parent.id
        : message.channelId,
    groupname: message.channel.name,
    message: messageTitle + '\n' + messageText,
    avatarURL: message.author.displayAvatarURL({ extension: 'png' }),
    hasImage: false,
  } as LINENotifyPayload;

  // 添付ファイルを取得
  const file = message.attachments.first();

  // 画像ファイルがあるとき
  if (file && file.height && file.width) {
    lineNotifyPayload.hasImage = true;
    lineNotifyPayload.imageURL = file.url;
    lineNotifyPayload.previewURL = file.proxyURL;
    lineNotifyPayload.message = `${messageTitle} 写真\n${message.cleanContent}`;
  }

  console.log(lineNotifyPayload);

  postToLINENotify(lineNotifyPayload);
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
    // 次の日の練習お知らせ用
    const latestPractices = await retrieveLatestPracticeStrings();
    if (latestPractices.length === 0) {
      return;
    }

    // 送信先のチャンネルid
    const channelid = await getConfigurationValue('practice_remind_channelid');
    const threadid = await getConfigurationValue('practice_remind_threadid');

    if (channelid && threadid) {
      // チャンネルを取得
      const channel = await client.channels.fetch(channelid);

      // チャンネルが存在し、テキストチャンネルだった場合
      if (channel && channel instanceof TextChannel) {
        // スレッドを取得
        const thread = await channel.threads.fetch(threadid);
        if (thread) {
          // 練習ごとに送信
          for (const practice of latestPractices) {
            thread.send(practice).then(console.log).catch(console.error);
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}
