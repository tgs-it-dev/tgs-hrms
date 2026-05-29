import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { SystemLog } from 'src/entities/system-log.entity';
import { JwtUserPayloadDto } from 'src/modules/auth/dto/jwt-payload.dto';
import { Repository } from 'typeorm';
import { sanitizeRequestBody } from '../utils/sanitize-request-body';

type AuthenticatedExpressRequest = Request & { user?: JwtUserPayloadDto };

@Injectable()
export class SystemLoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<AuthenticatedExpressRequest>();
    const user = req.user;
    const routePath =
      (req.route as { path?: string } | undefined)?.path ?? req.url;

    const sanitizedBody = sanitizeRequestBody(
      req.body as Record<string, unknown>,
    );

    const log = this.logRepo.create({
      action: `${req.method} ${routePath}`,
      entityType: this.extractEntityFromPath(routePath),
      userId: user?.id ?? null,
      userRole: user?.role ?? null,
      tenantId: user?.tenant_id ?? null,
      route: routePath,
      method: req.method,
      ip: req.ip,
      meta: {
        body: sanitizedBody,
        params: req.params,
        query: req.query,
      },
    });

    this.logRepo.save(log).catch(() => {
      // Silently fail — logging failures must not block requests
    });

    return next.handle();
  }

  private extractEntityFromPath(path: string): string {
    const match = path?.split('/')?.[1];
    return match ? match.replace(/s$/, '') : 'Unknown';
  }
}
