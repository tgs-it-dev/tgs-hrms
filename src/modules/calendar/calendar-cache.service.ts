import { Injectable } from '@nestjs/common';

type CacheEntry<T> = { value: T; expiresAt: number };

const TTL_MS = 60_000;

// NOTE: Invalidation here is intentionally broad — any write to leaves, WFH, or
// attendance for a tenant clears ALL cached calendar results for that tenant
// (all team/timezone variants). This trades some redundant DB re-fetches for
// simplicity. Under high write volume the burst of simultaneous cache misses
// after an invalidation ("cache stampede") is bounded by the number of active
// users querying the calendar within the 60 s TTL window, which is acceptable
// for typical HRMS usage patterns.
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
