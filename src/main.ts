import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

/**
 * Documentación Swagger en `/api/docs` con esquema Bearer JWT llamado
 * `'access-token'` (el mismo nombre que declaran los controllers protegidos
 * con `@ApiBearerAuth('access-token')`).
 */
function configurarSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Application API')
    .setDescription('API migrada desde Express hacia NestJS 12.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Usa el logger propio (Winston) como logger de la aplicación.
  app.useLogger(app.get(WinstonLoggerService));

  // Prefijo global de la API.
  app.setGlobalPrefix('api');

  // Validacion global de DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS (equivalente al origen Express).
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cabeceras de seguridad.
  app.use(helmet());

  configurarSwagger(app);

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
