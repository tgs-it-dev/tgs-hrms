/**
 * Environment validation schema and configuration
 */

import { IsString, IsNumber, IsBoolean, IsOptional, validateSync } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Logger } from '@nestjs/common';
import {
  DEFAULT_ALLOWED_DOCUMENT_TYPES,
  DEFAULT_ALLOWED_IMAGE_TYPES,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_DB_PORT,
  DEFAULT_HOST,
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_JWT_REFRESH_EXPIRES_IN,
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_DIRECTORY,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_NODE_ENV,
  DEFAULT_PORT,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
} from '../common/constants';

export class EnvironmentVariables {
  // Application
  @IsString()
  NODE_ENV: string = DEFAULT_NODE_ENV;

  @Type(() => Number)
  @IsNumber()
  PORT: number = DEFAULT_PORT;

  @IsString()
  HOST: string = DEFAULT_HOST;

  // Database
  @IsString()
  DB_HOST: string;

  @Type(() => Number)
  @IsNumber()
  DB_PORT: number = DEFAULT_DB_PORT;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASS: string;

  @IsString()
  DB_NAME: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  DB_SSL: boolean = false;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = DEFAULT_JWT_EXPIRES_IN;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = DEFAULT_JWT_REFRESH_EXPIRES_IN;

  // Email
  @IsString()
  @IsOptional()
  SENDGRID_API_KEY: string;

  @IsString()
  @IsOptional()
  SENDGRID_FROM: string;

  // File Upload
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  MAX_FILE_SIZE: number = DEFAULT_MAX_FILE_SIZE;

  @IsString()
  @IsOptional()
  ALLOWED_IMAGE_TYPES: string = DEFAULT_ALLOWED_IMAGE_TYPES;

  @IsString()
  @IsOptional()
  ALLOWED_DOCUMENT_TYPES: string = DEFAULT_ALLOWED_DOCUMENT_TYPES;

  // Security
  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = DEFAULT_CORS_ORIGINS;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_WINDOW_MS: number = DEFAULT_RATE_LIMIT_WINDOW_MS;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS: number = DEFAULT_RATE_LIMIT_MAX_REQUESTS;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = DEFAULT_LOG_LEVEL;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  ENABLE_FILE_LOGGING: boolean = true;

  @IsString()
  @IsOptional()
  LOG_DIRECTORY: string = DEFAULT_LOG_DIRECTORY;

  // Frontend URL
  @IsString()
  @IsOptional()
  FRONTEND_URL: string;

  // Stripe
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = new EnvironmentVariables();
  
  // Transform and assign values
  Object.assign(validatedConfig, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const logger = new Logger('EnvironmentValidation');
    logger.error('Environment validation failed:');
    
    errors.forEach((error) => {
      const constraints = Object.values(error.constraints || {}).join(', ');
      logger.error(`  ${error.property}: ${constraints}`);
    });
    
    throw new Error('Environment validation failed. Please check your .env file.');
  }

  return validatedConfig;
}


