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

const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

async function postToLINENotify(payload: LINENotifyPayload) {
  // LINEとDiscordのペアを取得
  const pairs = await retrieveLINEAndDiscordPairs();
  // 対象のDiscordチャンネルに対応するペアを検索
  const pair = pairs.find((v) => v.discord_channel_id == payload.channelid);

  // トークンが見つからない場合はデフォルトのトークンを使用
  const lineNotifyToken = pair ? pair.line_notify_key : process.env.LINE_NOTIFY_VOID_TOKEN;
  console.log('line notify to ' + lineNotifyToken);

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

export { LINENotifyPayload, postToLINENotify };
