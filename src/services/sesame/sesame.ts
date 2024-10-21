import axios from 'axios';
import { SesameAPIResponse, LockInfo, SesameStatus } from '../../types/types';
import { NotionService } from '../notion/notionService';

async function getSesameLockInfo(notion: NotionService): Promise<LockInfo> {
  const history = await retrieveKeyHistory(notion);

  if (history.length === 0) {
    return {
      status: SesameStatus.Error,
      latestType: 0,
      timestamp: null,
    };
  }

  const latest = history[0];
  const lockedTypes = [1, 6, 7, 10, 14, 16];

  const isLocked = lockedTypes.includes(latest.type);
  const isUnavailable = latest.type === -1;

  return {
    status: isUnavailable
      ? SesameStatus.Error
      : isLocked
        ? SesameStatus.Locked
        : SesameStatus.Unlocked,
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

    return response.data as SesameAPIResponse[];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      console.log(`Sesame API Error: ${response?.status} - ${error.message}`);
    }

    return [];
  }
}

export { getSesameLockInfo };
