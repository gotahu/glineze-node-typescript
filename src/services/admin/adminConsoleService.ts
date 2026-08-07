import {
  CONFIG_DEFINITIONS,
  ConfigCategory,
  ConfigKey,
  ConfigService,
  isConfigKey,
  normalizeConfigValue,
} from '../../config';
import { env } from '../../env';
import {
  AVAILABLE_PLACEHOLDERS,
  PracticeTemplateReloadResult,
} from '../notion/practiceTemplateService';
import { AdminLoginLinkService } from './adminLoginLinkService';

export type AdminSettingField = {
  key: ConfigKey;
  label: string;
  description: string;
  input: 'text' | 'textarea' | 'date' | 'url' | 'secret';
  secret: boolean;
  configured: boolean;
  discordChannel: boolean;
  value?: string;
};

type PracticeTemplateAdminService = {
  getStatus(): PracticeTemplateReloadResult;
  getTemplatePreview(): string;
  reload(): Promise<PracticeTemplateReloadResult>;
};

export type AdminConsoleRuntime = {
  notion: { practiceTemplateService: PracticeTemplateAdminService };
  discord?: {
    client: {
      isReady(): boolean;
      channels: {
        fetch(id: string): Promise<{
          name?: string | null;
          isSendable(): boolean;
          isThread?(): boolean;
        } | null>;
      };
    };
  };
  sesame?: { reloadConfiguration(): void };
};

export type DiscordChannelVerification = {
  id: string;
  name: string;
  kind: 'チャンネル' | 'スレッド';
};

export class AdminConsoleService {
  constructor(
    private readonly configs: ConfigService,
    private readonly runtime: AdminConsoleRuntime,
    private readonly loginLinks?: AdminLoginLinkService
  ) {}

  public getConfigReloadStatus(): { at?: Date; error?: string } {
    return this.configs.getReloadStatus();
  }

  public getSettings(category: ConfigCategory): AdminSettingField[] {
    if (category === 'sesame' && !env.SESAME_ENABLED) return [];

    return this.configs.getDefinitions(category).map(([key, definition]) => {
      const currentValue = this.configs.getAll().get(key) ?? '';
      const secret = 'secret' in definition && Boolean(definition.secret);
      return {
        key,
        label: definition.label,
        description: definition.description,
        input: definition.input,
        secret,
        configured: currentValue.length > 0,
        discordChannel: isDiscordChannelKey(key),
        ...(secret ? {} : { value: currentValue }),
      };
    });
  }

  public async updateSettings(
    category: ConfigCategory,
    input: Readonly<Record<string, string>>
  ): Promise<void> {
    if (category === 'sesame' && !env.SESAME_ENABLED) {
      throw new AdminOperationError('Sesame 連携は停止中です。');
    }

    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!isConfigKey(key) || CONFIG_DEFINITIONS[key].category !== category) {
        throw new AdminOperationError(`この画面から設定 ${key} は変更できません。`);
      }
      const definition = CONFIG_DEFINITIONS[key];
      const secret = 'secret' in definition && Boolean(definition.secret);
      if (secret && value.trim() === '') continue;
      updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      throw new AdminOperationError('変更する設定を入力してください。');
    }
    await this.configs.updateMany(updates);
  }

  public getPracticeTemplate() {
    const service = this.runtime.notion.practiceTemplateService;
    return {
      status: service.getStatus(),
      preview: service.getTemplatePreview(),
      placeholders: [...AVAILABLE_PLACEHOLDERS],
    };
  }

  public reloadPracticeTemplate(): Promise<PracticeTemplateReloadResult> {
    return this.runtime.notion.practiceTemplateService.reload();
  }

  public async verifyDiscordChannel(
    key: ConfigKey,
    input: string
  ): Promise<DiscordChannelVerification> {
    if (!isDiscordChannelKey(key)) {
      throw new AdminOperationError('この設定は Discord チャンネル ID ではありません。');
    }

    const id = normalizeConfigValue(key, input);
    const client = this.runtime.discord?.client;
    if (!client?.isReady()) {
      throw new AdminOperationError('Discord Bot が接続されていないため確認できません。');
    }

    try {
      const channel = await client.channels.fetch(id);
      if (!channel) throw new AdminOperationError('指定したチャンネルが見つかりません。');
      if (!channel.isSendable()) {
        throw new AdminOperationError('Bot がメッセージを送信できないチャンネルです。');
      }
      const kind = channel.isThread?.() ? 'スレッド' : 'チャンネル';
      return { id, name: channel.name || '名称不明', kind };
    } catch (error) {
      if (error instanceof AdminOperationError) throw error;
      throw new AdminOperationError(
        'チャンネルを確認できませんでした。IDとBotの閲覧権限を確認してください。'
      );
    }
  }

  public async reloadConfig(): Promise<void> {
    await this.configs.initialize();
    await this.runtime.notion.practiceTemplateService.reload();
    this.runtime.sesame?.reloadConfiguration();
  }

  public async rotateLoginLink(): Promise<void> {
    if (!this.loginLinks) throw new AdminOperationError('管理画面ログインリンクは無効です。');
    await this.loginLinks.rotate();
  }

  public getSystemStatus() {
    return {
      nodeEnv: env.NODE_ENV,
      notionAutomationEnabled: env.NOTION_AUTOMATION_ENABLED,
      sesameEnabled: env.SESAME_ENABLED,
      adminEnabled: env.ADMIN_ENABLED,
      discordTokenConfigured: Boolean(env.DISCORD_BOT_TOKEN),
      notionTokenConfigured: Boolean(env.NOTION_TOKEN),
      relayWebhookConfigured: Boolean(env.DISCORD_RELAY_WEBHOOK),
      branch: env.BRANCH,
    };
  }
}

function isDiscordChannelKey(key: ConfigKey): boolean {
  return /(?:channelid|threadid)$/.test(key);
}

export class AdminOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminOperationError';
  }
}
