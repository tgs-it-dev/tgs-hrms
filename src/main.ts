import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe for consistent error handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform payloads to be objects typed according to their DTO classes
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Custom error response format
        const errorMessages = errors.map(error => ({
          field: error.property,
          message: Object.values(error.constraints || {}).join(', '),
        }));
        
        return new BadRequestException({
          message: 'Missing Fields Error',
          errors: errorMessages,
        });
      },
    }),
  );

  // Enable CORS for your frontend
  app.enableCors({
    origin: '*',//Allow all Frontend Devices
    credentials: true, // only if you use cookies
  });

  const config = new DocumentBuilder()
    .setTitle('HRMS Backend APIs')
    .setDescription('APIs for login, registration and tenant-based access for Department and Designation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(3000, '0.0.0.0');
}
bootstrap();