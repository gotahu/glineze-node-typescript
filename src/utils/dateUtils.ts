/**
 * 英語の曜日を含む文字列中の曜日を日本語に置き換えます。
 * 英語の曜日表記（Sun, Mon, Tue, ...）が括弧内にある場合、
 * 対応する日本語の曜日表記（日、月、火、...）に置き換えます。
 *
 * @param {string} str - 置き換えを行う文字列。
 * @returns {string} 曜日が日本語に置き換えられた文字列。
 */
export function replaceEnglishDayWithJapanese(str: string): string {
  // 英語の曜日と対応する日本語の曜日のマッピング
  const daysMapping: { [key: string]: string } = {
    Sun: '日',
    Mon: '月',
    Tue: '火',
    Wed: '水',
    Thu: '木',
    Fri: '金',
    Sat: '土',
  };

  // すべての曜日に対して置き換えを行います。
  for (const [english, japanese] of Object.entries(daysMapping)) {
    // 英語の曜日を含む正規表現を作成します。
    const regex = new RegExp(`\\(${english}\\)`, 'g');
    // 英語の曜日を日本語に置き換えます。
    str = str.replace(regex, `(${japanese})`);
  }

  // 置き換えられた文字列を返します。
  return str;
}

/**
 * 日付文字列が有効かどうかをチェックする関数
 * @param dateString チェックする日付文字列
 * @returns 有効な日付文字列であればtrue、そうでなければfalse
 */
export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
