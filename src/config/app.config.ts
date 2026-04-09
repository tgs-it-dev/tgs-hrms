/**
 * Enhanced application configuration with validation
 */

import { ConfigService } from '@nestjs/config';
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
  s3: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    publicUrlBase?: string;
  };
  frontend: {
    url: string;
    linkedin_logo_url: string;
    x_logo_url: string;
    instagram_logo_url: string;
    companyLogoUrl: string;
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
      secret: envVars.JWT_SECRET,
      expiresIn: envVars.JWT_EXPIRES_IN,
      refreshSecret: envVars.JWT_REFRESH_SECRET || envVars.JWT_SECRET,
      refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    },
    
    email: {
      sendgridApiKey: envVars.SENDGRID_API_KEY || '',
      sendgridFrom: envVars.SENDGRID_FROM || 'noreply@example.com',
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
    s3: {
      bucket: envVars.AWS_S3_BUCKET || '',
      region: envVars.AWS_S3_REGION || '',
      accessKeyId: envVars.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY || '',
      endpoint: envVars.AWS_S3_ENDPOINT,
      publicUrlBase: envVars.AWS_S3_PUBLIC_URL_BASE,
    },
    frontend: {
      url: envVars.FRONTEND_URL || "http://localhost:5173",
      linkedin_logo_url: `${envVars.FRONTEND_URL || "http://localhost:5173"}/public/linkedin.png`,
      x_logo_url: `${envVars.FRONTEND_URL || "http://localhost:5173"}/public/x.png`,
      instagram_logo_url: `${envVars.FRONTEND_URL || "http://localhost:5173"}/public/instagram.png`,
      companyLogoUrl: `${envVars.FRONTEND_URL || "http://localhost:5173"}/public/logo.png`,
    },
  };
};


