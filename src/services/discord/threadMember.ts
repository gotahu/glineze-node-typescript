import {
  AnyThreadChannel,
  Collection,
  MessageReaction,
  Snowflake,
  ThreadMember,
  User,
} from 'discord.js';
import { logger } from '../../utils/logger';
import { setTimeout } from 'timers/promises';

async function handleThreadMembersUpdate(
  addedMembers: Collection<Snowflake, ThreadMember>,
  removedMembers: Collection<Snowflake, ThreadMember>,
  thread: AnyThreadChannel
): Promise<void> {
  // メンバーが追加された場合
  if (addedMembers.size > 0) {
    // 最新のメッセージを正しく取得するために少し待機
    await setTimeout(500);

    // 追加のきっかけとなったメッセージを取得
    // スレッドの中で最新のメッセージを1件取得する
    const lastMessage = thread.lastMessage;
    if (lastMessage) {
      if (lastMessage.author.bot) {
        return;
      }

      logger.info('スレッドでのメンバー追加を検知、確認メッセージを送信しました', {
        debug: true,
      });

      const replyMessage = await lastMessage.reply(
        'スレッドにメンバーが追加されました。誤って追加した場合は、何らかのリアクションをこのメッセージにしてください。このメッセージは30秒後に自動で削除されます。'
      );

      // メッセージを送信したユーザーと同じユーザーのリアクションのみを受け付ける
      const filter = (reaction: MessageReaction, user: User) => {
        return user.id === lastMessage.author.id;
      };

      const collector = replyMessage.createReactionCollector({
        filter: filter,
        time: 30_000,
      });

      // リアクションがついたらメンバーを削除
      collector.on('collect', async (reaction, user) => {
        await thread.send(`現在追加された ${addedMembers.size} 人のメンバーを削除します。`);
        logger.info(
          'スレッドのメンバーを誤って追加したことを検知しました。ユーザーの削除を行います。'
        );
        await removeThreadMembers(thread, addedMembers);
        thread.send('メンバーの削除が完了しました。');
      });

      collector.on('end', async (collected) => {
        await replyMessage.delete();
        logger.info(
          'リアクションの収集が終了しました。スレッドメンバー確認メッセージを削除します。',
          { debug: true }
        );
      });
    }
  }
}

async function removeThreadMembers(
  thread: AnyThreadChannel,
  members: Collection<Snowflake, ThreadMember>
) {
  for (const member of members.values()) {
    if (!member.partial) {
      try {
        await thread.members.remove(member.id);
        logger.info(`メンバー ${member.user.displayName} をスレッドから削除しました。`);
      } catch (error) {
        logger.error(`メンバー ${member.user.displayName} の削除に失敗しました。`);
      }
    }
  }
}

export { handleThreadMembersUpdate, removeThreadMembers };
