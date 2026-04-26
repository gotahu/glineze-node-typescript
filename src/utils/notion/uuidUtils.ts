/**
 * 2つのUUIDが同一かどうかを判定する関数
 * @param uuid1 判定対象のUUID (ハイフンあり/なし)
 * @param uuid2 判定対象のUUID (ハイフンあり/なし)
 * @returns 同一なら true、異なるなら false
 */
export function areUUIDsEqual(uuid1: string, uuid2: string): boolean {
  const normalizedUUID1 = uuid1.replace(/-/g, '').toLowerCase();
  const normalizedUUID2 = uuid2.replace(/-/g, '').toLowerCase();
  return normalizedUUID1 === normalizedUUID2;
}
