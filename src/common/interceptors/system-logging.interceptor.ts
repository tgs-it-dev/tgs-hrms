import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from "express";
import { Observable } from "rxjs";
import { SystemLog } from "src/entities/system-log.entity";
import { JwtUserPayloadDto } from "src/modules/auth/dto/jwt-payload.dto";
import { Repository } from "typeorm";
import { sanitizeRequestBody } from "../utils/sanitize-request-body";

@Injectable()
export class SystemLoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req: Request = context.switchToHttp().getRequest();
    const user: JwtUserPayloadDto = (
      req as unknown as { user: JwtUserPayloadDto }
    ).user;

    // Sanitize body before logging
    const sanitizedBody = sanitizeRequestBody(req.body);

    const log = this.logRepo.create({
      action: `${req.method} ${req.route?.path || req.url}`,
      entityType: this.extractEntityFromPath(req.route?.path || req.url),
      userId: user?.id || null,
      userRole: user?.role || null,
      tenantId: user?.tenant_id || null,
      route: req.route?.path || req.url,
      method: req.method,
      ip: req.ip,
      meta: {
        body: sanitizedBody,
        params: req.params,
        query: req.query,
      },
    });

    // Fire-and-forget: logging shouldn't block requests
    this.logRepo.save(log).catch((_err) => {
      // Silently fail - logging failures shouldn't break the app
      // Consider using a proper logger here if needed
    });

    return next.handle();
  }

  private extractEntityFromPath(path: string): string {
    const match = path?.split("/")?.[1];
    return match ? match.replace(/s$/, "") : "Unknown";
  }
}
