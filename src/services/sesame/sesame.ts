import axios, { Axios, AxiosPromise } from 'axios';
import { SesameAPIResponse, LockInfo, SesameStatus, SesamiHistory } from '../../types/types';
import { NotionService } from '../notion/notionService';
import { logger } from '../../utils/logger';

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

async function retrieveKeyHistory(notion: NotionService): Promise<SesamiHistory[]> {
  const apiKey = notion.getConfig('sesame_app_api_key');
  const deviceUUID = notion.getConfig('sesame_device_uuid');
  const apiUrl = notion.getConfig('sesame_app_api_url');
  const publicKey = notion.getConfig('sesame_device_publickey');

  if (!apiKey || !deviceUUID) {
    throw new Error('Configuration not found for Sesame API');
  }

  const url = new URL(`${deviceUUID}/history`, apiUrl);
  url.searchParams.append('a', publicKey);
  url.searchParams.append('lg', '1');

  console.log(`Retrieving Sesame history from ${url.toString()}`);

  try {
    const response = await axios.get(url.toString(), {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.status === 200) {
      console.log(response.data);

      if (isSesameAPIResponse(response.data)) {
        return response.data.histories;
      } else {
        throw new Error('Invalid response from Sesame API');
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      console.log(`Sesame API Error: ${response?.status} - ${error.message}`);
    } else {
      logger.error(`Sesame API Error: ${error.message}`);
    }

    return [];
  }
}

const isSesameAPIResponse = (data: any): data is SesameAPIResponse => {
  return Array.isArray(data.histories) && typeof data.cursor === 'number';
};

export { getSesameLockInfo };
