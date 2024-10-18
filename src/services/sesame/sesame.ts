import axios from 'axios';
import { LockStatus, SesameAPIResponse } from '../../types/types';
import { NotionService } from '../notion/notionService';

async function getSesameLockStatus(notion: NotionService): Promise<LockStatus> {
  const history = await retrieveKeyHistory(notion);

  if (history.length === 0) {
    return {
      isLocked: false,
      latestType: 0,
      timestamp: null,
    };
  }

  const latest = history[0];
  const lockedTypes = [1, 6, 7, 10, 14, 16];

  const isLocked = lockedTypes.includes(latest.type);

  return {
    isLocked,
    latestType: latest.type,
    timestamp: new Date(latest.timeStamp),
  };
}

async function retrieveKeyHistory(notion: NotionService): Promise<SesameAPIResponse[]> {
  const apiKey = notion.getConfig('sesame_api_key');
  const deviceUUID = notion.getConfig('sesame_device_uuid');

  if (!apiKey || !deviceUUID) {
    throw new Error('Configuration not found for Sesame API');
  }

  try {
    const response = await axios.get(
      `https://app.candyhouse.co/api/sesame2/${deviceUUID}/history?page=0&lg=1`,
      {
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    // 一件も取得できないということは無いのでエラー
    if (!response.data) {
      throw new Error('No history data found in Sesame API');
    }

    return response.data as SesameAPIResponse[];
  } catch (error) {
    console.error(error);
    throw new Error('Error retrieving Sesame history');
  }
}

export { getSesameLockStatus };
