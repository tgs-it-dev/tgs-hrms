import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { SystemLog } from 'src/entities/system-log.entity';
import { Repository } from 'typeorm';
import { sanitizeRequestBody } from '../utils/sanitize-request-body';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';

@Injectable()
export class SystemLoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: AuthenticatedRequest = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const { user } = req;
    if (!user) {
      // If there's no authenticated user, we can choose to skip logging or log with null user info
      return next.handle();
    }

    // Sanitize body before logging
    const sanitizedBody = sanitizeRequestBody(req.body as unknown as object);

    const routeWithPath = req.route as { path?: string } | undefined;

    const path =
      typeof routeWithPath?.path === 'string' ? routeWithPath.path : req.url;

    const log = this.logRepo.create({
      action: `${req.method} ${path}`,
      entityType: this.extractEntityFromPath(path),
      userId: user?.id || null,
      userRole: user?.role || null,
      tenantId: user?.tenant_id || null,
      route: req?.path || req.url,
      method: req.method,
      ip: req.ip,
      meta: {
        body: sanitizedBody,
        params: req.params,
        query: req.query,
      },
    });

    // Fire-and-forget: logging shouldn't block requests
    this.logRepo.save(log).catch(() => {
      // Silently fail - logging failures shouldn't break the app
      // Consider using a proper logger here if needed
    });

    return next.handle();
  }

  private extractEntityFromPath(path: string): string {
    const match = path?.split('/')?.[1];
    return match ? match.replace(/s$/, '') : 'Unknown';
  }
}
