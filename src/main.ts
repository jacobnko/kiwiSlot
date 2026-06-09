import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Version every route under /api/v1 (e.g. GET /api/v1/bookings).
  app.setGlobalPrefix('api/v1');
  // Validate every incoming DTO globally.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not defined on the DTO
      forbidNonWhitelisted: true, // 400 if unknown properties are sent
      transform: true, // turn plain JSON into typed DTO instances
    }),
  );
  // Bind to 0.0.0.0 so the app is reachable inside containers / on cloud hosts (Render).
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
