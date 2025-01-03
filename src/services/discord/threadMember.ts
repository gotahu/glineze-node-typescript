import {
  AnyThreadChannel,
  Collection,
  MessageReaction,
  Snowflake,
  ThreadMember,
  User,
  Message,
} from 'discord.js';
import { logger } from '../../utils/logger';
import { setTimeout } from 'timers/promises';

const REACTION_WAIT_TIME = 30_000;
const MESSAGE_DELAY = 500;

async function handleThreadMembersUpdate(
  addedMembers: Collection<Snowflake, ThreadMember>,
  removedMembers: Collection<Snowflake, ThreadMember>,
  thread: AnyThreadChannel
): Promise<void> {
  if (addedMembers.size === 0) return;

  await setTimeout(MESSAGE_DELAY);
  const lastMessage = thread.lastMessage;
  if (!lastMessage || lastMessage.author.bot) return;

  try {
    const replyMessage = await sendConfirmationMessage(lastMessage);
    await handleReactionCollection(replyMessage, lastMessage, thread, addedMembers);
  } catch (error) {
    logger.error('スレッドメンバー更新処理でエラーが発生しました', { error });
  }
}

async function sendConfirmationMessage(lastMessage: Message) {
  logger.info('スレッドでのメンバー追加を検知、確認メッセージを送信しました', { debug: true });
  return await lastMessage.reply(
    'スレッドにメンバーが追加されました。誤って追加した場合は、何らかのリアクションをこのメッセージにしてください。このメッセージは30秒後に自動で削除されます。'
  );
}

async function handleReactionCollection(
  replyMessage: Message,
  lastMessage: Message,
  thread: AnyThreadChannel,
  addedMembers: Collection<Snowflake, ThreadMember>
) {
  const collector = createReactionCollector(replyMessage, lastMessage);

  collector.on('collect', async () => {
    await handleMemberDeletion(thread, addedMembers);
  });

  collector.on('end', async () => {
    await replyMessage.delete();
    logger.info('リアクションの収集が終了しました。スレッドメンバー確認メッセージを削除します。', {
      debug: true,
    });
  });
}

function createReactionCollector(replyMessage: Message, lastMessage: Message) {
  const filter = (_: MessageReaction, user: User) => user.id === lastMessage.author.id;
  return replyMessage.createReactionCollector({
    filter,
    time: REACTION_WAIT_TIME,
  });
}

async function handleMemberDeletion(
  thread: AnyThreadChannel,
  members: Collection<Snowflake, ThreadMember>
) {
  await thread.send(`現在追加された ${members.size} 人のメンバーを削除します。`);
  logger.info('スレッドのメンバーを誤って追加したことを検知しました。ユーザーの削除を行います。');
  await removeThreadMembers(thread, members);
  await thread.send('メンバーの削除が完了しました。');
}

async function removeThreadMembers(
  thread: AnyThreadChannel,
  members: Collection<Snowflake, ThreadMember>
) {
  for (const member of members.values()) {
    if (!member.partial) {
      try {
        await thread.members.remove(member.id);
        logger.info(`メンバー ${member.user.displayName} をスレッドから削除しました。`, {
          debug: true,
        });
      } catch (error) {
        logger.error(`メンバー ${member.user.displayName} の削除に失敗しました。`);
      }
    }
  }
}

export { handleThreadMembersUpdate, removeThreadMembers };
