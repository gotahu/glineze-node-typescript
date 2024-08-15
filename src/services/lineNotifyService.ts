import axios from 'axios';
import { config } from '../config/config';
import { CONSTANTS } from '../config/constants';
import { LINENotifyPayload } from '../types/types';
import { logger } from '../utils/logger';
import { retrieveLINEAndDiscordPairs } from '../notion/notion-interaction';

export async function postToLINENotify(
  payload: LINENotifyPayload,
  isVoid: boolean = false
): Promise<void> {
  const lineNotifyToken = isVoid
    ? config.lineNotify.voidToken
    : await getLineNotifyToken(payload.channelid);

  const postData = {
    message: payload.message,
    imageFullsize: payload.imageURL,
    imageThumbnail: payload.previewURL,
  };

  await postToLINENotifyWithText(postData, lineNotifyToken);
}

type LINENotifyPostData = {
  message: string;
  imageFullsize?: string;
  imageThumbnail?: string;
};

export async function postToLINENotifyWithText(
  postData: LINENotifyPostData,
  lineNotifyToken: string
): Promise<void> {
  const request = axios.create({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Bearer ' + lineNotifyToken,
    },
    responseType: 'json',
  });

  try {
    const res = await request.post(CONSTANTS.LINE_NOTIFY_API, postData);
    logger.info(JSON.stringify(res.data));
  } catch (error) {
    logger.error('Error occurred in LINE Notify API');
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}

async function getLineNotifyToken(channelId: string): Promise<string> {
  try {
    // LINEとDiscordのペアを取得
    const pairs = await retrieveLINEAndDiscordPairs();

    // 対象のDiscordチャンネルに対応するペアを検索
    const pair = pairs.find((v) => v.discord_channel_id === channelId);

    if (pair) {
      logger.info(`LINE Notify token found for channel ID: ${channelId}`);
      return pair.line_notify_key;
    } else {
      logger.warn(`No LINE Notify token found for channel ID: ${channelId}, using default token`);
      return config.lineNotify.voidToken;
    }
  } catch (error) {
    logger.error(`Error retrieving LINE Notify token: ${error}`);
    return config.lineNotify.voidToken;
  }
}
