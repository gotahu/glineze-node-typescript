// 必要なライブラリをインポート
import dotenv from 'dotenv';
dotenv.config();
import { discordClient } from './discord/client';
import express from 'express';
import bodyParser from 'body-parser';
import { notifyLatestPractices, sendLINEMessageToDiscord } from './discord/message';

/*
  HTTP サーバ（express）をセットアップ
*/
const webServer = express();

// urlencodedとjsonは別々に初期化する
webServer.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
webServer.use(bodyParser.json());

// サーバを起動
webServer.listen(3000);
console.log('webserver(express) is online');

// post受付
webServer.post('/', async (req, res) => {
  // リクエストボディを出力
  console.log(req.body);

  // POST データ以外は破棄
  if (!req.body) {
    console.log('no post data');
    res.end();
    return;
  }

  if (!req.body.events) {
    console.log('no events array');
  }

  // 配列を取得
  const events = req.body.events;

  if (!events) {
    console.log('no events');
    res.end();
    return;
  }

  events.forEach(async (event: GASEvent) => {
    if (event.type == 'wake') {
      // GAS からの定期起動監視イベント
      console.log('GAS: 定期起動監視スクリプト受信');
      res.end();
      return;
    } else if (event.type == 'noonNotify') {
      // GAS からの明日の練習をDiscordに送るためのイベント
      console.log('GAS: noonNotify');
      notifyLatestPractices(discordClient);
    } else if (event.type == 'message' && event.groupid && event.name && event.message) {
      // LINE グループからのメッセージをDiscordに送る
      console.log('LINE: line message to discord channel');
      sendLINEMessageToDiscord(discordClient, event.groupid, event.name, event.message);
    } else if (event.type == 'join' || event.type == 'leave') {
      console.log('line: join or leave');
      console.log(event);
    }
  });
  res.end();
});

type GASEvent = {
  type: string;
  groupid?: string;
  name?: string;
  message?: string;
};
