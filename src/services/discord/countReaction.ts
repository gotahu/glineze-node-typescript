import { Message, TextChannel } from 'discord.js';

async function handleCountReactionCommand(message: Message): Promise<void> {
  const args = message.content.split(' ');

  // バリデーション
  if (args.length < 4) {
    await message.reply(
      '引数が不足しています。`!count-reaction <すべて/ひとつ> <件数> <順位>` の形式で入力してください。'
    );
    return;
  }

  // all_flg: すべて or ひとつ
  const allFlg = args[1] === 'すべて' || args[1] === 'ひとつ' ? args[1] : null;
  if (!allFlg) {
    await message.reply('第1引数は「すべて」または「ひとつ」で指定してください。');
    return;
  }

  // count_numbers: 1から99999までの数値
  const countNumbers = parseInt(args[2]);
  if (isNaN(countNumbers) || countNumbers < 1 || countNumbers > 99999) {
    await message.reply('第2引数は1から99999の数値で指定してください。');
    return;
  }

  // ranking_num: 1から100までの数値
  const rankingNum = parseInt(args[3]);
  if (isNaN(rankingNum) || rankingNum < 1 || rankingNum > 100) {
    await message.reply('第3引数は1から100の数値で指定してください。');
    return;
  }

  let targetChannels: TextChannel[] = [];

  // チャンネルの設定
  if (allFlg === 'すべて') {
    const guild = message.guild;
    if (guild) {
      targetChannels = guild.channels.cache
        .filter((c) => c.isTextBased())
        .map((c) => c as TextChannel);
    }
  } else {
    const targetChannel = message.channel as TextChannel;
    targetChannels = [targetChannel];
  }

  // リアクションの集計
  const startTime = Date.now();
  let totalReactions = 0;
  const reactionCounts: { [key: string]: number } = {};

  for (const channel of targetChannels) {
    try {
      const messages = await channel.messages.fetch({ limit: countNumbers });
      messages.forEach((msg) => {
        msg.reactions.cache.forEach((reaction) => {
          totalReactions += reaction.count;
          if (reaction.emoji.name) {
            reactionCounts[reaction.emoji.name] =
              (reactionCounts[reaction.emoji.name] || 0) + reaction.count;
          }
        });
      });
    } catch (error) {
      console.error(`Failed to fetch messages for channel ${channel.name}: ${error}`);
    }
  }

  // ソート
  const sortedReactions = Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]);

  // メッセージの生成
  let resultMessage = `リアクション集計結果です(総件数: ${totalReactions})。\n`;
  sortedReactions.slice(0, rankingNum).forEach(([emoji, count], index) => {
    const percentage = ((count / totalReactions) * 100).toFixed(2);
    resultMessage += `${index + 1}位: ${emoji} → ${percentage}% (${count}件)\n`;
  });

  // 経過時間
  const elapsedTime = (Date.now() - startTime) / 1000;
  resultMessage += `\n集計チャンネル数: ${targetChannels.length}\n経過時間: ${elapsedTime}秒`;

  // 結果を送信
  try {
    await message.reply({
      content: resultMessage,
    });
  } catch (error) {
    console.error(`Failed to send message: ${error}`);
    await message.reply({
      content: 'エラーが発生しました。集計順位を減らすなどして試してください。',
    });
  }
}

export { handleCountReactionCommand };
