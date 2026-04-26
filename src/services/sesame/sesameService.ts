import axios from 'axios';
import { config } from '../../config';
import {
  SesameAPIResponse,
  SesameDeviceStatus,
  SesameHistory,
  SesameLockStatus,
} from '../../types/types';
import { logger } from '../../utils/logger';
export class SesameService {
  private sesameApiUrl = '';
  private sesameApiToken = '';
  private sesameDeviceUUID = '';
  private sesamePublicKey = '';

  private lockStatusMessage = {
    [SesameLockStatus.Locked]: '倉庫｜🔐施錠中',
    [SesameLockStatus.Unlocked]: '倉庫｜🈳解錠中',
    [SesameLockStatus.Error]: '倉庫｜🔄取得中',
  };

  constructor() {
    logger.info('SesameService の初期化を開始します。');

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

    this.loadSesameLockStatusMessage();

    logger.info('SesameService の初期化が終了しました。');
  }

  public getSesameLockStatusMessage(status: SesameLockStatus): string {
    return this.lockStatusMessage[status];
  }

  public loadSesameLockStatusMessage() {
    this.lockStatusMessage = {
      [SesameLockStatus.Locked]: config.getConfig('sesame_message_when_locked'),
      [SesameLockStatus.Unlocked]: config.getConfig('sesame_message_when_unlocked'),
      [SesameLockStatus.Error]: config.getConfig('sesame_message_when_loading'),
    };
  }

  public async getSesameDeviceStatus(): Promise<SesameDeviceStatus> {
    const history = await this.retrieveKeyHistory();

    if (history.length === 0) {
      // 履歴がない場合
      return {
        lockStatus: SesameLockStatus.Error,
        latestType: 0,
        timestamp: new Date(0),
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
        logger.debug(`Sesame API response: ${JSON.stringify(response.data)}`);

        if (this.isSesameAPIResponse(response.data)) {
          return response.data.histories;
        } else {
          throw new Error('Invalid Sesame API response');
        }
      }
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const response = error.response;
        logger.error(`Sesame API Error: ${response?.status} - ${error.message}`);
      } else {
        logger.error(`Sesame API Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      return [];
    }
  }

  private isSesameAPIResponse(data: any): data is SesameAPIResponse {
    return Array.isArray(data.histories) && typeof data.cursor === 'number';
  }
}
