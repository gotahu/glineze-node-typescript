import axios from 'axios';
import {
  SesameAPIResponse,
  SesameDeviceStatus,
  SesameHistory,
  SesameLockStatus,
} from '../../types/types';
import { logger } from '../../utils/logger';
import { config } from '../../config/config';

export class SesameService {
  private sesameApiUrl = '';
  private sesameApiToken = '';
  private sesameDeviceUUID = '';
  private sesamePublicKey = '';

  constructor() {
    this.sesameApiUrl = config.getConfig('sesame_app_api_url');
    this.sesameApiToken = config.getConfig('sesame_app_api_key');
    this.sesameDeviceUUID = config.getConfig('sesame_device_uuid');
    this.sesamePublicKey = config.getConfig('sesame_device_publickey');

    if (
      !this.sesameApiUrl ||
      !this.sesameApiToken ||
      !this.sesameDeviceUUID ||
      !this.sesamePublicKey
    ) {
      throw new Error('Configuration not found for Sesame API');
    }
  }

  public async getSesameDeviceStatus(): Promise<SesameDeviceStatus> {
    const history = await this.retrieveKeyHistory();

    if (history.length === 0) {
      // 履歴がない場合
      return {
        lockStatus: SesameLockStatus.Error,
        latestType: 0,
        timestamp: null,
      };
    } else {
      // 履歴がある場合
      const latest = history[0];

      // デバイスの状態を返す
      return {
        lockStatus: this.getSesameLockStatus(latest.type),
        latestType: latest.type,
        timestamp: new Date(latest.timeStamp),
      };
    }
  }

  /**
   * type から SesameLockStatus を取得する
   * @param {number} type
   * @returns {SesameLockStatus}
   */
  public getSesameLockStatus(type: number): SesameLockStatus {
    const lockedTypes = [1, 6, 7, 10, 14, 16];
    const isLocked = lockedTypes.includes(type);
    const isUnavailable = type === -1;

    // TODO: unlocktypesを追加する

    return isUnavailable
      ? SesameLockStatus.Error
      : isLocked
        ? SesameLockStatus.Locked
        : SesameLockStatus.Unlocked;
  }

  public async retrieveKeyHistory(): Promise<SesameHistory[]> {
    const url = new URL(`${this.sesameDeviceUUID}/history`, this.sesameApiUrl);
    url.searchParams.append('a', this.sesamePublicKey);
    url.searchParams.append('lg', '1');

    logger.info(`Retrieving Sesame history from ${url.toString()}`);

    try {
      const response = await axios.get(url.toString(), {
        headers: {
          'x-api-key': this.sesameApiToken,
        },
      });

      if (response.status == 200) {
        console.log(response.data);

        if (this.isSesameAPIResponse(response.data)) {
          return response.data.histories;
        } else {
          throw new Error('Invalid Sesame API response');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const response = error.response;
        logger.error(`Sesame API Error: ${response?.status} - ${error.message}`);
      } else {
        logger.error(`Sesame API Error: ${error.message}`);
      }

      return [];
    }
  }

  private isSesameAPIResponse(data: any): data is SesameAPIResponse {
    return Array.isArray(data.histories) && typeof data.cursor === 'number';
  }
}
