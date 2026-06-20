export class TtlCache<T> {
  private readonly values = new Map<
    string,
    { expiresAt: number; value: T }
  >();

  constructor(private readonly ttlMs: number) {}

  get(key: string) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this.values.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
    return value;
  }
}
