import { Injectable } from '@nestjs/common';

type CacheEntry<T> = { value: T; expiresAt: number };

const TTL_MS = 60_000;

@Injectable()
export class CalendarCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }

  invalidate(tenantId: string): void {
    const prefix = `cal:${tenantId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  buildKey(
    tenantId: string,
    from: string,
    to: string,
    teamId?: string,
    timezone?: string,
  ): string {
    return `cal:${tenantId}:${from}:${to}:${teamId ?? '*'}:${timezone ?? 'UTC'}`;
  }
}
