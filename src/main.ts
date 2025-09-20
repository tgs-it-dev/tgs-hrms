// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import { ValidationPipe } from '@nestjs/common';
// import { BadRequestException } from '@nestjs/common';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import { join } from 'path';

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule);

//   // Serve static files from public directory
//   app.useStaticAssets(join(__dirname, '..', 'public'), {
//     prefix: '/',
//   });

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//       transformOptions: {
//         enableImplicitConversion: true,
//       },
//       exceptionFactory: (errors) => {
//         const errorMessages = errors.map((error) => ({
//           field: error.property,
//           message: Object.values(error.constraints || {}).join(', '),
//         }));

//         return new BadRequestException({
//           message: 'Missing Fields Error',
//           errors: errorMessages,
//         });
//       },
//     })
//   );

//   app.enableCors({
//     origin: '*',
//     credentials: true,
//   });

//   const config = new DocumentBuilder()
//     .setTitle('HRMS Backend APIs')
//     .setDescription(
//       'APIs for login, registration and tenant-based access for Department and Designation'
//     )
//     .setVersion('1.0')
//     .addBearerAuth()
//     .build();

//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api', app, document);
//   const port = parseInt(process.env.PORT || '3001', 10);
//   const host = process.env.HOST || '0.0.0.0';
//   await app.listen(port, host);
// }
// bootstrap();



import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (if you have public assets)
  app.useStaticAssets(join(__dirname, '..', 'public'), {
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

  // ✅ Allow only your frontend in production
  // app.enableCors({
  //   origin: process.env.FRONTEND_URL || '*',
  //   credentials: true,
  // });

  app.enableCors({
    origin: [
      'http://localhost:5173', // Local dev frontend
      'https://snazzy-raindrop-644615.netlify.app', // Production frontend
    ],
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
  SwaggerModule.setup('api', app, document);

  // ✅ Use Render-provided PORT or fallback to 3001
  const port = parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
