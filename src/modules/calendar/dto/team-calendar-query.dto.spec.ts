import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TeamCalendarQueryDto } from './team-calendar-query.dto';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(TeamCalendarQueryDto, plain);
  return validate(instance);
}

function hasError(
  errors: Awaited<ReturnType<typeof validateDto>>,
  property: string,
) {
  return errors.some((e) => e.property === property);
}

describe('TeamCalendarQueryDto', () => {
  // ── Required fields ───────────────────────────────────────────────────────

  describe('from / to required', () => {
    it('fails when from is missing', async () => {
      const errors = await validateDto({ to: '2025-06-30' });
      expect(hasError(errors, 'from')).toBe(true);
    });

    it('fails when to is missing', async () => {
      const errors = await validateDto({ from: '2025-06-01' });
      expect(hasError(errors, 'to')).toBe(true);
    });

    it('fails when from is not a valid date string', async () => {
      const errors = await validateDto({
        from: 'not-a-date',
        to: '2025-06-30',
      });
      expect(hasError(errors, 'from')).toBe(true);
    });
  });

  // ── DateRangeConstraint: order ────────────────────────────────────────────

  describe('date range order', () => {
    it('passes when from equals to (same day)', async () => {
      const errors = await validateDto({
        from: '2025-06-15',
        to: '2025-06-15',
      });
      expect(errors).toHaveLength(0);
    });

    it('passes when to is after from', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when to is before from', async () => {
      const errors = await validateDto({
        from: '2025-06-30',
        to: '2025-06-01',
      });
      expect(hasError(errors, 'to')).toBe(true);
    });
  });

  // ── DateRangeConstraint: max 366-day cap ──────────────────────────────────

  describe('date range cap (366 days)', () => {
    it('passes for exactly 366 days', async () => {
      const errors = await validateDto({
        from: '2025-01-01',
        to: '2025-12-31',
      }); // 364 days
      expect(errors).toHaveLength(0);
    });

    it('passes for a range of exactly 366 days (leap year)', async () => {
      // 2024-01-01 → 2025-01-01 = 366 days (2024 is a leap year)
      const errors = await validateDto({
        from: '2024-01-01',
        to: '2025-01-01',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails for a range of 367 days', async () => {
      // 2024-01-01 → 2025-01-02 = 367 days
      const errors = await validateDto({
        from: '2024-01-01',
        to: '2025-01-02',
      });
      expect(hasError(errors, 'to')).toBe(true);
    });

    it('fails for a multi-year range', async () => {
      const errors = await validateDto({
        from: '2020-01-01',
        to: '2025-12-31',
      });
      expect(hasError(errors, 'to')).toBe(true);
    });

    it('error message mentions the day limit', async () => {
      const errors = await validateDto({
        from: '2020-01-01',
        to: '2025-12-31',
      });
      const toError = errors.find((e) => e.property === 'to');
      expect(toError).toBeDefined();
      const messages = Object.values(toError!.constraints ?? {}).join(' ');
      expect(messages).toMatch(/366/);
    });
  });

  // ── Optional fields ───────────────────────────────────────────────────────

  describe('optional fields', () => {
    it('passes without teamId', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when teamId is not a UUID', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
        teamId: 'not-uuid',
      });
      expect(hasError(errors, 'teamId')).toBe(true);
    });

    it('passes when teamId is a valid UUID', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
        teamId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(errors).toHaveLength(0);
    });

    it('passes without tenantId', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when tenantId is not a UUID', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
        tenantId: 'bad',
      });
      expect(hasError(errors, 'tenantId')).toBe(true);
    });

    it('passes when timezone is a valid IANA string', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
        timezone: 'Asia/Karachi',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when timezone is an invalid IANA string — returns 400, no silent UTC fallback', async () => {
      const errors = await validateDto({
        from: '2025-06-01',
        to: '2025-06-30',
        timezone: 'Invalid/Zone',
      });
      expect(hasError(errors, 'timezone')).toBe(true);
    });
  });
});
