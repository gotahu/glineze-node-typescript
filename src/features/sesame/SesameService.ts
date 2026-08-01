import axios from 'axios';
import { config } from '../../config';
import {
  SesameAPIResponse,
  SesameDeviceStatus,
  SesameHistory,
  SesameLockStatus,
} from '../../types/types';
import { logger } from '../../utils/logger';
import {
  executeWithRetry,
  EXTERNAL_API_TIMEOUT_MS,
} from '../../shared/resilience/externalApiPolicy';
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

    this.reloadConfiguration();

    logger.info('SesameService の初期化が終了しました。');
  }

  public reloadConfiguration() {
    this.sesameApiUrl = config.get('sesame_app_api_url');
    this.sesameApiToken = config.get('sesame_app_api_key');
    this.sesameDeviceUUID = config.get('sesame_device_uuid');
    this.sesamePublicKey = config.get('sesame_device_publickey');

    if (
      !this.sesameApiUrl ||
      !this.sesameApiToken ||
      !this.sesameDeviceUUID ||
      !this.sesamePublicKey
    ) {
      throw new Error('Configuration not found for Sesame API');
    }

    this.loadSesameLockStatusMessage();
  }

  public getSesameLockStatusMessage(status: SesameLockStatus): string {
    return this.lockStatusMessage[status];
  }

  public loadSesameLockStatusMessage() {
    this.lockStatusMessage = {
      [SesameLockStatus.Locked]: config.get('sesame_message_when_locked'),
      [SesameLockStatus.Unlocked]: config.get('sesame_message_when_unlocked'),
      [SesameLockStatus.Error]: config.get('sesame_message_when_loading'),
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

    logger.info('Retrieving Sesame history');

    try {
      const response = await executeWithRetry(
        () =>
          axios.get(url.toString(), {
            timeout: EXTERNAL_API_TIMEOUT_MS,
            headers: {
              'x-api-key': this.sesameApiToken,
            },
          }),
        {
          healthId: 'integration:sesame',
          shouldRetry: (error) =>
            axios.isAxiosError(error) &&
            (!error.response || error.response.status === 429 || error.response.status >= 500),
        }
      );

      if (response.status == 200) {
        if (this.isSesameAPIResponse(response.data)) {
          logger.debug(`Sesame API returned ${response.data.histories.length} history entries`);
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

  private isSesameAPIResponse(data: unknown): data is SesameAPIResponse {
    if (typeof data !== 'object' || data === null) return false;
    const candidate = data as Record<string, unknown>;
    return Array.isArray(candidate.histories) && typeof candidate.cursor === 'number';
  }
}
