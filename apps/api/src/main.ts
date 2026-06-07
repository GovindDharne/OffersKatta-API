import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  // rawBody: true makes Nest preserve raw request bytes on req.rawBody while
  // still parsing JSON normally. The Razorpay webhook needs rawBody for HMAC
  // verification — without rawBody:true we'd have to register our own express.json
  // for that path, which would suppress Nest's global body parser everywhere else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
    rawBody: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  const corsOrigins = (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  app.use(helmet());

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OffersKatta API')
    .setDescription('Multi-tenant promotional offers platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(port, '0.0.0.0');
  logger.log(`OffersKatta API listening on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs at /api/docs`);
}

bootstrap();
