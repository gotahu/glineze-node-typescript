export class ConfigStore {
  public readonly values = new Map<string, string>();

  public replace(values: ReadonlyMap<string, string>): void {
    this.values.clear();
    for (const [key, value] of values) this.values.set(key, value);
  }

  public get(key: string): string {
    const value = this.values.get(key);
    if (!value) {
      throw new Error(
        `Config に key: ${key} が存在しません。設定内容とスペルを確認し、必要に応じて Discord で /reload を実行してください。`
      );
    }
    return value;
  }

  public getAll(): ReadonlyMap<string, string> {
    return this.values;
  }
}
