import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits by IP + email combined.
 * Prevents both brute-force from a single IP and distributed attacks
 * against a single account while avoiding false positives from shared NAT IPs.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    _name: string,
  ): string {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
      body?: { email?: string };
    }>();

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.toLowerCase()
        : 'unknown';

    return `login:${ip}:${email}:${suffix}`;
  }
}
