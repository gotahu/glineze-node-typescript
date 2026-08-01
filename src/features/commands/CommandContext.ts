import type { SesameDeviceStatus, SesameLockStatus } from '../../types/sesame';

export type CommandPermission =
  | 'administrator'
  | 'manageChannels'
  | 'manageGuild'
  | 'manageMessages'
  | 'moveMembers';

export type RandomBreakoutResult = 'success' | 'no_breakout_rooms' | 'not_in_voice';

export interface CommandOperations {
  readonly guildAvailable: boolean;
  createBreakoutRooms(count: number): Promise<void>;
  removeBreakoutRooms(): Promise<void>;
  randomBreakoutRooms(): Promise<RandomBreakoutResult>;
  deleteChannel(channelId: string): Promise<boolean>;
}

export interface CommandContext {
  readonly content: string;
  readonly channelId?: string;
  readonly userId: string;
  readonly operations: CommandOperations;
  hasPermission(permission: CommandPermission): boolean;
  sendTyping(): Promise<void>;
  reply(content: string): Promise<void>;
}

export interface CommandDependencies {
  discord: {
    sendStringsToChannel(messages: string[], channelId: string): Promise<void>;
    setBotActivity(message: string): void;
  };
  sesame?: {
    reloadConfiguration(): void;
    getSesameDeviceStatus(): Promise<SesameDeviceStatus>;
    getSesameLockStatusMessage(status: SesameLockStatus): string;
  };
}

export type CommandHandler = (
  context: CommandContext,
  args: string[],
  services: CommandDependencies
) => Promise<void>;
