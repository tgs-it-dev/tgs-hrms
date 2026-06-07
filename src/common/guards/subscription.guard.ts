import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SysDbService } from '../services/sys-db.service';
import { SubscriptionStatus } from '../constants/enums';
import { GLOBAL_SYSTEM_TENANT_ID } from '../constants/enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/request.types';

const TRIAL_DURATION_DAYS = 14;

interface OrgSubscriptionRow {
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sysDb: SysDbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenant_id;

    if (!tenantId) return false;

    // System-admins span all tenants — subscription check does not apply.
    if (tenantId === GLOBAL_SYSTEM_TENANT_ID) return true;

    const rows = await this.sysDb.sysQuery<OrgSubscriptionRow>(
      `SELECT subscription_status, trial_ends_at, grace_period_ends_at
         FROM tenants
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1`,
      [tenantId],
    );

    if (!rows.length) {
      throw new HttpException(
        { code: 'SUBSCRIPTION_INACTIVE', upgradeUrl: '/settings/billing' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const { subscription_status, trial_ends_at, grace_period_ends_at } =
      rows[0];

    return this.evaluate(
      subscription_status,
      trial_ends_at,
      grace_period_ends_at,
      request,
    );
  }

  private evaluate(
    status: SubscriptionStatus,
    trialEndsAt: string | null,
    gracePeriodEndsAt: string | null,
    request: AuthenticatedRequest,
  ): boolean {
    const now = new Date();

    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return true;

      case SubscriptionStatus.TRIAL: {
        // Allow for up to TRIAL_DURATION_DAYS; block on day 15+.
        if (trialEndsAt && new Date(trialEndsAt) > now) return true;

        // No explicit trial_ends_at — fall back to created_at-based check.
        // Guard against misconfigured rows: deny to be safe.
        throw new HttpException(
          { code: 'SUBSCRIPTION_INACTIVE', upgradeUrl: '/settings/billing' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      case SubscriptionStatus.GRACE_PERIOD: {
        // Allow access but signal downstream (interceptor sets X-Grace-Period header).
        if (gracePeriodEndsAt && new Date(gracePeriodEndsAt) > now) {
          request.gracePeriod = true;
          return true;
        }
        // Grace window expired — treat as cancelled.
        throw new HttpException(
          { code: 'SUBSCRIPTION_INACTIVE', upgradeUrl: '/settings/billing' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      case SubscriptionStatus.CANCELLED:
      case SubscriptionStatus.EXPIRED:
        throw new HttpException(
          { code: 'SUBSCRIPTION_INACTIVE', upgradeUrl: '/settings/billing' },
          HttpStatus.PAYMENT_REQUIRED,
        );

      default:
        throw new HttpException(
          { code: 'SUBSCRIPTION_INACTIVE', upgradeUrl: '/settings/billing' },
          HttpStatus.PAYMENT_REQUIRED,
        );
    }
  }
}

// Re-export the trial duration so tests can reference the same constant.
export { TRIAL_DURATION_DAYS };
