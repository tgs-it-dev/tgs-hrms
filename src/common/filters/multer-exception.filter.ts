import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  FILE_ERROR
} from '../constants';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.BAD_REQUEST;
    let message = 'File upload error';

    // Handle Multer errors
    if (exception instanceof Error) {
      const errorMessage = exception.message.toLowerCase();

      // File size errors
      if (
        errorMessage.includes('file too large') ||
        errorMessage.includes('limit exceeded')
      ) {
        message = FILE_ERROR.SIZE_EXCEEDED;
      }
      // File type errors
      else if (
        errorMessage.includes('image') ||
        errorMessage.includes('file type') ||
        errorMessage.includes('mime type') ||
        errorMessage.includes('extension')
      ) {
        message = FILE_ERROR.INVALID_TYPE;
      }
      // File validation errors
      else if (
        errorMessage.includes('validation') ||
        errorMessage.includes('signature') ||
        errorMessage.includes('invalid')
      ) {
        message =
          exception.message || FILE_ERROR.FAILED_VALIDATION;
      }
      // Generic file upload errors
      else if (
        errorMessage.includes('file') ||
        errorMessage.includes('upload')
      ) {
        message = exception.message || FILE_ERROR.UPLOAD_FAILED;
      }
      // Other errors
      else {
        message = exception.message || FILE_ERROR.ERROR_OCCURRED;
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    });
  }
}
