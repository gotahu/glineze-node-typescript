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
  console.log(addedMembers, removedMembers, thread);

  // メンバーが追加された場合
  if (addedMembers.size > 0) {
    // 最新のメッセージを正しく取得するために少し待機
    await setTimeout(500);

    // 追加のきっかけとなったメッセージを取得
    // スレッドの中で最新のメッセージを1件取得する
    const message = thread.lastMessage;
    if (message) {
      // メッセージを送信したユーザーと同じユーザーのリアクションのみを受け付ける
      const filter = (reaction: MessageReaction, user: User) => {
        return user.id === message.author.id;
      };

      const collector = message.createReactionCollector({
        filter: filter,
        time: 30_000,
      });

      // リアクションがついたらメンバーを削除
      collector.on('collect', async (reaction, user) => {
        await thread.send(`現在追加された ${addedMembers.size} 人のメンバーを削除します。`);
        logger.info(
          'スレッドのメンバーを誤って追加したことを検知しました。ユーザーの削除を行います。'
        );
        await Promise.all(
          Array.from(addedMembers.values()).map((member) => thread.members.remove(member.id))
        );
      });
    }
  }
}

export default handleThreadMembersUpdate;
