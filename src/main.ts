import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('NestJS Boilerplate')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();






// I created it just to resolve test deparment e2e 
// import { ValidationPipe } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   /* 📌 GLOBAL validation */
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     })
//   );

//   /* 📌 Global prefix (optional) e.g. /api/departments */
//   // app.setGlobalPrefix('api');

//   /* 📌 CORS */
//   app.enableCors();

//   /* 📌 Swagger */
//   const config = new DocumentBuilder()
//     .setTitle('NestJS Boilerplate')
//     .setDescription('API documentation')
//     .setVersion('1.0')
//     .addBearerAuth()
//     .build();

//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api', app, document);

//   const PORT = process.env.PORT || 3000;
//   await app.listen(PORT);
//   console.log(`Server running on http://localhost:${PORT}`);
// }
// bootstrap();
