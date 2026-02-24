import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
// express-basic-auth is CommonJS with no default export; require() ensures production build works
import basicAuth from 'express-basic-auth';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGINS = [
  'https://snazzy-raindrop-644615.netlify.app',
  'https://tgs-hrms.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://192.168.0.109:3001',
];

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security & performance
  app.use(helmet());

  // Request timing header
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      try {
        res.setHeader('X-Response-Time', `${duration}ms`);
      } catch {
        // Headers already sent
      }
    });
    next();
  });

  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const errorMessages = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints ?? {}).join(', '),
        }));
        return new BadRequestException({
          message: 'Missing Fields Error',
          errors: errorMessages,
        });
      },
    }),
  );

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin: string) => origin.trim())
    : DEFAULT_CORS_ORIGINS;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`CORS: Rejected origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      }
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['X-Correlation-ID', 'X-Response-Time'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Swagger Basic Auth when SWAGGER_PASSWORD is set (e.g. on Render/live)
  const swaggerPassword = process.env.SWAGGER_PASSWORD;
  const swaggerUser = process.env.SWAGGER_USER ?? 'admin';
  if (swaggerPassword) {
    app.use(
      '/api',
      basicAuth({
        users: { [swaggerUser]: swaggerPassword },
        challenge: true,
        realm: 'HRMS API Docs',
      }),
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HRMS Backend APIs')
    .setDescription('APIs for login, registration and tenant-based access for Department and Designation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { docExpansion: 'none' },
  });

  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
