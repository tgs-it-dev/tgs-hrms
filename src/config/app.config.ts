/**
 * Enhanced application configuration with validation
 */

import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_JWT_SECRET,
  DEFAULT_SENDGRID_FROM,
} from '../common/constants';
import { validateEnvironment } from './env.validation';

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  email: {
    sendgridApiKey: string;
    sendgridFrom: string;
  };
  fileUpload: {
    maxFileSize: number;
    allowedImageTypes: string[];
    allowedDocumentTypes: string[];
  };
  security: {
    corsOrigins: string[];
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
  logging: {
    level: string;
    enableFileLogging: boolean;
    logDirectory: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
}

export const getAppConfig = (_configService: ConfigService): AppConfig => {
  // Validate environment variables
  const envVars = validateEnvironment(process.env);
  
  return {
    port: envVars.PORT,
    host: envVars.HOST,
    nodeEnv: envVars.NODE_ENV,
    
    database: {
      host: envVars.DB_HOST,
      port: envVars.DB_PORT,
      username: envVars.DB_USER,
      password: envVars.DB_PASS,
      database: envVars.DB_NAME,
      ssl: envVars.DB_SSL,
    },
    
    jwt: {
      secret: envVars.JWT_SECRET || DEFAULT_JWT_SECRET,
      expiresIn: envVars.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
      refreshSecret: envVars.JWT_REFRESH_SECRET || envVars.JWT_SECRET,
      refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    },
    
    email: {
      sendgridApiKey: envVars.SENDGRID_API_KEY || '',
      sendgridFrom: envVars.SENDGRID_FROM || DEFAULT_SENDGRID_FROM,
    },
    
    fileUpload: {
      maxFileSize: envVars.MAX_FILE_SIZE,
      allowedImageTypes: envVars.ALLOWED_IMAGE_TYPES.split(','),
      allowedDocumentTypes: envVars.ALLOWED_DOCUMENT_TYPES.split(','),
    },
    
    security: {
      corsOrigins: envVars.CORS_ORIGINS.split(','),
      rateLimit: {
        windowMs: envVars.RATE_LIMIT_WINDOW_MS,
        maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
      },
    },
    
    logging: {
      level: envVars.LOG_LEVEL,
      enableFileLogging: envVars.ENABLE_FILE_LOGGING,
      logDirectory: envVars.LOG_DIRECTORY,
    },
    
    stripe: {
      secretKey: envVars.STRIPE_SECRET_KEY || '',
      webhookSecret: envVars.STRIPE_WEBHOOK_SECRET || '',
    },
  };
};


