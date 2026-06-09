import { CalendarCacheService } from './calendar-cache.service';

describe('CalendarCacheService', () => {
  let svc: CalendarCacheService;

  beforeEach(() => {
    svc = new CalendarCacheService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── get / set ────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null for an unknown key', () => {
      expect(svc.get('missing')).toBeNull();
    });

    it('returns the stored value immediately after set', () => {
      svc.set('k', [1, 2, 3]);
      expect(svc.get<number[]>('k')).toEqual([1, 2, 3]);
    });

    it('returns value within the TTL window', () => {
      svc.set('k', 'data');
      jest.advanceTimersByTime(59_999);
      expect(svc.get('k')).toBe('data');
    });

    it('returns null once TTL expires', () => {
      svc.set('k', 'data');
      jest.advanceTimersByTime(60_001);
      expect(svc.get('k')).toBeNull();
    });

    it('deletes the expired entry on access (no memory leak)', () => {
      svc.set('k', 'data');
      jest.advanceTimersByTime(60_001);
      svc.get('k'); // triggers delete
      // A second get should still be null, not resurrect the entry.
      expect(svc.get('k')).toBeNull();
    });

    it('set overwrites an existing entry and resets TTL', () => {
      svc.set('k', 'first');
      jest.advanceTimersByTime(30_000);
      svc.set('k', 'second');
      jest.advanceTimersByTime(50_000); // 80s from first, but only 50s from second
      expect(svc.get('k')).toBe('second');
    });
  });

  // ── invalidate ───────────────────────────────────────────────────────────

  describe('invalidate', () => {
    it('clears all keys that belong to the given tenant', () => {
      const k1 = svc.buildKey('tenant-A', '2025-01-01', '2025-01-31');
      const k2 = svc.buildKey('tenant-A', '2025-02-01', '2025-02-28', 'team-x');
      svc.set(k1, 'a');
      svc.set(k2, 'b');

      svc.invalidate('tenant-A');

      expect(svc.get(k1)).toBeNull();
      expect(svc.get(k2)).toBeNull();
    });

    it('does not affect keys from a different tenant', () => {
      const kA = svc.buildKey('tenant-A', '2025-01-01', '2025-01-31');
      const kB = svc.buildKey('tenant-B', '2025-01-01', '2025-01-31');
      svc.set(kA, 'a');
      svc.set(kB, 'b');

      svc.invalidate('tenant-A');

      expect(svc.get(kB)).toBe('b');
    });

    it('does not throw when the tenant has no cached entries', () => {
      expect(() => svc.invalidate('nonexistent')).not.toThrow();
    });

    it('is safe to call while the map has entries for other tenants (no iteration corruption)', () => {
      for (let i = 0; i < 5; i++) {
        svc.set(
          svc.buildKey('tenant-X', `2025-0${i + 1}-01`, `2025-0${i + 1}-28`),
          i,
        );
      }
      svc.set(svc.buildKey('tenant-Y', '2025-01-01', '2025-01-31'), 'keep');

      expect(() => svc.invalidate('tenant-X')).not.toThrow();
      expect(
        svc.get(svc.buildKey('tenant-Y', '2025-01-01', '2025-01-31')),
      ).toBe('keep');
    });
  });

  // ── buildKey ─────────────────────────────────────────────────────────────

  describe('buildKey', () => {
    it('encodes all parameters', () => {
      expect(
        svc.buildKey(
          't1',
          '2025-06-01',
          '2025-06-30',
          'team-abc',
          'Asia/Karachi',
        ),
      ).toBe('cal:t1:2025-06-01:2025-06-30:team-abc:Asia/Karachi');
    });

    it('uses * for missing teamId', () => {
      expect(svc.buildKey('t1', '2025-06-01', '2025-06-30')).toContain(':*:');
    });

    it('uses UTC for missing timezone', () => {
      expect(
        svc.buildKey('t1', '2025-06-01', '2025-06-30').endsWith(':UTC'),
      ).toBe(true);
    });

    it('all keys for the same tenant share the invalidation prefix', () => {
      const k1 = svc.buildKey('t1', '2025-06-01', '2025-06-30');
      const k2 = svc.buildKey(
        't1',
        '2025-07-01',
        '2025-07-31',
        'team-a',
        'Asia/Karachi',
      );
      expect(k1.startsWith('cal:t1:')).toBe(true);
      expect(k2.startsWith('cal:t1:')).toBe(true);
    });

    it('keys for different tenants do not share a prefix', () => {
      const kA = svc.buildKey('tenant-A', '2025-06-01', '2025-06-30');
      const kB = svc.buildKey('tenant-B', '2025-06-01', '2025-06-30');
      expect(kA.startsWith('cal:tenant-B:')).toBe(false);
      expect(kB.startsWith('cal:tenant-A:')).toBe(false);
    });
  });
});
