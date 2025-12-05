import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Correlation ID middleware is now handled by CorrelationIdMiddleware in AppModule

  // Response time header middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      try {
        res.setHeader('X-Response-Time', `${duration}ms`);
      } catch {
        // Ignore if headers are already sent
      }
    });

    next();
  });

  // Serve static files from project root /public (matches upload services)
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/',
  });

  // Global validation pipe
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

  // Global HTTP exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // ✅ Allow only your frontend in production
  // app.enableCors({
  //   origin: process.env.FRONTEND_URL || '*',
  //   credentials: true,
  // });

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  // Swagger docs
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

  // ✅ Use Render-provided PORT or fallback to 3001
  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
