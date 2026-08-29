import { Client, Collection, Guild, GuildMember, Role, Snowflake } from 'discord.js';
import { logger } from '../../utils/logger';

export const ALL_MEMBERS_ROLE_NAME = '全員';
const ROLE_SYNC_BATCH_SIZE = 25;
const ROLE_ASSIGNMENT_REASON = '「全員」ロールのメンバー同期';

export type AllMembersRoleSyncResult = {
  guildCount: number;
  memberCount: number;
  addedCount: number;
  failedCount: number;
};

function selectAllMembersRole(
  guild: Guild,
  roles: Collection<Snowflake, Role>,
  logFailure = true
): Role | undefined {
  const matches = roles.filter((role) => role.name === ALL_MEMBERS_ROLE_NAME);
  if (matches.size === 1) return matches.first();
  if (!logFailure) return undefined;

  if (matches.size === 0) {
    logger.error(
      `Discord サーバー ${guild.name} に「${ALL_MEMBERS_ROLE_NAME}」ロールがありません。`
    );
  } else {
    logger.error(
      `Discord サーバー ${guild.name} に「${ALL_MEMBERS_ROLE_NAME}」ロールが複数あるため、同期を中止しました。`
    );
  }
  return undefined;
}

export async function resolveAllMembersRole(guild: Guild): Promise<Role | undefined> {
  const roles = await guild.roles.fetch();
  return selectAllMembersRole(guild, roles);
}

async function assignRole(member: GuildMember, role: Role): Promise<boolean> {
  if (member.roles.cache.has(role.id)) return false;
  await member.roles.add(role, ROLE_ASSIGNMENT_REASON);
  return true;
}

/** 新規参加者へ「全員」ロールを付与する。失敗はイベントループへ伝播させない。 */
export async function handleAllMembersRoleForNewMember(member: GuildMember): Promise<void> {
  try {
    const cachedRole = selectAllMembersRole(member.guild, member.guild.roles.cache, false);
    const role = cachedRole ?? (await resolveAllMembersRole(member.guild));
    if (!role) return;

    if (await assignRole(member, role)) {
      logger.info(
        `新規参加メンバー ${member.user.tag} に「${ALL_MEMBERS_ROLE_NAME}」ロールを付与しました。`
      );
    }
  } catch (error) {
    logger.error(
      `新規参加メンバー ${member.user.tag} への「${ALL_MEMBERS_ROLE_NAME}」ロール付与に失敗しました。`,
      { error }
    );
  }
}

async function synchronizeGuild(
  guild: Guild
): Promise<Omit<AllMembersRoleSyncResult, 'guildCount'>> {
  const role = await resolveAllMembersRole(guild);
  if (!role) return { memberCount: 0, addedCount: 0, failedCount: 0 };

  const members = await guild.members.fetch();
  const missingMembers = [...members.values()].filter((member) => !member.roles.cache.has(role.id));
  let addedCount = 0;
  let failedCount = 0;

  // Discord.js のレート制御に任せつつ、全件直列より速く、無制限な同時要求にもならないようにする。
  for (let index = 0; index < missingMembers.length; index += ROLE_SYNC_BATCH_SIZE) {
    const batch = missingMembers.slice(index, index + ROLE_SYNC_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((member) => assignRole(member, role)));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) addedCount++;
      if (result.status === 'rejected') failedCount++;
    }
  }

  logger.info(
    `「${ALL_MEMBERS_ROLE_NAME}」ロールを同期しました: server=${guild.name}, members=${members.size}, added=${addedCount}, failed=${failedCount}`
  );
  return { memberCount: members.size, addedCount, failedCount };
}

/** Bot が参加している全サーバーで「全員」ロールの不足メンバーを補完する。 */
export async function synchronizeAllMembersRole(client: Client): Promise<AllMembersRoleSyncResult> {
  const result: AllMembersRoleSyncResult = {
    guildCount: client.guilds.cache.size,
    memberCount: 0,
    addedCount: 0,
    failedCount: 0,
  };

  for (const guild of client.guilds.cache.values()) {
    try {
      const guildResult = await synchronizeGuild(guild);
      result.memberCount += guildResult.memberCount;
      result.addedCount += guildResult.addedCount;
      result.failedCount += guildResult.failedCount;
    } catch (error) {
      result.failedCount++;
      logger.error(
        `Discord サーバー ${guild.name} の「${ALL_MEMBERS_ROLE_NAME}」ロール同期に失敗しました。`,
        {
          error,
        }
      );
    }
  }

  return result;
}
