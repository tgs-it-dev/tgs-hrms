import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Request, Response, NextFunction } from 'express';
// Use require() so production build works (express-basic-auth is CommonJS, no default export)
const basicAuth = require('express-basic-auth');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

 
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      try {
        res.setHeader('X-Response-Time', `${duration}ms`);
      } catch {
        
      }
    });

    next();
  });

  
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
  });

  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const errorMessages = errors.map((error) => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        return new BadRequestException({
          message: 'Missing Fields Error',
          errors: errorMessages,
        });
      },
    })
  );


  app.useGlobalFilters(new HttpExceptionFilter());

  
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'https://snazzy-raindrop-644615.netlify.app',
        'https://deploy-preview-288--snazzy-raindrop-644615.netlify.app',
        'https://tgs-hrms.onrender.com',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
         'http://192.168.0.109:3001',
         'http://dev.workonnect.ai',
         'https://dev.workonnect.ai',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      
      if (!origin) {
        return callback(null, true);
      }
      
      
      if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
      
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`CORS: Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
        }
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['X-Correlation-ID', 'X-Response-Time'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  
  // Protect Swagger with Basic Auth when SWAGGER_PASSWORD is set (e.g. on Render/live)
  const swaggerPassword = process.env.SWAGGER_PASSWORD;
  const swaggerUser = process.env.SWAGGER_USER || 'admin';
  if (swaggerPassword) {
    app.use(
      '/api',
      basicAuth({
        users: {
          [swaggerUser]: swaggerPassword,
        },
        challenge: true,
        realm: 'HRMS API Docs',
      }),
    );
  }

  const config = new DocumentBuilder()
    .setTitle('HRMS Backend APIs')
    .setDescription('APIs for login, registration and tenant-based access for Department and Designation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      docExpansion: 'none',
    }
  });

  
  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
