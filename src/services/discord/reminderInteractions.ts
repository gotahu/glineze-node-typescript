import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Services } from '../../types/types';
import { parseJstDateTime, tomorrowAtNine } from '../reminder/ReminderService';
import { CreateReminderInput } from '../reminder/ReminderRepository';

type Preset = '10m' | '1h' | 'tomorrow9' | 'custom';
type ReminderDraft = CreateReminderInput & { id: string; expiresAt: number };

const drafts = new Map<string, ReminderDraft>();
const DRAFT_TTL_MS = 15 * 60_000;

function service(services: Services) {
  const reminderService = services.notion.reminderService;
  if (!reminderService) throw new Error('リマインダーDBが設定されていません。');
  return reminderService;
}

function pruneDrafts() {
  const now = Date.now();
  for (const [id, draft] of drafts) if (draft.expiresAt <= now) drafts.delete(id);
}

function dashboardComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('remind:new')
        .setLabel('新しいリマインダー')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('remind:list')
        .setLabel('予定一覧')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function showReminderDashboard(
  interaction: ChatInputCommandInteraction,
  services: Services
) {
  if (!services.notion.reminderService) {
    await interaction.editReply(
      'リマインダー機能は未設定です。`/config set key:reminder_databaseid` で設定してください。'
    );
    return;
  }
  await interaction.editReply({
    content: '⏰ **リマインダー**\n\n新しい予定の登録や、自分の予定の確認ができます。',
    components: dashboardComponents(),
  });
}

export async function handleReminderButton(
  interaction: ButtonInteraction,
  services: Services
): Promise<boolean> {
  if (!interaction.customId.startsWith('remind:')) return false;
  pruneDrafts();

  if (interaction.customId === 'remind:new') {
    await interaction.update({
      content: '⏰ **いつ通知しますか？**\n\n時刻は日本時間（Asia/Tokyo）で扱います。',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          presetButton('10m', '10分後'),
          presetButton('1h', '1時間後'),
          presetButton('tomorrow9', '明日 9:00'),
          presetButton('custom', '日時を指定')
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(backButton()),
      ],
    });
    return true;
  }

  if (interaction.customId === 'remind:back') {
    await interaction.update({
      content: '⏰ **リマインダー**\n\n新しい予定の登録や、自分の予定の確認ができます。',
      components: dashboardComponents(),
    });
    return true;
  }

  if (interaction.customId === 'remind:list') {
    await interaction.deferUpdate();
    const reminders = await service(services).list(interaction.user.id);
    if (reminders.length === 0) {
      await interaction.editReply({
        content: '登録中のリマインダーはありません。',
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(backButton())],
      });
      return true;
    }
    const lines = reminders.map(
      (reminder, index) =>
        `${index + 1}. <t:${Math.floor(reminder.scheduledAt.getTime() / 1000)}:F> — ${escapePreview(reminder.message, 80)}`
    );
    const select = new StringSelectMenuBuilder()
      .setCustomId('remind:select-cancel')
      .setPlaceholder('削除する予定を選択')
      .addOptions(
        reminders.map((reminder) => ({
          label: escapePreview(reminder.name || reminder.message, 100),
          description: `予定: ${formatJst(reminder.scheduledAt)}`.slice(0, 100),
          value: reminder.pageId,
        }))
      );
    await interaction.editReply({
      content: `📋 **あなたのリマインダー**\n\n${lines.join('\n')}`,
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
        new ActionRowBuilder<ButtonBuilder>().addComponents(backButton()),
      ],
    });
    return true;
  }

  if (interaction.customId.startsWith('remind:preset:')) {
    const preset = interaction.customId.slice('remind:preset:'.length) as Preset;
    await interaction.showModal(buildReminderModal(preset));
    return true;
  }

  if (interaction.customId.startsWith('remind:confirm:')) {
    const draftId = interaction.customId.slice('remind:confirm:'.length);
    const draft = drafts.get(draftId);
    if (!draft || draft.creatorId !== interaction.user.id || draft.expiresAt <= Date.now()) {
      await interaction.update({
        content: '入力内容の有効期限が切れました。もう一度登録してください。',
        components: [],
      });
      return true;
    }
    await interaction.deferUpdate();
    const reminder = await service(services).create(draft);
    drafts.delete(draftId);
    await interaction.editReply({
      content: [
        '✅ **リマインダーを登録しました。**',
        `日時: <t:${Math.floor(reminder.scheduledAt.getTime() / 1000)}:F>（<t:${Math.floor(reminder.scheduledAt.getTime() / 1000)}:R>）`,
        `通知先: <#${reminder.destinationId}>`,
        `内容: ${reminder.message}`,
      ].join('\n'),
      components: dashboardComponents(),
    });
    return true;
  }

  if (interaction.customId.startsWith('remind:discard:')) {
    drafts.delete(interaction.customId.slice('remind:discard:'.length));
    await interaction.update({
      content: '登録をキャンセルしました。',
      components: dashboardComponents(),
    });
    return true;
  }

  if (interaction.customId.startsWith('remind:delete:')) {
    const pageId = interaction.customId.slice('remind:delete:'.length);
    await interaction.deferUpdate();
    const cancelled = await service(services).cancel(pageId, interaction.user.id);
    await interaction.editReply({
      content: cancelled
        ? 'リマインダーを削除しました。'
        : 'このリマインダーは削除できません。すでに実行済みか、登録者が異なります。',
      components: dashboardComponents(),
    });
    return true;
  }

  return true;
}

