import {
  BaseInteraction,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  ThreadChannel,
  User,
} from 'discord.js';

import {
  addNotificationMessage,
  retrieveNotificationMessages,
  deleteNotificationMessage,
} from '../notion/notion-interaction';

/**
 * 指定されたスレッドチャンネルから、特定のメンバーを除いたすべてのメンバーを削除します。
 * @param {ThreadChannel} threadChannel - 操作対象のスレッドチャンネル
 * @param {string[]} excludeMemberIds - 削除から除外するメンバーのID配列
 */
async function removeMembersExcept(threadChannel: ThreadChannel, excludeMemberIds: string[]) {
  try {
    const members = await threadChannel.members.fetch();
    const removalPromises = members
      .filter((member) => !excludeMemberIds.includes(member.id))
      .map((member) => threadChannel.members.remove(member.id));

    await Promise.all(removalPromises);
  } catch (error) {
    console.error('Failed to remove members:', error);
    throw error; // エラーを呼び出し元に伝播させる
  }
}

export const handleInteractionCreate = async (interaction: BaseInteraction) => {
  // インタラクションがボタンかどうかを確認
  if (!interaction.isButton()) return;

  // ボタンのカスタムIDに基づいて処理を分岐
  switch (interaction.customId) {
    case 'delete':
      // スレッドのチャンネルであることを確認
      if (interaction.message.channel instanceof ThreadChannel) {
        // スレッドのオーナーIDを取得
        const ownerId = interaction.message.channel.ownerId;

        if (ownerId) {
          const interactionMakerId = interaction.user.id;
          const botId = interaction.client.user.id;

          // スレッドの現在のメンバーを取得
          const excludeMemberIds = [ownerId, interactionMakerId, botId];
          await removeMembersExcept(interaction.message.channel, excludeMemberIds);
          await interaction.reply({
            content: '指定されたメンバーをスレッドから削除しました。',
            ephemeral: true,
          });
        } else {
          // スレッドでない場合の処理（オプション）
          await interaction.reply({
            content: 'この操作はスレッド内でのみ有効です。',
            ephemeral: true,
          });
        }
        break;
      } else {
        console.log('');
      }

    case 'ignore':
      // 「無視する」ボタンを押した場合、BOTから送信されたメッセージを削除
      if (interaction.message.deletable) {
        await interaction.message.delete();
      }
      break;
  }
};

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) {
  // デバッグ用に出力する
  console.log(reaction);
  console.log(
    `${reaction.message.guild} で ${user.tag} が ${reaction.emoji.name} をリアクションしました`
  );

  const reactedMessageId = reaction.message.id;

  // Notion データベースで通知対象になっていないか検索しておく
  const notificationMessages = await retrieveNotificationMessages(reactedMessageId);

  // 誰に通知すればよいか、ユーザーIDを取得する
  const notificationUserId = user.id;

  // メッセージを送信するため、通知対象者のDiscord User オブジェクトを取得する
  const notificationUser = reaction.client.users.cache.get(notificationUserId);

  if (!notificationUser) {
    console.error('通知対象者のDiscord User オブジェクトを取得できませんでした。');
    return;
  }

  // そのメッセージが通知対象に設定されている場合
  // 配列の0番目の要素のuserIdに、通知対象者のidが含まれているかどうかを確認する
  // 0番目だけでよい理由は、メッセージIDはユニークであるため、同じメッセージIDを持つ要素は存在しないため
  const isAlreadyNotificationMessage =
    notificationMessages.length > 0
      ? notificationMessages[0].userId.includes(notificationUserId)
      : false;

  console.log(`notificationMessages.length: ${notificationMessages.length}`);
  console.log(`notificationUserId: ${notificationUserId}`);
  console.log(`isAlreadyNotificationMessage: ${isAlreadyNotificationMessage}`);

  // 早期に終了する
  if (
    reaction.emoji.name !== '🔔' &&
    reaction.emoji.name !== '🔕' &&
    !isAlreadyNotificationMessage
  ) {
    console.log('リアクションされたメッセージは通知対象ではありませんでした。');
    return;
  }

  const reactedMessage = reaction.message.partial
    ? await fetchPartialMessage(reaction.message)
    : reaction.message;

  if (!reactedMessage) {
    notificationUser.send(':warning: エラー：メッセージオブジェクトが存在しませんでした。');
    console.error('メッセージオブジェクトが存在しませんでした。');
    return;
  }

  // メッセージのURLを取得する
  const messageUrl = reactedMessage.url;

  // メッセージにベルのリアクションがつけられたら、そのメッセージを通知対象のメッセージとする
  if (reaction.emoji.name === '🔔') {
    // ベルのリアクションを削除する
    reaction.remove();

    // すでに通知対象である場合は、エラーメッセージを吐く
    if (isAlreadyNotificationMessage) {
      console.log(`messageId: ${reactedMessageId} はすでに通知対象に指定されています`);
      notificationUser.send(
        generateMessage('warning', `エラー： ${messageUrl} はすでに通知対象に設定されています。`)
      );
    } else {
      try {
        await addNotificationMessage(reactedMessageId, notificationUserId);
        console.log(`messageId: ${reactedMessageId} を通知対象のメッセージとしました`);
        notificationUser.send(
          generateMessage('white_check_mark', `${messageUrl} を通知対象に設定しました`)
        );
      } catch (error) {
        console.error(
          `messageId: ${reactedMessageId} を通知対象のメッセージとできませんでした ${error}`
        );
        notificationUser.send(
          generateMessage(
            'warning',
            `エラー： ${messageUrl} を通知対象に設定できませんでした。${error}`
          )
        );
      }
    }
  } else if (reaction.emoji.name === '🔕') {
    // ベルのリアクションを削除する
    reaction.remove();

    if (!isAlreadyNotificationMessage) {
      console.error(`messageId: ${reactedMessageId} は通知対象ではありません。`);
      notificationUser.send(
        generateMessage('warning', `エラー： ${messageUrl} はそもそも通知対象になっていません。`)
      );
    } else {
      // 通知対象であった場合、通知対象から削除する
      try {
        await deleteNotificationMessage(reactedMessageId, notificationUserId);

        console.log(`messageId: ${reactedMessageId} を通知対象から削除しました`);
        notificationUser.send(
          generateMessage(
            'person_gesturing_ok_tone1',
            `${messageUrl} を通知対象から削除しました。もうこのメッセージの通知は来ません。`
          )
        );
      } catch (error) {
        console.error(
          `messageId: ${reactedMessageId} の通知対象からの削除に失敗しました, ${error}`
        );
        notificationUser.send(
          generateMessage(
            'warning',
            `エラー： ${messageUrl} の通知対象からの削除に失敗しました。${error}`
          )
        );
      }
    }
  } else {
    // 通知対象のメッセージであった場合、通知対象者に通知を送信する
    // ユーザー名を取得する
    const userDisplayName = user.displayName;
    // 通知対象者に通知を送信する
    notificationMessages[0].userId.forEach(async (userId) => {
      try {
        const user = await reaction.client.users.fetch(userId);
        user.send(
          generateMessage(
            'bell',
            `${messageUrl} に（${userDisplayName}）さんがリアクション（${reaction.emoji.name}）しました。`
          )
        );
        console.log(
          `通知対象者に通知を送信しました。userId: ${userId}, mesaggeId: ${reactedMessageId}`
        );
      } catch (error) {
        console.error(
          `通知対象者に通知を送信できませんでした。userId: ${userId}, mesaggeId: ${reactedMessageId}`
        );
      }
    });
  }
}

async function fetchPartialMessage(message: PartialMessage): Promise<Message | undefined> {
  if (message.partial) {
    try {
      const fullMessage = await message.fetch();
      return fullMessage;
    } catch (error) {
      console.error(`Failed to fetch the message: ${message.id}`, error);
      return undefined;
    }
  } else {
    throw new Error('The message is not partial.');
  }
}

const generateMessage = (prefix: string, message: string) => {
  return `:${prefix}: ： ${message}`;
};
