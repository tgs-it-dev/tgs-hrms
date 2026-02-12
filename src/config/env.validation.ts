/**
 * Environment validation schema and configuration
 */

import { IsString, IsNumber, IsBoolean, IsOptional, validateSync } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Logger } from '@nestjs/common';

export class EnvironmentVariables {
  // Application
  @IsString()
  NODE_ENV: string = 'development';

  @Type(() => Number)
  @IsNumber()
  PORT: number = 3001;

  @IsString()
  HOST: string = '0.0.0.0';

  // Database
  @IsString()
  DB_HOST: string;

  @Type(() => Number)
  @IsNumber()
  DB_PORT: number = 5432;

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
  JWT_EXPIRES_IN: string = '60m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

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
  MAX_FILE_SIZE: number = 5242880; // 5MB

  @IsString()
  @IsOptional()
  ALLOWED_IMAGE_TYPES: string = 'jpg,jpeg,png,gif,webp';

  @IsString()
  @IsOptional()
  ALLOWED_DOCUMENT_TYPES: string = 'pdf,doc,docx,xls,xlsx,txt';

  // Security
  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_WINDOW_MS: number = 900000; // 15 minutes

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS: number = 100;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  ENABLE_FILE_LOGGING: boolean = true;

  @IsString()
  @IsOptional()
  LOG_DIRECTORY: string = 'logs';

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


