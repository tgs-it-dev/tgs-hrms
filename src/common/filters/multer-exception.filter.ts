import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'File upload error';

    // Handle Multer errors
    if (exception instanceof Error) {
      const errorMessage = exception.message.toLowerCase();

      // File size errors
      if (errorMessage.includes('file too large') || errorMessage.includes('limit exceeded')) {
        message = 'File size exceeds the maximum allowed limit of 5MB';
      }
      // File type errors
      else if (
        errorMessage.includes('image') ||
        errorMessage.includes('file type') ||
        errorMessage.includes('mime type') ||
        errorMessage.includes('extension')
      ) {
        message =
          'Invalid file type. Only image files are allowed (JPG, JPEG, PNG, GIF, WebP)';
      }
      // File validation errors
      else if (
        errorMessage.includes('validation') ||
        errorMessage.includes('signature') ||
        errorMessage.includes('invalid')
      ) {
        message = exception.message || 'File validation failed. Please upload a valid image file';
      }
      // Generic file upload errors
      else if (errorMessage.includes('file') || errorMessage.includes('upload')) {
        message = exception.message || 'File upload failed';
      }
      // Other errors
      else {
        message = exception.message || 'An error occurred during file upload';
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

