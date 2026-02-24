import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ContextLogger, LoggerService } from '../logger/logger.service';
import { FILE_ERROR, HTTP_ERROR, HTTP_HEADER } from '../constants';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: ContextLogger;

  constructor(private readonly loggerService: LoggerService) {
    this.logger = this.loggerService.forChild(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle CORS errors specifically - they should return 403, not 500
    if (exception instanceof Error && exception.message.includes(HTTP_ERROR.CORS_NOT_ALLOWED)) {
      const correlationId =
        (request.headers[HTTP_HEADER.CORRELATION_ID] as string) || HTTP_ERROR.CORRELATION_ID_UNKNOWN;
      // Only log CORS errors in development, not in production to avoid clutter
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`CORS rejection: ${exception.message} from origin: ${request.headers.origin || 'unknown'}`);
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

    // Handle Multer file upload errors
    if (exception instanceof Error) {
      const errorMessage = exception.message.toLowerCase();

      // File size errors from Multer
      if (
        errorMessage.includes('file too large') ||
        errorMessage.includes('limit exceeded') ||
        errorMessage.includes('file size')
      ) {
        const correlationId =
          (request.headers[HTTP_HEADER.CORRELATION_ID] as string) || HTTP_ERROR.CORRELATION_ID_UNKNOWN;
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          correlationId,
          message: FILE_ERROR.SIZE_EXCEEDED,
        });
        return;
      }

      // File type/format errors
      if (
        errorMessage.includes('file type') ||
        errorMessage.includes('mime type') ||
        errorMessage.includes('invalid file') ||
        (errorMessage.includes('image') && errorMessage.includes('not allowed'))
      ) {
        const correlationId =
          (request.headers[HTTP_HEADER.CORRELATION_ID] as string) || HTTP_ERROR.CORRELATION_ID_UNKNOWN;
        response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          correlationId,
          message: FILE_ERROR.INVALID_TYPE,
        });
        return;
      }
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException ? exception.getResponse() : HTTP_ERROR.INTERNAL_SERVER_ERROR;

    const correlationId = (request.headers[HTTP_HEADER.CORRELATION_ID] as string) || HTTP_ERROR.CORRELATION_ID_UNKNOWN;

    // Extract message text and preserve additional properties
    let messageText: string;
    let additionalProps: Record<string, unknown> = {};

    if (typeof message === 'string') {
      messageText = message;
    } else if (typeof message === 'object' && message !== null) {
      const msgObj = message as Record<string, unknown>;
      messageText = String(msgObj.message) || HTTP_ERROR.INTERNAL_SERVER_ERROR;
      const { message: _omit, ...rest } = msgObj;
      void _omit;
      additionalProps = rest;
    } else {
      messageText = HTTP_ERROR.INTERNAL_SERVER_ERROR;
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
