import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SubscriptionGuard } from "./subscription.guard";
import { SysDbService } from "../services/sys-db.service";
import { SubscriptionStatus } from "../constants/enums";
import { GLOBAL_SYSTEM_TENANT_ID } from "../constants/enums";
import { AuthenticatedRequest } from "../types/request.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1_000).toISOString(); // +10 days
const PAST = new Date(Date.now() - 1 * 24 * 60 * 60 * 1_000).toISOString(); // yesterday

function buildCtx(tenantId: string): {
  ctx: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = {
    user: {
      id: "u1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
      role: "owner",
      tenant_id: tenantId,
      permissions: [],
    },
  };

  const ctx = {
    switchToHttp: () => ({ getRequest: <T>() => request as T }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { ctx, request };
}

function makeGuard(dbRow: object | null): { guard: SubscriptionGuard } {
  const reflector = {
    getAllAndOverride: jest.fn(() => undefined),
  } as unknown as Reflector;

  const sysDb = {
    sysQuery: jest.fn().mockResolvedValue(dbRow ? [dbRow] : []),
  } as unknown as SysDbService;

  return { guard: new SubscriptionGuard(reflector, sysDb) };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("SubscriptionGuard", () => {
  // ── @Public() bypass ────────────────────────────────────────────────────────
  describe("@Public() routes", () => {
    it("skips the DB check and returns true", async () => {
      const sysDb = { sysQuery: jest.fn() } as unknown as SysDbService;
      const publicGuard = new SubscriptionGuard(
        { getAllAndOverride: jest.fn(() => true) } as unknown as Reflector,
        sysDb,
      );
      const { ctx } = buildCtx("tenant-1");

      await expect(publicGuard.canActivate(ctx)).resolves.toBe(true);
      expect(sysDb.sysQuery).not.toHaveBeenCalled();
    });
  });

  // ── System-admin bypass ─────────────────────────────────────────────────────
  describe("system-admin bypass", () => {
    it("returns true for system-admin tenant without hitting the DB", async () => {
      const sysDb = { sysQuery: jest.fn() } as unknown as SysDbService;
      const guard = new SubscriptionGuard(
        { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector,
        sysDb,
      );
      const { ctx } = buildCtx(GLOBAL_SYSTEM_TENANT_ID);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(sysDb.sysQuery).not.toHaveBeenCalled();
    });
  });

  // ── ACTIVE ──────────────────────────────────────────────────────────────────
  describe("ACTIVE status", () => {
    it("returns true for an active org", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.ACTIVE,
        trial_ends_at: null,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-active");
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  // ── TRIAL ───────────────────────────────────────────────────────────────────
  describe("TRIAL status", () => {
    it("returns true when trial_ends_at is in the future (within 14 days)", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.TRIAL,
        trial_ends_at: FUTURE,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-trial");
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it("throws 402 when trial_ends_at has passed (day 15+)", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.TRIAL,
        trial_ends_at: PAST,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-trial-expired");

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new HttpException(
          { code: "SUBSCRIPTION_INACTIVE", upgradeUrl: "/settings/billing" },
          HttpStatus.PAYMENT_REQUIRED,
        ),
      );
    });

    it("throws 402 when trial_ends_at is null (misconfigured row)", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.TRIAL,
        trial_ends_at: null,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-trial-null");
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    });
  });

  // ── GRACE_PERIOD ─────────────────────────────────────────────────────────────
  describe("GRACE_PERIOD status", () => {
    it("returns true and sets request.gracePeriod = true within the grace window", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.GRACE_PERIOD,
        trial_ends_at: null,
        grace_period_ends_at: FUTURE,
      });
      const { ctx, request } = buildCtx("tenant-grace");

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(request.gracePeriod).toBe(true);
    });

    it("throws 402 when the grace window has expired", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.GRACE_PERIOD,
        trial_ends_at: null,
        grace_period_ends_at: PAST,
      });
      const { ctx } = buildCtx("tenant-grace-expired");
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    });
  });

  // ── CANCELLED ───────────────────────────────────────────────────────────────
  describe("CANCELLED status", () => {
    it("throws 402 Payment Required", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.CANCELLED,
        trial_ends_at: null,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-cancelled");

      let thrownError: HttpException | undefined;
      try {
        await guard.canActivate(ctx);
      } catch (err) {
        thrownError = err as HttpException;
      }

      expect(thrownError).toBeInstanceOf(HttpException);
      expect(thrownError!.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(thrownError!.getResponse()).toMatchObject({
        code: "SUBSCRIPTION_INACTIVE",
        upgradeUrl: "/settings/billing",
      });
    });
  });

  // ── EXPIRED ─────────────────────────────────────────────────────────────────
  describe("EXPIRED status", () => {
    it("throws 402 Payment Required", async () => {
      const { guard } = makeGuard({
        subscription_status: SubscriptionStatus.EXPIRED,
        trial_ends_at: null,
        grace_period_ends_at: null,
      });
      const { ctx } = buildCtx("tenant-expired");
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    });
  });

  // ── Row not found ────────────────────────────────────────────────────────────
  describe("missing row", () => {
    it("throws 402 when no tenant row is returned", async () => {
      const { guard } = makeGuard(null);
      const { ctx } = buildCtx("tenant-ghost");
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    });
  });

  // ── No tenant_id on request ──────────────────────────────────────────────────
  describe("unauthenticated request", () => {
    it("returns false when user has no tenant_id", async () => {
      const sysDb = { sysQuery: jest.fn() } as unknown as SysDbService;
      const guard = new SubscriptionGuard(
        { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector,
        sysDb,
      );

      const ctx = {
        switchToHttp: () => ({ getRequest: <T>() => ({ user: {} }) as T }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });
});
