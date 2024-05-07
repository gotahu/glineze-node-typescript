type LINENotifyPayload = {
  username: string;
  channelid: string;
  groupname: string;
  message: string;
  avatarURL: string;
  imageURL?: string;
  previewURL?: string;
  hasImage: boolean;
};

import axios from 'axios';
import { retrieveLINEAndDiscordPairs } from '../notion/notion-interaction';
import { ChannelType, Message } from 'discord.js';

const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

async function postToLINENotify(payload: LINENotifyPayload, isVoid: boolean = false) {
  console.log('postToLINENotify', payload);
  let lineNotifyToken = process.env.LINE_NOTIFY_VOID_TOKEN;

  if (!isVoid) {
    // LINEとDiscordのペアを取得
    const pairs = await retrieveLINEAndDiscordPairs();
    // 対象のDiscordチャンネルに対応するペアを検索
    const pair = pairs.find((v) => v.discord_channel_id == payload.channelid);

    // トークンが見つからない場合はデフォルトのトークンを使用
    lineNotifyToken = pair ? pair.line_notify_key : process.env.LINE_NOTIFY_VOID_TOKEN;
    console.log('line notify to ' + lineNotifyToken);
  }

  // axios インスタンスの設定
  const request = axios.create({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Bearer ' + lineNotifyToken,
    },
    responseType: 'json',
  });

  // 送信するデータの設定
  const postData = {
    message: payload.message,
    imageFullsize: payload.imageURL,
    imageThumbnail: payload.previewURL,
  };

  // LINE Notify APIへのPOSTリクエスト
  request
    .post(LINE_NOTIFY_API, postData)
    .then(async (res) => {
      console.log(res.data);
    })
    .catch((error) => {
      // LINE Notify APIへのリクエストでエラーが発生した場合
      console.log('ERROR: occured in backend (LINE Notify API)');
      console.log(error);
    });
}

/**
 * DiscordのメッセージをLINE Notifyに送信するための準備を行う
 * @param message
 * @returns void
 */
async function prepareDiscordMessageToLINENotify(message: Message, isVoid: boolean = false) {
  // DM には反応しない
  if (message.channel.type === ChannelType.DM) return;

  // 文章を取得
  const messageText = message.cleanContent;

  // チャンネル名を取得
  const parentChannel =
    message.channel.isThread() && message.channel.parent ? message.channel.parent.name : '';

  const messageMember = message.member.partial ? await message.member.fetch() : message.member;

  // メッセージタイトルを定義
  // スレッドチャンネルの場合は親チャンネル名を追加
  const messageTitle = `#${parentChannel ? parentChannel + ' > ' : ''}${message.channel.name}\n${
    messageMember.displayName
  }:`;

  // payload を作成
  const lineNotifyPayload = {
    username: messageMember.displayName,
    channelid:
      message.channel.isThread() && message.channel.parent
        ? message.channel.parent.id
        : message.channelId,
    groupname: message.channel.name,
    message: messageTitle + '\n' + messageText,
    avatarURL: message.author.displayAvatarURL({ extension: 'png' }),
    hasImage: false,
  } as LINENotifyPayload;

  // 添付ファイルがない場合
  if (message.attachments.size === 0) {
    postToLINENotify(lineNotifyPayload, isVoid);
    return;
  }

  let index = 1;
  // 添付ファイルがある場合
  message.attachments.forEach((attachment) => {
    console.log(attachment);
    if (!attachment) return;

    if (attachment.height && attachment.width) {
      const payloadWithImage = {
        ...lineNotifyPayload,
        hasImage: true,
        imageURL: attachment.url,
        previewURL: attachment.url,
        message: `${messageTitle} 画像 ${index}枚目\n${message.cleanContent}`,
      };

      index++;

      postToLINENotify(payloadWithImage, isVoid);
    } else {
      const payloadWithFile = {
        ...lineNotifyPayload,
        hasImage: false,
        message: `${messageTitle} ファイル ${index}つ目\n${attachment.url}\n${message.cleanContent}`,
      };

      postToLINENotify(payloadWithFile, isVoid);
    }
  });
}

export { LINENotifyPayload, postToLINENotify, prepareDiscordMessageToLINENotify };
