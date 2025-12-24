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
      // Only log CORS errors in development, not in production to avoid clutter
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `CORS rejection: ${exception.message} from origin: ${request.headers.origin || 'unknown'}`,
        );
      }
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

    // Extract message text and preserve additional properties
    let messageText: string;
    let additionalProps: Record<string, any> = {};
    
    if (typeof message === 'string') {
      messageText = message;
    } else if (typeof message === 'object' && message !== null) {
      const msgObj = message as Record<string, any>;
      messageText = msgObj.message || 'Internal server error';
      // Extract all properties except 'message' to preserve additional data like checkoutUrl
      const { message: _, ...rest } = msgObj;
      additionalProps = rest;
    } else {
      messageText = 'Internal server error';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId,
      message: messageText,
      // Preserve additional properties from the exception response (like checkoutUrl, checkoutSessionId, etc.)
      ...additionalProps,
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


