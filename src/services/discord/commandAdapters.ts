import {
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  Message,
  PermissionFlagsBits,
} from 'discord.js';
import {
  CommandContext,
  CommandOperations,
  CommandPermission,
} from '../../features/commands/CommandContext';
import {
  createBreakoutRooms,
  randomBreakoutRooms,
  removeBreakoutRooms,
} from '../../features/breakout/BreakoutRoomFunctions';

const permissionBits: Record<CommandPermission, bigint> = {
  administrator: PermissionFlagsBits.Administrator,
  manageChannels: PermissionFlagsBits.ManageChannels,
  manageGuild: PermissionFlagsBits.ManageGuild,
  manageMessages: PermissionFlagsBits.ManageMessages,
  moveMembers: PermissionFlagsBits.MoveMembers,
};

export function getDiscordPermissionBit(permission: CommandPermission): bigint {
  return permissionBits[permission];
}

function createOperations(guild: Guild | null, memberId?: string): CommandOperations {
  return {
    guildAvailable: guild !== null,
    async createBreakoutRooms(count) {
      if (!guild) return;
      await createBreakoutRooms(guild, count);
    },
    async removeBreakoutRooms() {
      if (!guild) return;
      await removeBreakoutRooms(guild);
    },
    async randomBreakoutRooms() {
      if (!guild || !memberId) return 'not_in_voice';
      return randomBreakoutRooms(guild, memberId);
    },
    async deleteChannel(channelId) {
      const channel = guild?.channels.cache.get(channelId);
      if (!channel) return false;
      await channel.delete();
      return true;
    },
  };
}

export function createMessageCommandContext(message: Message): CommandContext {
  return {
    content: message.content,
    channelId: message.channelId,
    userId: message.author?.id ?? '',
    operations: createOperations(message.guild, message.member?.id),
    hasPermission(permission) {
      return message.member?.permissions.has(getDiscordPermissionBit(permission)) ?? false;
    },
    async sendTyping() {
      if (message.channel.isSendable()) await message.channel.sendTyping();
    },
    async reply(content) {
      await message.reply(content);
    },
  };
}

export function createInteractionCommandContext(
  interaction: ChatInputCommandInteraction,
  content: string
): { context: CommandContext; didRespond(): boolean } {
  let responseSent = false;
  const member = interaction.guild?.members.cache.get(interaction.user.id) as
    | GuildMember
    | undefined;
  return {
    context: {
      content,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      operations: createOperations(interaction.guild, member?.id ?? interaction.user.id),
      hasPermission(permission) {
        return interaction.memberPermissions?.has(getDiscordPermissionBit(permission)) ?? false;
      },
      async sendTyping() {},
      async reply(response) {
        responseSent = true;
        await interaction.editReply(response);
      },
    },
    didRespond: () => responseSent,
  };
}
