import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle CORS errors specifically - they should return 403, not 500
    if (exception instanceof Error && exception.message.includes('Not allowed by CORS')) {
      const correlationId = (request.headers['x-correlation-id'] as string) || 'unknown';
      this.logger.warn(
        `CORS rejection: ${exception.message} from origin: ${request.headers.origin || 'unknown'}`,
      );
      response.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        correlationId,
        message: exception.message,
      });
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const correlationId = (request.headers['x-correlation-id'] as string) || 'unknown';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      message: typeof message === 'string' ? message : (message as { message?: string }).message || message,
    };

    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${JSON.stringify(errorResponse)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }
}


