import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Line Webhook 簽名驗證需要原始請求體
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  // 監聽 0.0.0.0 讓區域網設備可連線
  await app.listen(port, '0.0.0.0');
  console.log(`API server running on http://0.0.0.0:${port}/api`);
}

bootstrap();