export async function handleReminderModal(
  interaction: ModalSubmitInteraction,
  services: Services
): Promise<boolean> {
  if (!interaction.customId.startsWith('remind:modal:')) return false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const preset = interaction.customId.slice('remind:modal:'.length) as Preset;
  const message = interaction.fields.getTextInputValue('message').trim();
  if (!message) {
    await interaction.editReply('リマインド内容を入力してください。');
    return true;
  }
  if (
    !interaction.inGuild() ||
    !interaction.guild ||
    !interaction.channelId ||
    !interaction.channel
  ) {
    await interaction.editReply(
      'リマインダーはサーバー内のチャンネルまたはスレッドで登録してください。'
    );
    return true;
  }
  if (!interaction.channel.isSendable()) {
    await interaction.editReply('このチャンネルまたはスレッドには通知を送信できません。');
    return true;
  }
  if (!(await service(services).canCreate(interaction.user.id))) {
    await interaction.editReply(
      '登録できる未来のリマインダーは1人20件までです。不要な予定を削除してください。'
    );
    return true;
  }

  const now = new Date();
  const scheduledAt = scheduledForPreset(preset, interaction, now);
  if (!scheduledAt) {
    await interaction.editReply(
      '日時は `2026-08-11 19:30` の形式で、現在から1分後〜1年後を指定してください。'
    );
    return true;
  }

  const draft: ReminderDraft = {
    id: randomUUID(),
    name: escapePreview(message, 60),
    message,
    scheduledAt,
    guildId: interaction.guildId,
    destinationId: interaction.channelId,
    destinationType: interaction.channel.isThread() ? 'thread' : 'channel',
    creatorId: interaction.user.id,
    expiresAt: Date.now() + DRAFT_TTL_MS,
  };

  if (message.includes('@全員')) {
    const roleIds = await service(services).resolveAllRole(interaction.guild);
    if (roleIds.length === 0) {
      await interaction.editReply('このサーバーには名前が完全一致する「全員」ロールがありません。');
      return true;
    }
    drafts.set(draft.id, draft);
    if (roleIds.length > 1) {
      const roles = roleIds.map((id) => interaction.guild!.roles.cache.get(id)).filter(Boolean);
      const select = new StringSelectMenuBuilder()
        .setCustomId(`remind:role:${draft.id}`)
        .setPlaceholder('メンションする「全員」ロールを選択')
        .addOptions(
          roles.map((role) => ({
            label: role!.name,
            description: `ロールID: ${role!.id}`,
            value: role!.id,
          }))
        );
      await interaction.editReply({
        content: '「全員」という名前のロールが複数あります。通知するロールを選択してください。',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      });
      return true;
    }
    draft.mentionRoleId = roleIds[0];
  }

  drafts.set(draft.id, draft);
  await interaction.editReply(confirmPayload(draft));
  return true;
}

