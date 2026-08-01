import { CommandPermission } from './CommandContext';

export function getRequiredCommandPermission(
  commandName: string,
  subcommand?: string
): CommandPermission | undefined {
  switch (commandName) {
    case 'config':
    case 'reminders':
    case 'reload':
      return 'administrator';
    case 'countdown':
      return subcommand === 'setup' ? 'administrator' : undefined;
    case 'delete-channel':
    case 'deletechannel':
      return 'manageChannels';
    case 'update-bot-profile':
    case 'updatebotprofile':
      return 'manageGuild';
    case 'practice-remind':
      return 'manageMessages';
    case 'breakout':
    case 'br':
      return subcommand === 'random' ? 'moveMembers' : 'manageChannels';
    default:
      return undefined;
  }
}

export function permissionDeniedMessage(permission: CommandPermission): string {
  switch (permission) {
    case 'manageChannels':
      return 'この操作には「チャンネルの管理」権限が必要です';
    case 'moveMembers':
      return 'この操作には「メンバーを移動」権限が必要です';
    default:
      return 'このコマンドは必要な権限を持つメンバーがサーバー内で実行してください。';
  }
}
