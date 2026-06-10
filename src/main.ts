import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allow browser clients (e.g. the demo frontend) on other origins to call the API.
  app.enableCors();
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

  // Interactive API docs (Swagger UI) at /api/docs. The "Authorize" button lets you
  // paste a JWT and try the protected endpoints straight from the browser.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('KiwiSlot API')
    .setDescription(
      'Multi-tenant booking API for small businesses. Register a business, log in for a JWT, then manage services, customers and bookings (with double-booking prevention).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Bind to 0.0.0.0 so the app is reachable inside containers / on cloud hosts (Render).
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