export async function handleReminderSelect(
  interaction: StringSelectMenuInteraction,
  services: Services
): Promise<boolean> {
  if (!interaction.customId.startsWith('remind:')) return false;
  if (interaction.customId === 'remind:select-cancel') {
    const pageId = interaction.values[0];
    await interaction.update({
      content: 'このリマインダーを削除しますか？',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`remind:delete:${pageId}`)
            .setLabel('削除する')
            .setStyle(ButtonStyle.Danger),
          backButton()
        ),
      ],
    });
    return true;
  }
  if (interaction.customId.startsWith('remind:role:')) {
    const draftId = interaction.customId.slice('remind:role:'.length);
    const draft = drafts.get(draftId);
    if (!draft || draft.creatorId !== interaction.user.id || draft.expiresAt <= Date.now()) {
      await interaction.update({ content: '入力内容の有効期限が切れました。', components: [] });
      return true;
    }
    const validRoleIds = await service(services).resolveAllRole(interaction.guild!);
    if (!validRoleIds.includes(interaction.values[0])) {
      await interaction.update({ content: '選択されたロールは利用できません。', components: [] });
      return true;
    }
    draft.mentionRoleId = interaction.values[0];
    await interaction.update(confirmPayload(draft));
    return true;
  }
  return true;
}

function presetButton(preset: Preset, label: string) {
  return new ButtonBuilder()
    .setCustomId(`remind:preset:${preset}`)
    .setLabel(label)
    .setStyle(preset === 'custom' ? ButtonStyle.Primary : ButtonStyle.Secondary);
}

function backButton() {
  return new ButtonBuilder()
    .setCustomId('remind:back')
    .setLabel('戻る')
    .setStyle(ButtonStyle.Secondary);
}

function buildReminderModal(preset: Preset): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`remind:modal:${preset}`)
    .setTitle('リマインダーを作成');
  if (preset === 'custom') {
    modal.addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('datetime')
          .setLabel('通知日時（日本時間）')
          .setPlaceholder('2026-08-11 19:30')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
  }
  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('message')
        .setLabel('リマインド内容')
        .setPlaceholder('会場予約を確認する @全員')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1000)
        .setStyle(TextInputStyle.Paragraph)
    )
  );
  return modal;
}

function scheduledForPreset(
  preset: Preset,
  interaction: ModalSubmitInteraction,
  now: Date
): Date | undefined {
  if (preset === '10m') return new Date(now.getTime() + 10 * 60_000);
  if (preset === '1h') return new Date(now.getTime() + 60 * 60_000);
  if (preset === 'tomorrow9') return tomorrowAtNine(now);
  if (preset === 'custom')
    return parseJstDateTime(interaction.fields.getTextInputValue('datetime'), now);
  return undefined;
}

function confirmPayload(draft: ReminderDraft) {
  const timestamp = Math.floor(draft.scheduledAt.getTime() / 1000);
  return {
    content: [
      '**この内容で登録しますか？**',
      '',
      `日時: <t:${timestamp}:F>（<t:${timestamp}:R>）`,
      `内容: ${draft.message}`,
      `通知先: <#${draft.destinationId}>`,
      draft.mentionRoleId ? `@全員: <@&${draft.mentionRoleId}> に変換` : '@全員: 使用なし',
      'タイムゾーン: Asia/Tokyo',
    ].join('\n'),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`remind:confirm:${draft.id}`)
          .setLabel('登録する')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`remind:discard:${draft.id}`)
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

function escapePreview(value: string, maxLength: number) {
  const normalized = value.replace(/[\r\n]+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

function formatJst(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
