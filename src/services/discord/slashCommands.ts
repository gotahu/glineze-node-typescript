import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  Message,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { CONFIG_DEFINITIONS, config, configService } from '../../config';
import { Services } from '../../types/types';
import { logger } from '../../utils/logger';
import { notifyPractice, remindPracticesToChannel } from '../notion/practiceFunctions';
import { handleBreakoutRoomCommand } from './commands/BreakoutRoomCommand';
import { handleCountdownCommand } from './commands/CountdownCommand';
import { handleDeleteChannelCommand } from './commands/DeleteChannelCommand';
import { handleReloadCommand } from './commands/ReloadCommand';
import { handleSesameStatusCommand } from './commands/SesameCommand';
import { handleUpdateBotProfileCommand } from './commands/UpdateBotProfileCommand';
import { handleVersionCommand } from './commands/VersionCommand';
import { showReminderDashboard } from './reminderInteractions';

const AUTHORIZED_SLASH_COMMAND_ROLES = new Set(['運営', '事務', '技術']);

const slashCommands = [
  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('日時を指定してチャンネルまたはスレッドへリマインドします'),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Bot の設定を確認・変更します（運営・事務・技術ロール専用）')
    .addSubcommand((command) =>
      command.setName('list').setDescription('設定キーと現在値の一覧を表示します')
    )
    .addSubcommand((command) =>
      command
        .setName('get')
        .setDescription('指定した設定の現在値を表示します')
        .addStringOption((option) =>
          option
            .setName('key')
            .setDescription('確認する設定キー')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName('set')
        .setDescription('設定値を変更し、Notion に保存します')
        .addStringOption((option) =>
          option
            .setName('key')
            .setDescription('変更する設定キー')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('value')
            .setDescription('新しい設定値')
            .setRequired(true)
            .setMaxLength(2000)
        )
    ),
  new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('カウントダウンの情報確認や通知送信を行います')
    .addSubcommand((command) =>
      command.setName('info').setDescription('全設定と残り日数を表示します')
    )
    .addSubcommand((command) =>
      command.setName('send').setDescription('現在のカウントダウン通知を送信します')
    )
    .addSubcommand((command) =>
      command.setName('days').setDescription('イベントまでの残り日数を表示します')
    )
    .addSubcommand((command) =>
      command.setName('date').setDescription('イベントの日付を表示します')
    )
    .addSubcommand((command) =>
      command.setName('message').setDescription('通知メッセージのひな形を表示します')
    )
    .addSubcommand((command) =>
      command.setName('title').setDescription('イベントのタイトルを表示します')
    )
    .addSubcommand((command) =>
      command.setName('channel').setDescription('通知先チャンネルを表示します')
    )
    .addSubcommand((command) =>
      command
        .setName('setup')
        .setDescription('イベント情報をまとめて設定します')
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('開催日（例: 2026-12-20）')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(10)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('イベント名（例: 第10回定期演奏会）')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('カウントダウン通知の送信先（省略時は変更しません）')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
        .addStringOption((option) =>
          option
            .setName('notify-days')
            .setDescription('通知する残り日数（例: 30,14,7,3,1,0）')
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('通知文。{title} と {days} が使えます（省略時は変更しません）')
            .setMaxLength(1000)
        )
    ),
  new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('練習連絡と場所取り通知の送信先を設定します')
    .addSubcommand((command) =>
      command
        .setName('setup')
        .setDescription('練習連絡と場所取り通知の送信先をまとめて設定します')
        .addChannelOption((option) =>
          option
            .setName('practice-channel')
            .setDescription('毎日17時の練習連絡を送るチャンネルまたはスレッド')
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
        .addChannelOption((option) =>
          option
            .setName('place-channel')
            .setDescription('毎日8時の場所取り通知を送るチャンネルまたはスレッド')
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('breakout')
    .setDescription('ブレイクアウトルームを作成・削除・割り当てします')
    .addSubcommand((command) =>
      command
        .setName('create')
        .setDescription('指定数のブレイクアウトルームを作成します')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('作成する部屋数')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((command) =>
      command
        .setName('remove')
        .setDescription('すべてのブレイクアウトルームを削除します')
        .addBooleanOption((option) =>
          option.setName('confirm').setDescription('削除を確認する場合はオン').setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName('random')
        .setDescription('参加中のメンバーを各ルームへランダムに移動します')
        .addBooleanOption((option) =>
          option
            .setName('confirm')
            .setDescription('メンバー移動を確認する場合はオン')
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('delete-channel')
    .setDescription('指定したチャンネルを削除します')
    .addChannelOption((option) =>
      option.setName('channel').setDescription('削除するチャンネル').setRequired(true)
    )
    .addBooleanOption((option) =>
      option.setName('confirm').setDescription('削除を確認する場合はオン').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Notion から Bot 設定を再読み込みします'),
  new SlashCommandBuilder().setName('sesame').setDescription('Sesame の現在の施錠状態を表示します'),
  new SlashCommandBuilder()
    .setName('version')
    .setDescription('稼働中の Bot バージョンを表示します'),
  new SlashCommandBuilder()
    .setName('update-bot-profile')
    .setDescription('カウントダウンに合わせて Bot のプロフィールを更新します'),
  new SlashCommandBuilder()
    .setName('practice-template')
    .setDescription('練習連絡テンプレートの確認・再読み込みを行います')
    .addSubcommand((command) =>
      command
        .setName('preview')
        .setDescription('指定日数後の練習データでテンプレートをプレビューします')
        .addIntegerOption((option) =>
          option
            .setName('days')
            .setDescription('今日からの日数（省略時は翌日）')
            .setMinValue(0)
            .setMaxValue(30)
        )
    )
    .addSubcommand((command) =>
      command.setName('reload').setDescription('Notionから検証済みテンプレートを再読み込みします')
    )
    .addSubcommand((command) =>
      command.setName('status').setDescription('現在使用中のテンプレート取得元を表示します')
    ),
  new SlashCommandBuilder()
    .setName('practice-notify')
    .setDescription('翌日の練習連絡を送信します')
    .addSubcommand((command) =>
      command.setName('current').setDescription('実行中のチャンネルへ送信します')
    )
    .addSubcommand((command) =>
      command.setName('configured').setDescription('設定されているチャンネルへ送信します')
    )
    .addSubcommand((command) =>
      command
        .setName('channel')
        .setDescription('指定したチャンネルへ送信します')
        .addChannelOption((option) =>
          option
            .setName('destination')
            .setDescription('練習連絡の送信先チャンネルまたはスレッド')
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('practice-remind')
    .setDescription('このチャンネルへ場所取りのリマインドを送信します'),
];

export const slashCommandData = slashCommands.map((command) => command.toJSON());

function displayValue(key: string, value: string): string {
  const definition = Object.hasOwn(CONFIG_DEFINITIONS, key)
    ? CONFIG_DEFINITIONS[key as keyof typeof CONFIG_DEFINITIONS]
    : undefined;
  const sensitive =
    (definition && 'secret' in definition && definition.secret) ||
    /(token|api[_-]?key|secret|password|credential|privatekey|publickey|webhook)/i.test(key);
  return sensitive ? '••••••••' : value;
}

function splitMessage(content: string, maxLength = 1900): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of content.split('\n')) {
    if (line.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let offset = 0; offset < line.length; offset += maxLength) {
        chunks.push(line.slice(offset, offset + maxLength));
      }
      continue;
    }
    if (current && current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = '';
    }
    current += `${current ? '\n' : ''}${line}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function handleConfigCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'list') {
    const lines = [...config.getAllConfigs()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        const displayed = displayValue(key, value);
        const preview = displayed.length > 200 ? `${displayed.slice(0, 197)}...` : displayed;
        return `• \`${key}\`: ${preview}`;
      });
    const chunks = splitMessage(lines.join('\n') || '設定はありません。');
    await interaction.editReply(chunks.shift()!);
    for (const chunk of chunks) await interaction.followUp({ content: chunk, ephemeral: true });
    return;
  }

  const key = interaction.options.getString('key', true);
  if (subcommand === 'get') {
    const value = config.getAllConfigs().get(key);
    if (value === undefined) {
      await interaction.editReply(`設定キー \`${key}\` は存在しません。`);
      return;
    }
    const chunks = splitMessage(`\`${key}\`: ${displayValue(key, value)}`);
    await interaction.editReply(chunks.shift()!);
    for (const chunk of chunks) await interaction.followUp({ content: chunk, ephemeral: true });
    return;
  }

  const value = interaction.options.getString('value', true);
  await config.setConfig(key, value);
  await interaction.editReply(`設定 \`${key}\` を更新しました。`);
}

export function isValidCountdownDate(value: string): boolean {
  return CONFIG_DEFINITIONS.countdown_date.schema.safeParse(value).success;
}

export function normalizeNotifyDays(value: string): string | undefined {
  const parsed = CONFIG_DEFINITIONS.countdown_notify_days.schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

async function handleCountdownSetup(interaction: ChatInputCommandInteraction) {
  const date = interaction.options.getString('date', true);
  const title = interaction.options.getString('title', true).trim();
  const channel = interaction.options.getChannel('channel');
  const notifyDaysInput = interaction.options.getString('notify-days');
  const message = interaction.options.getString('message')?.trim();

  if (!isValidCountdownDate(date)) {
    await interaction.editReply('日付は実在する日を `YYYY-MM-DD` 形式で入力してください。');
    return;
  }
  if (!title) {
    await interaction.editReply('イベント名を入力してください。');
    return;
  }

  const notifyDays = notifyDaysInput ? normalizeNotifyDays(notifyDaysInput) : undefined;
  if (notifyDaysInput && !notifyDays) {
    await interaction.editReply(
      '通知日は0以上3650以下の整数をカンマ区切りで入力してください（例: `30,14,7,3,1,0`）。'
    );
    return;
  }
  if (message !== undefined && !message) {
    await interaction.editReply('通知文を変更する場合は、空でない文章を入力してください。');
    return;
  }

  await configService.updateMany({
    countdown_date: date,
    countdown_title: title,
    ...(channel ? { countdown_channelid: channel.id } : {}),
    ...(notifyDays ? { countdown_notify_days: notifyDays } : {}),
    ...(message ? { countdown_message: message } : {}),
  });

  const currentChannelId = channel?.id ?? config.getConfig('countdown_channelid');
  const currentNotifyDays = notifyDays ?? config.getConfig('countdown_notify_days');
  await interaction.editReply(
    [
      'カウントダウン設定を更新しました。',
      `• イベント: **${title}**`,
      `• 開催日: **${date}**`,
      `• 通知先: <#${currentChannelId}>`,
      `• 通知日: 残り **${currentNotifyDays}** 日`,
      message ? `• 通知文: ${message}` : '• 通知文: 変更なし',
    ].join('\n')
  );
}

async function handleRemindersSetup(interaction: ChatInputCommandInteraction) {
  const practiceChannel = interaction.options.getChannel('practice-channel', true);
  const placeChannel = interaction.options.getChannel('place-channel', true);

  await configService.updateMany({
    practice_remind_threadid: practiceChannel.id,
    bashotori_remind_threadid: placeChannel.id,
  });

  await interaction.editReply(
    [
      '通知先を更新しました。',
      `• 練習連絡（毎日17時）: <#${practiceChannel.id}>`,
      `• 場所取り通知（毎日8時）: <#${placeChannel.id}>`,
    ].join('\n')
  );
}

async function handlePracticeTemplateCommand(
  interaction: ChatInputCommandInteraction,
  services: Services
) {
  const subcommand = interaction.options.getSubcommand();
  const templateService = services.notion.practiceTemplateService;

  if (subcommand === 'reload') {
    const result = await templateService.reload();
    await interaction.editReply(result.message);
    return;
  }

  if (subcommand === 'status') {
    await interaction.editReply(templateService.getStatus().message);
    return;
  }

  const daysFromToday = interaction.options.getInteger('days') ?? 1;
  const practices =
    await services.notion.practiceService.retrievePracticesForRelativeDay(daysFromToday);
  if (practices.length === 0) {
    await interaction.editReply(`${daysFromToday} 日後の練習はありません。`);
    return;
  }

  const preview = practices
    .map(
      (practice, index) =>
        `【プレビュー ${index + 1}/${practices.length}】\n${practice.announceText}`
    )
    .join('\n\n');
  const chunks = splitMessage(preview);
  await interaction.editReply(chunks.shift()!);
  for (const chunk of chunks) await interaction.followUp({ content: chunk, ephemeral: true });
}

function createMessageAdapter(interaction: ChatInputCommandInteraction, content: string) {
  let responseSent = false;
  return {
    message: {
      content,
      guild: interaction.guild,
      member: interaction.member as GuildMember | null,
      channel: interaction.channel,
      reply: async (response: Parameters<ChatInputCommandInteraction['editReply']>[0]) => {
        responseSent = true;
        return interaction.editReply(response);
      },
    } as unknown as Message,
    didRespond: () => responseSent,
  };
}

function hasAuthorizedSlashCommandRole(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction
): boolean {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) return false;

  const memberRoles = interaction.member.roles;
  if (Array.isArray(memberRoles)) {
    return memberRoles.some((roleId) =>
      AUTHORIZED_SLASH_COMMAND_ROLES.has(interaction.guild!.roles.cache.get(roleId)?.name ?? '')
    );
  }

  return [...memberRoles.cache.values()].some((role) =>
    AUTHORIZED_SLASH_COMMAND_ROLES.has(role.name)
  );
}

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  services: Services
): Promise<void> {
  const requestedSubcommand = interaction.options.getSubcommand(false);
  const publicCommand = interaction.commandName === 'remind' && interaction.inGuild();
  const authorized = publicCommand || hasAuthorizedSlashCommandRole(interaction);
  const ephemeral =
    !authorized ||
    [
      'config',
      'reminders',
      'reload',
      'delete-channel',
      'update-bot-profile',
      'practice-template',
      'remind',
    ].includes(interaction.commandName) ||
    (interaction.commandName === 'countdown' && requestedSubcommand === 'setup');
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

  try {
    if (!authorized) {
      await interaction.editReply(
        'このコマンドを実行するには「運営」「事務」「技術」のいずれかのロールが必要です。'
      );
      return;
    }

    if (interaction.commandName === 'config') {
      await handleConfigCommand(interaction);
      return;
    }
    if (interaction.commandName === 'remind') {
      await showReminderDashboard(interaction, services);
      return;
    }
    if (interaction.commandName === 'reminders') {
      await handleRemindersSetup(interaction);
      return;
    }
    if (interaction.commandName === 'practice-template') {
      await handlePracticeTemplateCommand(interaction, services);
      return;
    }

    let content = `/${interaction.commandName}`;
    let handler: (message: Message, args: string[], services: Services) => Promise<void>;
    let args: string[] = [];

    switch (interaction.commandName) {
      case 'countdown': {
        // 別プロセスの管理画面で保存された設定も、応答前に必ず取り込む。
        await configService.refresh();
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'setup') {
          await handleCountdownSetup(interaction);
          return;
        }
        const internalSubcommand = subcommand === 'message' ? 'msg' : subcommand;
        content = subcommand === 'info' ? '/countdown info' : `/countdown ${subcommand}`;
        args = subcommand === 'info' ? [] : [internalSubcommand];
        handler = handleCountdownCommand;
        break;
      }
      case 'breakout': {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'create')
          args = ['create', String(interaction.options.getInteger('count', true))];
        else {
          if (!interaction.options.getBoolean('confirm', true)) {
            await interaction.editReply('実行するには `confirm` をオンにしてください。');
            return;
          }
          args = [subcommand, 'confirm'];
        }
        handler = handleBreakoutRoomCommand;
        break;
      }
      case 'delete-channel':
        if (!interaction.options.getBoolean('confirm', true)) {
          await interaction.editReply('削除するには `confirm` をオンにしてください。');
          return;
        }
        args = [interaction.options.getChannel('channel', true).id];
        args.push('confirm');
        handler = handleDeleteChannelCommand;
        break;
      case 'reload':
        handler = handleReloadCommand;
        break;
      case 'sesame':
        handler = handleSesameStatusCommand;
        break;
      case 'version':
        handler = handleVersionCommand;
        break;
      case 'update-bot-profile':
        handler = handleUpdateBotProfileCommand;
        break;
      case 'practice-remind':
        if (!interaction.channelId) throw new Error('送信先チャンネルを取得できませんでした。');
        await remindPracticesToChannel(services, interaction.channelId);
        await interaction.editReply('場所取りのリマインドを送信しました。');
        return;
      case 'practice-notify': {
        const subcommand = interaction.options.getSubcommand();
        let channelId: string;
        if (subcommand === 'configured') {
          channelId = config.getConfig('practice_remind_threadid');
        } else if (subcommand === 'channel') {
          channelId = interaction.options.getChannel('destination', true).id;
        } else {
          if (!interaction.channelId) throw new Error('送信先チャンネルを取得できませんでした。');
          channelId = interaction.channelId;
        }
        const result = await notifyPractice(services, {
          channelId,
          daysFromToday: 1,
        });
        if (result.practiceCount === 0) {
          await interaction.editReply('翌日の練習はありません。');
        } else if (result.sentCount === 0) {
          await interaction.editReply(
            `翌日の練習は ${result.practiceCount} 件ありますが、生成された練習連絡が空のため送信しませんでした。`
          );
        } else {
          const skippedCount = result.practiceCount - result.sentCount;
          await interaction.editReply(
            `翌日の練習連絡を <#${channelId}> へ ${result.sentCount} 件送信しました。` +
              (skippedCount > 0 ? `（未入力の ${skippedCount} 件は送信していません）` : '')
          );
        }
        return;
      }
      default:
        await interaction.editReply('未対応のコマンドです。');
        return;
    }

    const adapter = createMessageAdapter(interaction, content);
    await handler(adapter.message, args, services);
    if (!adapter.didRespond()) await interaction.editReply('コマンドを実行しました。');
  } catch (error) {
    logger.error(`スラッシュコマンド ${interaction.commandName} の実行に失敗しました: ${error}`);
    await interaction.editReply('コマンド実行時にエラーが発生しました。管理者に連絡してください。');
  }
}

export async function handleConfigAutocomplete(interaction: AutocompleteInteraction) {
  if (!hasAuthorizedSlashCommandRole(interaction)) {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = [...config.getAllConfigs().keys()]
    .filter((key) => key.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((key) => ({ name: key, value: key }));
  await interaction.respond(choices);
}
