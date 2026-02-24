import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { SystemLog } from 'src/entities/system-log.entity';
import { Repository } from 'typeorm';
import { sanitizeRequestBody } from '../utils/sanitize-request-body';
import { AuthenticatedRequest } from 'src/modules/auth/interfaces';
import { LOGGING_DEFAULT_ENTITY } from '../constants';
import { ContextLogger, LoggerService } from '../logger/logger.service';

@Injectable()
export class SystemLoggingInterceptor implements NestInterceptor {
  private readonly logger: ContextLogger;

  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.forChild(SystemLoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: AuthenticatedRequest = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user } = req;
    if (!user) {
      // If there's no authenticated user, we can choose to skip logging or log with null user info
      return next.handle();
    }

    // Sanitize body before logging
    const sanitizedBody = sanitizeRequestBody(req.body as unknown as object);

    const routeWithPath = req.route as { path?: string } | undefined;

    const path = typeof routeWithPath?.path === 'string' ? routeWithPath.path : req.url;

    const log = this.logRepo.create({
      action: `${req.method} ${path}`,
      entityType: this.extractEntityFromPath(path) || LOGGING_DEFAULT_ENTITY,
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

    this.logRepo.save(log).catch((err) => {
      this.logger.warn('System log save failed', err instanceof Error ? err.message : String(err));
    });

    return next.handle();
  }

  private extractEntityFromPath(path: string): string | null {
    const match = path?.split('/')?.[1];
    return match ? match.replace(/s$/, '') : null;
  }
}
