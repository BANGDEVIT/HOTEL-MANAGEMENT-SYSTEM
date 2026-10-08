import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  // ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Interceptors
  app.useGlobalInterceptors(new TransformInterceptor());

  // Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Hotel Management API')
    .setDescription('API documentation for Hotel Management System')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('employees', 'Employee management endpoints')
    .addTag('shifts', 'Shift management endpoints')
    .addTag('room-types', 'Room type management endpoints')
    .addTag('rooms', 'Room management endpoints')
    .addTag('bookings', 'Booking management endpoints')
    .addTag('customers', 'Customer management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3001', 'Development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Hotel Management API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info .title { color: #4A90E2; }
    `,
  });

  // Sau nginx, mọi request đều mang IP của nginx -> Throttler chặn nhầm mọi người.
  // Tin 1 lớp proxy phía trước để Express đọc IP thật từ header X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(process.env.PORT ?? 3001); // ← fix
}

bootstrap().catch((error) => {
  Logger.error('Error starting server', error);
  process.exit(1);
});
